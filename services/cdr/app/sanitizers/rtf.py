import re
from typing import Optional, BinaryIO, Tuple
from .base import BaseSanitizer
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum

class RtfSanitizer(BaseSanitizer):
    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy, password: Optional[str] = None) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            content = input_file.read()
            # RTF is 7-bit ASCII usually, but can have bytes. 
            # We treat it as bytes mostly, but parse control words.
            
            # Simple recursive descent logic to strip {\object ...} groups
            sanitized, count = self._strip_dangerous_groups(content)
            
            if count > 0:
                 report.add_log(ActionEnum.REMOVE, f"Removed {count} dangerous groups (object/objdata/datastore)", "RTF_Object")
            else:
                 report.add_log(ActionEnum.PASS, "No dangerous objects found", "RTF_Structure")

            report.is_safe = True
            report.method_used = "surgical"
            return sanitized, report
        except Exception as e:
            print(f"[RTF] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

    def _strip_dangerous_groups(self, data: bytes) -> Tuple[bytes, int]:
        # Dangerous control words that start a group
        # \object, \objdata, \datastore, \do (drawn object)
        DANGEROUS_WORDS = [b'\\object', b'\\objdata', b'\\datastore', b'\\do']
        
        output = bytearray()
        i = 0
        length = len(data)
        removed_count = 0
        
        # We process the file copying safe parts to output
        # If we encounter a group '{', we check if it starts with dangerous word.
        # If so, we skip that group.
        
        while i < length:
            char = data[i]
            
            if char == ord('{'):
                # Check next few chars to see if it's a dangerous group
                is_dangerous = False
                # Look ahead for control word
                # Skip '{'
                j = i + 1
                while j < length and data[j] in [ord('\r'), ord('\n'), ord(' ')]:
                    j += 1 # skip whitespace? usually control word follows immediately or after \
                
                # Check for control word
                # This is a heuristic. RTF is complex. 
                # DocBleach removes the whole group if it contains invalid/dangerous content.
                # Here we try to detect if the group START is dangerous.
                
                # Check if matches any dangerous word
                rest = data[j:]
                for word in DANGEROUS_WORDS:
                    if rest.startswith(word):
                        is_dangerous = True
                        break
                
                if is_dangerous:
                    removed_count += 1
                    # Skip this group
                    # We need to find the matching '}' taking nesting into account
                    depth = 1
                    k = i + 1
                    while k < length and depth > 0:
                        if data[k] == ord('{'):
                            depth += 1
                        elif data[k] == ord('}'):
                            depth -= 1
                        k += 1
                    
                    # k is now past the closing '}'
                    i = k
                    # Continue loop, do not append to output
                    continue
                else:
                    output.append(char)
                    i += 1
            else:
                output.append(char)
                i += 1
                
        return bytes(output), removed_count

