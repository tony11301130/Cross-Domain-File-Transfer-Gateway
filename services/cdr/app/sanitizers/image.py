import io
from typing import Optional, BinaryIO
from PIL import Image
from .base import BaseSanitizer

class ImageSanitizer(BaseSanitizer):
    def sanitize(self, input_file: BinaryIO) -> Optional[bytes]:
        try:
            img = Image.open(input_file)
            original_format = img.format
            if not original_format:
                original_format = "PNG"
            
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
            clean_img.save(final_buffer, format=original_format, optimize=True)
            final_buffer.seek(0)
            
            return final_buffer.getvalue()
        except Exception as e:
            print(f"[ImageSanitizer] Error: {e}")
            return None
