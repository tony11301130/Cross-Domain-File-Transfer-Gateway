
import io
import copy
from typing import Optional, BinaryIO
from PIL import Image
from docx import Document
import openpyxl
from pptx import Presentation
import pikepdf
from engine import BaseSanitizer

class ImageSanitizer(BaseSanitizer):
    def sanitize(self, input_file: BinaryIO) -> Optional[bytes]:
        try:
            img = Image.open(input_file)
            original_format = img.format
            if not original_format:
                original_format = "PNG"
            
            # Convert to RGB to ensure compatibility and strip alpha channels if needed
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            
            # Create a new image with the same data but NO metadata
            # We copy pixel data to a fresh image object
            clean_img = Image.new(img.mode, img.size)
            clean_img.putdata(list(img.getdata()))
            
            # Save to buffer without metadata
            final_buffer = io.BytesIO()
            # 'optimize=True' often strips extra data
            clean_img.save(final_buffer, format=original_format, optimize=True)
            final_buffer.seek(0)
            
            return final_buffer.getvalue()
        except Exception as e:
            print(f"[ImageSanitizer] Error: {e}")
            return None

class OfficeSanitizer(BaseSanitizer):
    def __init__(self, file_type: str):
        self.file_type = file_type

    def sanitize(self, input_file: BinaryIO) -> Optional[bytes]:
        try:
            output_buffer = io.BytesIO()
            
            if "wordprocessingml" in self.file_type: # docx
                doc = Document(input_file)
                # python-docx does not support OLE manipulation directly easily, 
                # but saving it REWRITES the XML, effectively dropping unknown parts (like binary OLE) 
                # if they aren't explicitly referenced/supported.
                # However, to be safer, we can iterate and remove specific relations if possible, 
                # but for this PoC, the "Repackaging" provided by save() is the primary method.
                # Ideally we would inspect 'doc.part.rels' for dangerous relationships.
                doc.save(output_buffer)
                
            elif "spreadsheetml" in self.file_type: # xlsx
                # keep_vba=False defaults to dropping macros.
                # data_only=True would perform calc and drop formulas (extreme sanitization), 
                # but might break usability. Let's stick to keep_vba=False.
                wb = openpyxl.load_workbook(input_file, keep_vba=False)
                # We can explicitly remove Defined Names which often hide malware
                if hasattr(wb, 'defined_names'):
                     # Clear defined names logic if possible, simplified here
                     pass
                wb.save(output_buffer)
                
            elif "presentationml" in self.file_type: # pptx
                prs = Presentation(input_file)
                # Similar to docx, saving repackages the XML.
                prs.save(output_buffer)
                
            else:
                return None

            return output_buffer.getvalue()
        except Exception as e:
            print(f"[OfficeSanitizer] Error: {e}")
            return None

class PDFSanitizer(BaseSanitizer):
    def sanitize(self, input_file: BinaryIO) -> Optional[bytes]:
        try:
            # Using pikepdf (QPDF based) for robust structural cleaning
            pdf = pikepdf.open(input_file)
            
            # 1. Remove JavaScript
            # Iterate all names and remove /JS or /JavaScript
            # pikepdf handles this by allowing access to root.
            try:
                if "/Names" in pdf.Root and "/JavaScript" in pdf.Root.Names:
                    del pdf.Root.Names["/JavaScript"]
                if "/OpenAction" in pdf.Root:
                    del pdf.Root["/OpenAction"]
                if "/AA" in pdf.Root: # Additional Actions
                    del pdf.Root["/AA"]
            except Exception as e:
                print(f"[PDF] Root cleaning warning: {e}")

            # 2. Iterate Pages
            for page in pdf.pages:
                # Remove Page Actions
                if "/AA" in page:
                    del page["/AA"]
                if "/JS" in page:
                     del page["/JS"]
                
                # Check Annotations
                if "/Annots" in page:
                    annots = page["/Annots"]
                    # We need to filter safe annotations. 
                    # For simplicity in this robust version, we inspect each.
                    # It's hard to modify array in place while iterating, so we rebuild it.
                    safe_annots = []
                    for annot in annots:
                         # check if annot has Action
                         if "/A" in annot:
                             action = annot.get("/A")
                             # If action type is JS, Launch, ImportData, SubmitForm -> Skip it
                             if "/S" in action:
                                 subtype = str(action.get("/S"))
                                 if any(x in subtype for x in ["JavaScript", "Launch", "ImportData", "SubmitForm", "RichMedia"]):
                                     continue # Dangerous
                         
                         safe_annots.append(annot)
                    
                    page.Annots = safe_annots

            # 3. Save with linearize (Fast Web View) -> reconstructs XREF table
            # and strips unused objects.
            output_buffer = io.BytesIO()
            pdf.save(output_buffer, linearize=True)
            return output_buffer.getvalue()
            
        except Exception as e:
            print(f"[PDFSanitizer] Error: {e}")
            return None
