from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import time

class ActionEnum(str, Enum):
    """
    Standardized actions taken by sanitizers.
    Renamed from Action to ActionEnum to avoid conflicts and clarity.
    """
    CLEAN = "clean"
    REMOVE = "remove"
    BLOCK = "block"
    PASS = "pass"
    FAIL = "fail"
    CONVERT = "convert"
    RECONSTRUCT = "reconstruct"
    DETECT = "detect"

class SanitizationLog(BaseModel):
    timestamp: float = Field(default_factory=time.time)
    file: Optional[str] = None
    action: ActionEnum
    details: str
    component: Optional[str] = "General"

class SanitizationReport(BaseModel):
    is_safe: bool = False
    method_used: str = "surgical" # "surgical", "fallback", "none"
    logs: List[SanitizationLog] = []

    def add_log(self, action: ActionEnum, details: str, component: str = "General", file: str = None):
        self.logs.append(SanitizationLog(
            action=action, 
            details=details,
            component=component,
            file=file
        ))

class SanitizationPolicy(BaseModel):
    """
    Configuration for sanitization strictness.
    """
    # General
    allow_unknown_types: bool = False
    fallback_enabled: bool = True     # Enable Dangerzone-like fallback
    force_fallback: bool = False      # Force fallback for all supported types
    
    # Office / PDF
    allow_macros: bool = False
    allow_hyperlinks: bool = False
    
    # Archive
    max_recursion_depth: int = 5
    max_file_size: int = 100 * 1024 * 1024 # 100MB
    
    # Images
    convert_to_format: Optional[str] = None # e.g. "png" to force conversion
    strip_metadata: bool = True

    # Email
    remove_html_body: bool = False # Force plain text
