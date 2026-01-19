import abc
from typing import Optional, BinaryIO, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.models import SanitizationPolicy, SanitizationReport

class BaseSanitizer(abc.ABC):
    """
    Abstract base class for all file sanitizers.
    """

    @abc.abstractmethod
    def sanitize(self, input_file: BinaryIO, policy: 'SanitizationPolicy') -> Tuple[Optional[bytes], 'SanitizationReport']:
        """
        Sanitize the input file and return the sanitized content and a report.
        
        Args:
            input_file: A file-like object (binary mode) containing the original file.
            policy: Configuration for the sanitization process.
            
        Returns:
            Tuple containing:
            - The sanitized file content as bytes (or None if failed/blocked).
            - A SanitizationReport object detailing actions taken.
        """
        pass
