import zipfile
import io
import os
try:
    import py7zr
except ImportError:
    py7zr = None

class ArchiveRepacker:
    def __init__(self, file_type: str):
        self.file_type = file_type

    def repack(self, source_dir: str, output_buffer: io.BytesIO):
        if "7z" in self.file_type:
             self._repack_7z(source_dir, output_buffer)
        else:
             # Default to ZIP
             self._repack_zip(source_dir, output_buffer)

    def _repack_zip(self, source_dir: str, output_buffer: io.BytesIO):
        with zipfile.ZipFile(output_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Create relative path
                    arcname = os.path.relpath(file_path, source_dir)
                    zf.write(file_path, arcname)

    def _repack_7z(self, source_dir: str, output_buffer: io.BytesIO):
         if py7zr is None:
             print("[Archive] py7zr missing during repack.")
             return

         try:
            with py7zr.SevenZipFile(output_buffer, 'w') as z:
                # Write all files
                for root, dirs, files in os.walk(source_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, source_dir)
                        z.write(file_path, arcname)
         except Exception as e:
             print(f"Repack 7z error: {e}")
