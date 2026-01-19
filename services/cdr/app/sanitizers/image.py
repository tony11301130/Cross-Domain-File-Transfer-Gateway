import io
from typing import Optional, BinaryIO, Tuple
from PIL import Image
from .base import BaseSanitizer
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum

class ImageSanitizer(BaseSanitizer):
    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            img = Image.open(input_file)
            original_format = img.format
            if not original_format:
                original_format = "PNG"
            
            target_format = original_format
            if policy.convert_to_format:
                target_format = policy.convert_to_format.upper()
                report.add_log(ActionEnum.CONVERT, f"Converted from {original_format} to {target_format}", "Format")
            else:
                 report.add_log(ActionEnum.PASS, f"Kept as {original_format}", "Format")

            # Convert to RGB to ensure compatibility and strip alpha channels if needed
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            
            # Create a new image with the same data but NO metadata
            # We copy pixel data to a fresh image object
            clean_img = Image.new(img.mode, img.size)
            clean_img.putdata(list(img.getdata()))
            
            # Save to buffer without metadata
            final_buffer = io.BytesIO()
            
            # 'optimize=True' often strips extra data
            clean_img.save(final_buffer, format=target_format, optimize=True)
            final_buffer.seek(0)
            
            if policy.strip_metadata:
                 report.add_log(ActionEnum.REMOVE, "Stripped EXIF and other metadata", "Metadata")

            report.is_safe = True
            report.method_used = "surgical"
            return final_buffer.getvalue(), report
        except Exception as e:
            print(f"[ImageSanitizer] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

