import io
import pikepdf
from typing import Optional, BinaryIO, Tuple
from .base import BaseSanitizer
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum

class PDFSanitizer(BaseSanitizer):
    def sanitize(self, input_file: BinaryIO, policy: SanitizationPolicy, password: Optional[str] = None) -> Tuple[Optional[bytes], SanitizationReport]:
        report = SanitizationReport()
        try:
            # Using pikepdf (QPDF based) for robust structural cleaning
            try:
                pdf = pikepdf.open(input_file, password=password if password else "")
            except (pikepdf.PasswordError, pikepdf.EncryptionError):
                report.add_log(ActionEnum.NEED_PASSWORD, "PDF is password protected", "Encryption")
                report.requires_password = True
                return None, report
            
            # 1. Remove JavaScript
            # Iterate all names and remove /JS or /JavaScript
            # pikepdf handles this by allowing access to root.
            try:
                if "/Names" in pdf.Root and "/JavaScript" in pdf.Root.Names:
                    del pdf.Root.Names["/JavaScript"]
                    report.add_log(ActionEnum.REMOVE, "Removed /JavaScript from Names", "JavaScript")
                
                if "/OpenAction" in pdf.Root:
                    del pdf.Root["/OpenAction"]
                    report.add_log(ActionEnum.REMOVE, "Removed /OpenAction from Root", "OpenAction")

                if "/AA" in pdf.Root: # Additional Actions
                    del pdf.Root["/AA"]
                    report.add_log(ActionEnum.REMOVE, "Removed /AA from Root", "AA")

            except Exception as e:
                print(f"[PDF] Root cleaning warning: {e}")
                report.add_log(ActionEnum.FAIL, f"Root cleaning error: {e}", "Structure")

            # 2. Iterate Pages
            for i, page in enumerate(pdf.pages):
                page_num = i + 1
                # Remove Page Actions
                if "/AA" in page:
                    del page["/AA"]
                    report.add_log(ActionEnum.REMOVE, "Removed /AA (Additional Actions)", f"Page {page_num}")
                
                if "/JS" in page:
                     del page["/JS"]
                     report.add_log(ActionEnum.REMOVE, "Removed /JS", f"Page {page_num}")
                
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
                                     report.add_log(ActionEnum.REMOVE, f"Removed risky annotation action: {subtype}", f"Page {page_num}")
                                     continue # Dangerous
                         
                         safe_annots.append(annot)
                    
                    if len(page.Annots) != len(safe_annots):
                         page.Annots = safe_annots
 
            # 3. Save with linearize (Fast Web View) -> reconstructs XREF table
            # and strips unused objects.
            output_buffer = io.BytesIO()
            pdf.save(output_buffer, linearize=True)
            
            report.is_safe = True
            report.method_used = "surgical"
            return output_buffer.getvalue(), report
            
        except Exception as e:
            print(f"[PDFSanitizer] Error: {e}")
            report.add_log(ActionEnum.FAIL, str(e), "Processing")
            return None, report

