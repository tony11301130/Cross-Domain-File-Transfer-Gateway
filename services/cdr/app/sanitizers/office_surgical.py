import io
import os
import shutil
import tempfile
import xml.etree.ElementTree as ET
from typing import Optional, BinaryIO, Tuple
from .base import BaseSanitizer
from .archive.extractor import ArchiveExtractor
from .archive.repacker import ArchiveRepacker
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum
from app.core.exceptions import PasswordRequiredError

# XML Namespaces typically found in OOXML
NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    's': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'v': 'urn:schemas-microsoft-com:vml',
    'o': 'urn:schemas-microsoft-com:office:office',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

class SurgicalOfficeSanitizer(BaseSanitizer):
    def __init__(self, mime_type: str):
        self.mime_type = mime_type
        # Reuse Archive components (Office files are ZIPs)
        self.extractor = ArchiveExtractor(mime_type)
        self.repacker = ArchiveRepacker(mime_type)

    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy, password: Optional[str] = None) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        temp_dir = tempfile.mkdtemp()
        temp_in_path = None
        
        try:
            # Save input to temp file (Extractor needs path)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_in:
                shutil.copyfileobj(input_file, tmp_in)
                temp_in_path = tmp_in.name

            # 1. Unzip with security checks (Zip Bomb, etc)
            try:
                if not self.extractor.safe_extract(temp_in_path, temp_dir, password=password):
                    print("[Office] Extraction failed or unsafe file.")
                    report.add_log(ActionEnum.BLOCK, "Unsafe archive structure (ZipBomb?)", "Structure")
                    report.is_safe = False
                    return None, report
            except PasswordRequiredError as e:
                report.add_log(ActionEnum.NEED_PASSWORD, str(e), "Encryption")
                report.requires_password = True
                return None, report

            # 2. Iterate and Clean
            self._clean_directory(temp_dir, policy, report)

            # 3. Rezip
            output_buffer = io.BytesIO()
            self.repacker.repack(temp_dir, output_buffer)
            
            report.is_safe = True
            report.method_used = "surgical"
            return output_buffer.getvalue(), report

        except Exception as e:
            print(f"[Office] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report
        finally:
            if temp_in_path and os.path.exists(temp_in_path):
                os.remove(temp_in_path)
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    def _clean_directory(self, root_dir: str, policy: SanitizationPolicy, report: SanitizationReport):
        # First, find and remove dangerous files (Macros)
        # vbaProject.bin, vbaData.xml, etc.
        files_to_remove = []
        for root, dirs, files in os.walk(root_dir):
            for file in files:
                if file.lower().endswith('.bin') or 'vba' in file.lower():
                    if not policy.allow_macros:
                        # Likely a macro project. Remove it.
                        files_to_remove.append(os.path.join(root, file))
                    else:
                        report.add_log(ActionEnum.PASS, f"Macros allowed by policy: {file}", "Macro")

                elif file.lower().endswith('.xml') or file.lower().endswith('.rels'):
                    # Sanitize XML
                     self._sanitize_xml(os.path.join(root, file), report)
        
        for f in files_to_remove:
            fname = os.path.basename(f)
            print(f"[Office] Removing active content file: {fname}")
            report.add_log(ActionEnum.REMOVE, f"Removed active content file: {fname}", "Macro")
            os.remove(f)

    def _sanitize_xml(self, file_path: str, report: SanitizationReport):
        try:
            # Register namespaces to avoid excessive ns0 prefixes
            for prefix, uri in NAMESPACES.items():
                ET.register_namespace(prefix, uri)
                
            tree = ET.parse(file_path)
            # root = tree.getroot() # Unused
            modified = False

            # Dangerous tags to strip
            # We match local names because prefixes can vary
            dangerous_tags = ['oleObject', 'activeX', 'script', 'control', 'object', 'embed']

            # Helper to check and remove recursively
            # Since removing while iterating is tricky, we collect removals
            # But XML is a tree, so we need to traverse.
            
            parent_map = {c: p for p in tree.iter() for c in p}
            
            elements_to_remove = []
            for elem in tree.iter():
                # Check tag name (ignoring namespace)
                tag_name =  elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                
                if tag_name in dangerous_tags:
                    elements_to_remove.append(elem)
                
            for elem in elements_to_remove:
                if elem in parent_map:
                    parent = parent_map[elem]
                    parent.remove(elem)
                    modified = True
                    fname = os.path.basename(file_path)
                    print(f"[Office] Removed dangerous tag: {elem.tag} in {fname}")
                    report.add_log(ActionEnum.REMOVE, f"Removed {elem.tag} from {fname}", "ActiveObject")

            if modified:
                tree.write(file_path, encoding='utf-8', xml_declaration=True)

        except ET.ParseError:
            # Not well-formed XML, possibly binary or simple text, ignore
            pass
        except Exception as e:
            print(f"[Office] XML Warning in {os.path.basename(file_path)}: {e}")
            report.add_log(ActionEnum.FAIL, f"XML parsing error in {os.path.basename(file_path)}: {e}", "XML")


