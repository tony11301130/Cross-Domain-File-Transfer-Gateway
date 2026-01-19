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
