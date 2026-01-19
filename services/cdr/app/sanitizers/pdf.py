import io
import pikepdf
from typing import Optional, BinaryIO
from .base import BaseSanitizer

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
