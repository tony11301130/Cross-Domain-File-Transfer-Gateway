from typing import Tuple, Optional, BinaryIO
import logging
import tempfile
import os
import shutil
from .base import BaseSanitizer
from app.core.models import SanitizationPolicy, SanitizationReport, SanitizationLog, ActionEnum
from app.core.converter import SafeConverter

logger = logging.getLogger(__name__)

class FallbackSanitizer(BaseSanitizer):
    """
    Acts as a 'High Security' or 'Fallback' sanitizer.
    Uses 'Dangerzone-like' pixel reconstruction to sanitize files.
    """
    
    def __init__(self, mime_type: str = "application/octet-stream", extension: str = ""):
        self.mime_type = mime_type
        self.extension = extension
        self.converter = SafeConverter()
        
    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy, password: Optional[str] = None) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport(is_safe=False, logs=[], method_used="fallback")
        
        # We need a physical file to process with external tools
        with tempfile.TemporaryDirectory() as temp_dir:
            input_name = f"unknown_input{self.extension}" if self.extension else "unknown_input"
            input_path = os.path.join(temp_dir, input_name)
            output_path = os.path.join(temp_dir, "safe_output.pdf")
            
            # Write stream to disk
            with open(input_path, "wb") as f:
                shutil.copyfileobj(input_file, f)
                
            report.logs.append(SanitizationLog(
                file=str(input_path),
                action=ActionEnum.DETECT,
                details=f"Starting Fallback/Safe Conversion for {self.mime_type}"
            ))
            
            try:
                # Execute pipeline!
                self.converter.process(input_path, output_path)
                
                # Read back report
                with open(output_path, "rb") as f_out:
                    sanitized_content = f_out.read()
                    
                report.is_safe = True
                report.logs.append(SanitizationLog(
                    file=str(input_path),
                    action=ActionEnum.RECONSTRUCT,
                    details="File successfully converted to Safe PDF via Pixel Reconstruction"
                ))
                
                return sanitized_content, report
                
            except Exception as e:
                logger.error(f"Fallback sanitization failed: {e}")
                report.logs.append(SanitizationLog(
                    file=str(input_path),
                    action=ActionEnum.BLOCK,
                    details=f"Fallback conversion failed: {str(e)}"
                ))
                return None, report
