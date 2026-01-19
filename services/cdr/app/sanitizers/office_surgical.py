import io
import os
import zipfile
import tempfile
import shutil
import xml.etree.ElementTree as ET
from typing import Optional, BinaryIO
from .base import BaseSanitizer

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

    def sanitize(self, input_file: BinaryIO) -> Optional[bytes]:
        temp_dir = tempfile.mkdtemp()
        try:
            # 1. Unzip
            with zipfile.ZipFile(input_file, 'r') as zf:
                zf.extractall(temp_dir)

            # 2. Iterate and Clean
            self._clean_directory(temp_dir)

            # 3. Rezip
            output_buffer = io.BytesIO()
            with zipfile.ZipFile(output_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        zf.write(file_path, arcname)
            
            return output_buffer.getvalue()

        except zipfile.BadZipFile:
            print("[Office] Not a valid zip file")
            return None
        except Exception as e:
            print(f"[Office] Error: {e}")
            return None
        finally:
            shutil.rmtree(temp_dir)

    def _clean_directory(self, root_dir: str):
        # First, find and remove dangerous files (Macros)
        # vbaProject.bin, vbaData.xml, etc.
        files_to_remove = []
        for root, dirs, files in os.walk(root_dir):
            for file in files:
                if file.lower().endswith('.bin') or 'vba' in file.lower():
                    # Likely a macro project. Remove it.
                    files_to_remove.append(os.path.join(root, file))
                elif file.lower().endswith('.xml') or file.lower().endswith('.rels'):
                    # Sanitize XML
                     self._sanitize_xml(os.path.join(root, file))
        
        for f in files_to_remove:
            print(f"[Office] Removing active content file: {os.path.basename(f)}")
            os.remove(f)

    def _sanitize_xml(self, file_path: str):
        try:
            # Register namespaces to avoid excessive ns0 prefixes
            for prefix, uri in NAMESPACES.items():
                ET.register_namespace(prefix, uri)
                
            tree = ET.parse(file_path)
            root = tree.getroot()
            modified = False

            # Dangerous tags to strip
            # We match local names because prefixes can vary
            dangerous_tags = ['oleObject', 'activeX', 'script', 'control', 'object', 'embed']

            # Helper to check and remove recursively
            # Since removing while iterating is tricky, we collect removals
            # But XML is a tree, so we need to traverse.
            
            # Simple iteration for first level depth or use recursive walker
            # ET doesn't have a simple "remove if matches" recursive method.
            # We assume iterating all elements.
            
            parent_map = {c: p for p in tree.iter() for c in p}
            
            elements_to_remove = []
            for elem in tree.iter():
                # Check tag name (ignoring namespace)
                tag_name =  elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                
                if tag_name in dangerous_tags:
                    elements_to_remove.append(elem)
                
                # Also check for 'v:shape' with 'type' pointing to OLE
                # or similar attributes
            
            for elem in elements_to_remove:
                if elem in parent_map:
                    parent = parent_map[elem]
                    parent.remove(elem)
                    modified = True
                    print(f"[Office] Removed dangerous tag: {elem.tag} in {os.path.basename(file_path)}")

            if modified:
                tree.write(file_path, encoding='utf-8', xml_declaration=True)

        except ET.ParseError:
            # Not well-formed XML, possibly binary or simple text, ignore
            pass
        except Exception as e:
            print(f"[Office] XML Warning in {os.path.basename(file_path)}: {e}")

