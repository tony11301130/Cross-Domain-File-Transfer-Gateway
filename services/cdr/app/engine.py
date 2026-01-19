import abc
from typing import Optional, BinaryIO

class BaseSanitizer(abc.ABC):
    """
    Abstract base class for all file sanitizers.
    """

    @abc.abstractmethod
    def sanitize(self, input_file: BinaryIO) -> Optional[bytes]:
        """
        Sanitize the input file and return the sanitized content as bytes.
        
        Args:
            input_file: A file-like object (binary mode) containing the original file.
            
        Returns:
            The sanitized file content as bytes, or None if sanitization fails or is not supported.
        """
        pass

def get_sanitizer(mime_type: str) -> Optional[BaseSanitizer]:
    """
    Factory function to get the appropriate sanitizer based on MIME type.
    """
    
    # Register sanitizers
    from sanitizers import PDFSanitizer, SurgicalOfficeSanitizer, ImageSanitizer, RtfSanitizer
    from utils.archive import ArchiveSanitizer

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
        return ImageSanitizer()
    
    elif mime_type in ["application/zip", "application/x-zip-compressed", "application/x-tar"]:
        # Circular dependency trick: pass get_sanitizer itself
        return ArchiveSanitizer(mime_type, get_sanitizer)
        
    return None
