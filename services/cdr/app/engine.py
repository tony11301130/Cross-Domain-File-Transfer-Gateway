from typing import Optional
from .sanitizers.base import BaseSanitizer

def get_sanitizer(mime_type: str) -> Optional[BaseSanitizer]:
    """
    Factory function to get the appropriate sanitizer based on MIME type.
    """
    
    # Register sanitizers
    from .sanitizers.pdf import PDFSanitizer
    from .sanitizers.office_surgical import SurgicalOfficeSanitizer
    from .sanitizers.image import ImageSanitizer
    from .sanitizers.rtf import RtfSanitizer
    from .sanitizers.html import HtmlSanitizer, SvgSanitizer
    from .sanitizers.email_sanitizer import EmailSanitizer
    from .sanitizers.archive.sanitizer import ArchiveSanitizer
    from .sanitizers.text import TextSanitizer

    if mime_type == "application/pdf":
        return PDFSanitizer()
        
    elif mime_type == "application/rtf" or mime_type == "text/rtf":
        return RtfSanitizer()

    elif mime_type in [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ]:
        # Using Structural/Surgical sanitizer (DocBleach style)
        return SurgicalOfficeSanitizer(mime_type)
        
    elif mime_type.startswith("image/"):
        if mime_type == "image/svg+xml":
            return SvgSanitizer()
        return ImageSanitizer()
    
    elif mime_type in ["text/html", "application/xhtml+xml"]:
        return HtmlSanitizer(mime_type)

    elif mime_type in ["message/rfc822", "application/vnd.ms-outlook"]:
        return EmailSanitizer(get_sanitizer)

    elif mime_type in [
        "application/zip", "application/x-zip-compressed", "application/x-tar", 
        "application/x-7z-compressed"
    ]:
        # Circular dependency trick: pass get_sanitizer itself
        return ArchiveSanitizer(mime_type, get_sanitizer)
    
    elif mime_type == "text/plain":
        return TextSanitizer()
        
    return None


