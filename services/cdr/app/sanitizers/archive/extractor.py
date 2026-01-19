try:
    import pyzipper as zipfile
except ImportError:
    import zipfile
import tarfile
import os
from typing import Optional
from app.core.exceptions import PasswordRequiredError
try:
    import py7zr
except ImportError:
    py7zr = None
from .config import MAX_RATIO, MAX_SIZE, MAX_FILES

class ArchiveExtractor:
    def __init__(self, file_type: str):
        self.file_type = file_type

    def safe_extract(self, archive_path: str, extract_path: str, password: Optional[str] = None) -> bool:
        try:
            if "7z" in self.file_type:
                return self._safe_extract_7z(archive_path, extract_path, password=password)
            
            # Default to ZIP logic (improved with tar check if needed)
            if not zipfile.is_zipfile(archive_path):
                # Check for tar
                if tarfile.is_tarfile(archive_path):
                    # Implement safe tar extract
                    return self._safe_extract_tar(archive_path, extract_path)
                return False

            with zipfile.ZipFile(archive_path, 'r') as zf:
                if password:
                    zf.setpassword(password.encode())
                # 1. Check total files
                file_list = zf.infolist()
                
                # Check for encryption
                for info in file_list:
                    if info.flag_bits & 0x1:
                        if not password:
                            print(f"[Archive] ZIP is password protected: {info.filename}")
                            raise PasswordRequiredError(f"ZIP file contains encrypted component: {info.filename}")
                        else:
                            # If password provided, it will be used by setpassword and extractall
                            print(f"[Archive] Extracting encrypted component with provided password: {info.filename}")

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
        except PasswordRequiredError:
            raise
        except Exception as e:
            print(f"[Archive] Extraction Error: {e}")
            return False

    def _safe_extract_7z(self, archive_path: str, extract_path: str, password: Optional[str] = None) -> bool:
        if py7zr is None:
            print("[Archive] py7zr module not installed. Skipping 7z extraction.")
            return False
            
        try:
            with py7zr.SevenZipFile(archive_path, mode='r', password=password) as z:
                if z.needs_password() and not password:
                     print(f"[Archive] 7z is password protected")
                     raise PasswordRequiredError("7z archive is password protected")
                # py7zr doesn't give easy list without reading, but let's try strict extract
                # Limitations: 7z usually solid compression, hard to check ratios per file without full scan.
                # simpler check:
                if z.archiveinfo().uncompressed > (MAX_SIZE * 5):
                     print(f"[Archive] 7z total size too large")
                     return False
                
                z.extractall(path=extract_path)
                return True
        except PasswordRequiredError:
            raise
        except Exception as e:
            print(f"[Archive] 7z Extract Error: {e}")
            return False

    def _safe_extract_tar(self, archive_path: str, extract_path: str) -> bool:
         # Simplified tar extraction
         try:
             with tarfile.open(archive_path, "r") as tar:
                 # Check size?
                 tar.extractall(extract_path)
                 return True
         except Exception as e:
             return False
