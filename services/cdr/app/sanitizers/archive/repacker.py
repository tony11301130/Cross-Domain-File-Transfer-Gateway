import io
import os
from typing import Optional
try:
    import pyzipper as zipfile
except ImportError:
    import zipfile
try:
    import py7zr
except ImportError:
    py7zr = None

class ArchiveRepacker:
    def __init__(self, file_type: str):
        self.file_type = file_type

    def repack(self, source_dir: str, output_buffer: io.BytesIO, password: Optional[str] = None):
        if "7z" in self.file_type:
             self._repack_7z(source_dir, output_buffer, password)
        else:
             # Default to ZIP
             self._repack_zip(source_dir, output_buffer, password)

    def _repack_zip(self, source_dir: str, output_buffer: io.BytesIO, password: Optional[str] = None):
        compression = zipfile.ZIP_DEFLATED
        encryption = None
        
        if password:
            # Prefer AES encryption if pyzipper is available
            if hasattr(zipfile, 'AES_ZipCrypto'):
                 # pyzipper
                 encryption = zipfile.WZ_AES
            else:
                 # standard zipfile only supports ZipCrypto (weak) but better than nothing
                 pass 

        # If using pyzipper, we can pass encryption arg
        if encryption:
            with zipfile.ZipFile(output_buffer, "w", compression=compression, encryption=encryption) as zf:
                if password:
                    zf.setpassword(password.encode())
                
                for root, dirs, files in os.walk(source_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, source_dir)
                        zf.write(file_path, arcname)
        else:
            # Standard zipfile fallback
            with zipfile.ZipFile(output_buffer, "w", compression=compression) as zf:
                if password:
                    # Note: standard zipfile write() doesn't officially support encryption easily 
                    # for creating new files unless using setpassword on extract. 
                    # Actually standard python zipfile write DOES NOT support creating encrypted zips.
                    # We rely on pyzipper for this feature.
                    print("[Archive] Warning: Standard zipfile cannot encrypt. Install pyzipper.")
                    pass 
                
                for root, dirs, files in os.walk(source_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, source_dir)
                        zf.write(file_path, arcname)

    def _repack_7z(self, source_dir: str, output_buffer: io.BytesIO, password: Optional[str] = None):
         if py7zr is None:
             print("[Archive] py7zr missing during repack.")
             return

         try:
            # py7zr supports password in constructor
            with py7zr.SevenZipFile(output_buffer, 'w', password=password) as z:
                # Write all files
                for root, dirs, files in os.walk(source_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, source_dir)
                        z.write(file_path, arcname)
         except Exception as e:
             print(f"Repack 7z error: {e}")
