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
    # Placeholder for future implementations
    # In Step 3, we will register concrete sanitizers here.
    
    # Register sanitizers
    from sanitizers import PDFSanitizer, OfficeSanitizer, ImageSanitizer
    from utils.archive import ArchiveSanitizer

    if mime_type == "application/pdf":
        return PDFSanitizer()
        
    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return OfficeSanitizer(mime_type)
        
    elif mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return OfficeSanitizer(mime_type)

    elif mime_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        return OfficeSanitizer(mime_type)
        
    elif mime_type.startswith("image/"):
        return ImageSanitizer()
    
    elif mime_type in ["application/zip", "application/x-zip-compressed"]:
        # Circular dependency trick: pass get_sanitizer itself
        return ArchiveSanitizer(mime_type, get_sanitizer)
        
    return None
