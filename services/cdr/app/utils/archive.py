
import zipfile
import tempfile
import os
import shutil
import io
import magic
from typing import Optional, BinaryIO

# Security Constants
MAX_RATIO = 100  # Max compression ratio (100x)
MAX_SIZE = 100 * 1024 * 1024  # 100 MB max uncompressed size per file
MAX_FILES = 1000  # Max files inside archive
MAX_DEPTH = 5 # Recursion depth

class ArchiveSanitizer:
    def __init__(self, file_type: str, get_sanitizer_func):
        self.file_type = file_type
        # We inject the factory to avoid circular imports
        self.get_sanitizer = get_sanitizer_func

    def sanitize(self, input_file: BinaryIO) -> Optional[bytes]:
        try:
            # We need to save to disk because zipfile/tarfile often needs seekable or filename
            with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_in:
                shutil.copyfileobj(input_file, tmp_in)
                tmp_in_path = tmp_in.name

            # Create a temp dir for extraction
            extract_dir = tempfile.mkdtemp()
            
            try:
                if not self._safe_extract(tmp_in_path, extract_dir):
                    print(f"[Archive] Extraction failed or unsafe archive detected.")
                    return None

                # Process extracted files
                self._process_directory(extract_dir)

                # Repack
                output_buffer = io.BytesIO()
                self._repack_zip(extract_dir, output_buffer)
                
                return output_buffer.getvalue()

            finally:
                # Cleanup
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
                if os.path.exists(extract_dir):
                    shutil.rmtree(extract_dir)

        except Exception as e:
            print(f"[ArchiveSanitizer] Error: {e}")
            return None

    def _safe_extract(self, zip_path: str, extract_path: str) -> bool:
        try:
            with zipfile.ZipFile(zip_path, 'r') as zf:
                # 1. Check total files
                file_list = zf.infolist()
                if len(file_list) > MAX_FILES:
                    print(f"[Archive] Modified Zip Bomb: Too many files ({len(file_list)})")
                    return False
                
                total_size = 0
                for info in file_list:
                    # 2. Check Compression Ratio
                    if info.file_size > MAX_SIZE:
                         print(f"[Archive] File too large: {info.filename}")
                         return False
                    
                    if info.compress_size > 0:
                        ratio = info.file_size / info.compress_size
                        if ratio > MAX_RATIO:
                            print(f"[Archive] Ratio too high ({ratio}) for {info.filename}")
                            return False
                    
                    total_size += info.file_size
                
                # 3. Check Total Uncompressed Size
                if total_size > MAX_SIZE * 5: # Allow aggressive total but cap individual
                    print(f"[Archive] Total extracted size too large ({total_size})")
                    return False

                # Extract
                zf.extractall(extract_path)
                return True
        except zipfile.BadZipFile:
            print("[Archive] Bad Zip File")
            return False
        except Exception as e:
            print(f"[Archive] Extraction Error: {e}")
            return False

    def _process_directory(self, root_dir: str, current_depth: int = 0):
        if current_depth > MAX_DEPTH:
            print("[Archive] Max recursion depth reached.")
            return

        for root, dirs, files in os.walk(root_dir):
            for file in files:
                file_path = os.path.join(root, file)
                
                # Identify type
                try:
                    mime = magic.Magic(mime=True)
                    file_type = mime.from_file(file_path)
                    
                    # Get sanitizer
                    sanitizer = self.get_sanitizer(file_type)
                    
                    if sanitizer is None:
                        # If unsupported, we MIGHT want to delete it or leave it as is if it's benign text.
                        # For CDR "Zero Trust", we should probably delete potentially dangerous unknowns.
                        # For this PoC, we DELETE unknown executables but KEEP text?
                        # Let's simple DELETE anything we can't sanitize to be safe.
                        # Or, check if it's another archive (recursion).
                        
                        # Handle Recursion for nested Zips
                        if file_type in ['application/zip', 'application/x-zip-compressed']:
                            # Special handling: Create a new ArchiveSanitizer recursively?
                            # Or just call sanitize on it
                            # For simplicity in PoC, we reuse self logic but we need to instantiate.
                            # But wait, self.get_sanitizer(file_type) SHOULD return an ArchiveSanitizer if we register it!
                            # So this loop handles recursion automatically IF get_sanitizer knows about zip.
                            # But if it returns None (not registered yet), we might skip.
                            print(f"[Archive] Skipping unsupported/safe-ish file: {file} ({file_type})")
                            continue
                    
                    # Sanitize
                    print(f"[Archive] Sanitizing nested file: {file} ({file_type})")
                    with open(file_path, "rb") as f_in:
                        sanitized_content_bytes = sanitizer.sanitize(f_in)
                    
                    if sanitized_content_bytes:
                        # Overwrite with sanitized content
                        with open(file_path, "wb") as f_out:
                            f_out.write(sanitized_content_bytes)
                    else:
                        # Sanitization failed, delete file
                        print(f"[Archive] Sanitization failed for {file}, removing.")
                        os.remove(file_path)

                except Exception as e:
                    print(f"[Archive] Error processing component {file}: {e}")
                    os.remove(file_path)

    def _repack_zip(self, source_dir: str, output_buffer: io.BytesIO):
        with zipfile.ZipFile(output_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    zf.write(file_path, arcname)
