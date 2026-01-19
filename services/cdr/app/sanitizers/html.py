import bleach
from typing import Optional, BinaryIO, Tuple
from .base import BaseSanitizer
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum

class HtmlSanitizer(BaseSanitizer):
    def __init__(self, mime_type: str = "text/html"):
        self.mime_type = mime_type
        # Define allowed tags for HTML
        self.input_allowed_tags = list(bleach.sanitizer.ALLOWED_TAGS) + [
            'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
            'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'pre', 'code'
        ]
        self.input_allowed_attributes = {
            '*': ['class', 'style', 'id'],
            'a': ['href', 'title'],
            'img': ['src', 'alt', 'width', 'height'],
        }
    
    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            content = input_file.read().decode('utf-8', errors='ignore')
            
            # TODO: Compare clean_content with content to determine changes and log details
            clean_content = bleach.clean(
                content,
                tags=self.input_allowed_tags,
                attributes=self.input_allowed_attributes,
                strip=True # Strip disallowed tags
            )
            
            if len(content) != len(clean_content):
                report.add_log(ActionEnum.CLEAN, f"Removed unsafe tags/attributes. Length changed from {len(content)} to {len(clean_content)}", "HTML_Cleaner")
            else:
                report.add_log(ActionEnum.PASS, "No unsafe content found", "HTML_Cleaner")

            report.is_safe = True
            report.method_used = "surgical"
            return clean_content.encode('utf-8'), report
        except Exception as e:
            print(f"[HtmlSanitizer] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

class SvgSanitizer(BaseSanitizer):
    def __init__(self):
        # SVG is tricky. We allow basic shapes but strip scripts.
        self.allowed_tags = [
            'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
            'text', 'tspan', 'defs', 'use', 'symbol', 'marker', 'linearGradient', 'radialGradient',
            'stop', 'clipPath', 'mpath', 'animate', 'animateMotion', 'animateTransform'
        ]
        self.allowed_attributes = {
            '*': ['id', 'class', 'style', 'fill', 'stroke', 'stroke-width', 'transform', 'd', 
                  'viewBox', 'width', 'height', 'xmlns', 'version'],
            'svg': ['xmlns', 'version', 'viewBox', 'width', 'height'],
            'path': ['d', 'fill', 'stroke', 'stroke-width'],
        }
        
    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            content = input_file.read().decode('utf-8', errors='ignore')
            
            clean_content = bleach.clean(
                content,
                tags=self.allowed_tags,
                attributes=self.allowed_attributes,
                strip=True
            )
            
            if "<script>" in content or "javascript:" in content or "onclick" in content:
                 if "<script>" not in clean_content:
                      report.add_log(ActionEnum.REMOVE, "Removed scripts/event handlers", "SVG_Cleaner")
            
            if len(content) != len(clean_content):
                 report.add_log(ActionEnum.CLEAN, "Sanitized SVG structure", "SVG_Cleaner")
            else:
                 report.add_log(ActionEnum.PASS, "Clean SVG", "SVG_Cleaner")

            report.is_safe = True
            report.method_used = "surgical"
            return clean_content.encode('utf-8'), report
        except Exception as e:
            print(f"[SvgSanitizer] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

