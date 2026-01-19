from typing import Optional, BinaryIO, Tuple
from .base import BaseSanitizer
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum

class TextSanitizer(BaseSanitizer):
    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            # Read content
            content = input_file.read()
            
            # Try to decode as UTF-8 to ensure it's text
            try:
                text_content = content.decode('utf-8')
                report.add_log(ActionEnum.PASS, "Valid UTF-8", "Encoding")
            except UnicodeDecodeError:
                report.add_log(ActionEnum.BLOCK, "Invalid UTF-8", "Encoding")
                print("[TextSanitizer] Invalid UTF-8 encoding")
                report.is_safe = False
                return None, report
                
            report.is_safe = True
            report.method_used = "surgical"
            return text_content.encode('utf-8'), report
            
        except Exception as e:
            print(f"[TextSanitizer] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

