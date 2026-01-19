import tempfile
import os
import shutil
import io
import magic
from typing import Optional, BinaryIO, Tuple
from .config import MAX_DEPTH
from .extractor import ArchiveExtractor
from .repacker import ArchiveRepacker
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum
from app.core.exceptions import PasswordRequiredError

class ArchiveSanitizer:
    def __init__(self, file_type: str, get_sanitizer_func):
        self.file_type = file_type
        # We inject the factory to avoid circular imports
        self.get_sanitizer = get_sanitizer_func
        self.extractor = ArchiveExtractor(file_type)
        self.repacker = ArchiveRepacker(file_type)

    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy, password: Optional[str] = None) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            # We need to save to disk because zipfile/tarfile/py7zr often needs seekable or filename
            suffix = ".zip"
            if "7z" in self.file_type:
                suffix = ".7z"
            elif "tar" in self.file_type:
                suffix = ".tar"

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
                shutil.copyfileobj(input_file, tmp_in)
                tmp_in_path = tmp_in.name

            extract_dir = tempfile.mkdtemp()
            
            try:
                if not self.extractor.safe_extract(tmp_in_path, extract_dir, password=password):
                    report.add_log(ActionEnum.BLOCK, "Extraction failed or unsafe archive (ZipBomb?)", "Structure")
                    report.is_safe = False
                    return None, report
            except PasswordRequiredError as e:
                report.add_log(ActionEnum.NEED_PASSWORD, str(e), "Encryption")
                report.requires_password = True
                return None, report

            # Process extracted files
            self._process_directory(extract_dir, policy, report)

            # Repack
            output_buffer = io.BytesIO()
            self.repacker.repack(extract_dir, output_buffer)
            
            report.is_safe = True
            report.method_used = "surgical"
            return output_buffer.getvalue(), report

        finally:
            if os.path.exists(tmp_in_path):
                os.remove(tmp_in_path)
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir)

        except Exception as e:
            print(f"[ArchiveSanitizer] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

    def _process_directory(self, root_dir: str, policy: SanitizationPolicy, report: SanitizationReport, current_depth: int = 0):
        if current_depth > policy.max_recursion_depth:
            print("[Archive] Max recursion depth reached.")
            report.add_log(ActionEnum.BLOCK, "Max recursion depth reached", "Recursion")
            return

        for root, dirs, files in os.walk(root_dir):
            for file in files:
                file_path = os.path.join(root, file)
                
                try:
                    mime = magic.Magic(mime=True)
                    file_type = mime.from_file(file_path)
                    
                    sanitizer = self.get_sanitizer(file_type)
                    
                    if sanitizer is None:
                        # Recursion for nested archives validation
                        if policy.allow_unknown_types:
                             report.add_log(ActionEnum.PASS, f"Allowed unknown file: {file}", "Unknown", file=file)
                             continue

                        print(f"[Archive] Skipping/Removing unsupported file: {file} ({file_type})")
                        os.remove(file_path) # STRICT POLICY
                        report.add_log(ActionEnum.REMOVE, f"Removed unsupported file: {file} ({file_type})", "Unsupported", file=file)
                        continue
                    
                    # Sanitize
                    print(f"[Archive] Sanitizing nested file: {file} ({file_type})")
                    with open(file_path, "rb") as f_in:
                        # RECURSIVE CALL
                        sanitized_content, nested_report = sanitizer.sanitize(f_in, policy)
                    
                    # Aggregate logs (simplified: just append with prefix)
                    for log in nested_report.logs:
                        report.add_log(log.action, log.details, f"Nested:{file}:{log.component}", file=file)

                    if sanitized_content:
                        with open(file_path, "wb") as f_out:
                            f_out.write(sanitized_content)
                    else:
                        print(f"[Archive] Sanitization failed for {file}, removing.")
                        os.remove(file_path)
                        report.add_log(ActionEnum.REMOVE, f"Removed failed file: {file}", "Nested")

                except Exception as e:
                    print(f"[Archive] Error processing component {file}: {e}")
                    report.add_log(ActionEnum.FAIL, f"Error processing {file}: {e}", "Processing")
                    if os.path.exists(file_path):
                        os.remove(file_path)

