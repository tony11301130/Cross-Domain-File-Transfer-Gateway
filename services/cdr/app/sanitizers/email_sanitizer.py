
import email
from email import policy
from email.message import EmailMessage
from typing import Optional, BinaryIO, Callable, Tuple
from .base import BaseSanitizer
from .html import HtmlSanitizer
import io
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum

class EmailSanitizer(BaseSanitizer):
    def __init__(self, get_sanitizer_func: Callable):
        self.get_sanitizer = get_sanitizer_func
        self.html_sanitizer = HtmlSanitizer()

    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            # Parse the email
            # We must use email.policy.default explicitly, NOT the passed sanitizer policy
            msg = email.message_from_binary_file(input_file, policy=email.policy.default)
            
            self._walk_and_clean(msg, policy, report)
            
            # Serialize
            report.is_safe = True
            report.method_used = "surgical"
            return msg.as_bytes(), report
            
        except Exception as e:
            print(f"[EmailSanitizer] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

    def _walk_and_clean(self, part, policy: SanitizationPolicy, report: SanitizationReport):
        # If it's a multipart, walk subparts
        if part.is_multipart():
            for subpart in part.iter_parts():
                self._walk_and_clean(subpart, policy, report)
            return

        # It's a leaf part
        content_type = part.get_content_type()
        filename = part.get_filename()
        
        # 1. Body Content (HTML / Text)
        if content_type == "text/html" and not filename:
             if policy.remove_html_body:
                 part.set_payload(b"[CDR: HTML Body Removed by Policy]")
                 part.set_type("text/plain")
                 report.add_log(ActionEnum.REMOVE, "HTML Body removed by policy", "Body")
                 return

             try:
                original_payload = part.get_payload(decode=True)
                if original_payload:
                    clean_bytes, nested_report = self.html_sanitizer.sanitize(io.BytesIO(original_payload), policy)
                    
                    # Aggregate HTML logs
                    for log in nested_report.logs:
                         report.add_log(log.action, log.details, f"Body:HTML:{log.component}")

                    if clean_bytes:
                         part.set_payload(clean_bytes)
                    else:
                         part.set_payload(b"[CDR: HTML Body Removed due to sanitization failure]")
                         report.add_log(ActionEnum.FAIL, "HTML sanitization failed", "Body")

             except Exception as e:
                 print(f"[EmailSanitizer] Failed to clean HTML body: {e}")
                 part.set_payload(b"[CDR: HTML Body Removed due to processing error]")
                 report.add_log(ActionEnum.FAIL, f"Error: {e}", "Body")
        
        # 2. Attachments
        elif filename:
            # It's an attachment
            print(f"[EmailSanitizer] Found attachment: {filename} ({content_type})")
            
            sanitizer = self.get_sanitizer(content_type)
            
            if sanitizer:
                try:
                    original_payload = part.get_payload(decode=True)
                    if original_payload:
                        clean_bytes, nested_report = sanitizer.sanitize(io.BytesIO(original_payload), policy)
                        
                        # Aggregate attachment logs
                        for log in nested_report.logs:
                            report.add_log(log.action, log.details, f"Attachment:{filename}:{log.component}", file=filename)

                        if clean_bytes:
                            if "Content-Transfer-Encoding" in part:
                                del part['Content-Transfer-Encoding']
                            part.set_payload(clean_bytes)
                        else:
                            # Sanitization returned None (failed/rejected)
                            self._replace_with_tombstone(part, filename, "Sanitization Failed")
                            report.add_log(ActionEnum.BLOCK, f"Sanitization failed for {filename}", "Attachment", file=filename)
                except Exception as e:
                    print(f"[EmailSanitizer] Error sanitizing attachment {filename}: {e}")
                    self._replace_with_tombstone(part, filename, "Processing Error")
                    report.add_log(ActionEnum.FAIL, f"Error processing {filename}: {e}", "Attachment", file=filename)
            else:
                # No sanitizer for this type
                # For strict CDR, we remove it.
                if policy.allow_unknown_types:
                     report.add_log(ActionEnum.PASS, f"Unknown type allowed: {filename}", "Attachment", file=filename)
                else:
                    self._replace_with_tombstone(part, filename, "Unsupported File Type")
                    report.add_log(ActionEnum.REMOVE, f"Unsupported file type: {content_type}", "Attachment", file=filename)

    def _replace_with_tombstone(self, part, filename, reason):
        """
        Replaces the content of the part with a text file explaining deletion.
        """
        part.set_type("text/plain")
        part.set_payload(f"[CDR] Attachment '{filename}' removed. Reason: {reason}".encode('utf-8'))
        part.set_param("name", f"{filename}.txt")
        if "Content-Transfer-Encoding" in part:
            del part["Content-Transfer-Encoding"] # Reset encoding
