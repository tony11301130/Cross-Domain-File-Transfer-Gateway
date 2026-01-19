import os
import subprocess
import tempfile
import logging
import glob
from pathlib import Path
from typing import List, Optional
import img2pdf

logger = logging.getLogger(__name__)

class SafeConverter:
    """
    Implements a Dangerzone-like pipeline:
    1. Convert anything to PDF
    2. Render PDF to Pixels (Images) -> sanitizes logic
    3. Reconstruct PDF from Pixels
    """
    
    def __init__(self):
        pass

    def _run_command(self, cmd: List[str], timeout: int = 300):
        try:
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=timeout,
                check=True
            )
            return result
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed: {' '.join(cmd)}")
            logger.error(f"Stderr: {e.stderr}")
            raise RuntimeError(f"Conversion command failed: {e.stderr}")
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out: {' '.join(cmd)}")
            raise TimeoutError(f"Conversion command timed out after {timeout}s")

    def to_pdf(self, input_path: str, output_dir: str) -> str:
        """
        Converts the input file to PDF using LibreOffice.
        Returns the path to the generated PDF.
        """
        file_path = Path(input_path)
        
        # If it's already a PDF, just copy it or return it?
        # Better to normalize it through LibreOffice to handle weird PDFs or just return path if it's strictly PDF.
        # However, LibreOffice is good at normalizing.
        
        cmd = [
            "soffice",
            "--headless",
            "--convert-to", "pdf",
            "--outdir", output_dir,
            str(file_path)
        ]
        
        logger.info(f"Converting {input_path} to PDF...")
        self._run_command(cmd)
        
        # Determine output filename
        # LibreOffice replaces extension with .pdf
        base_name = file_path.stem
        expected_output = Path(output_dir) / f"{base_name}.pdf"
        
        if not expected_output.exists():
            raise FileNotFoundError(f"LibreOffice failed to produce PDF at {expected_output}")
            
        return str(expected_output)

    def rasterize_pdf(self, pdf_path: str, output_dir: str) -> List[str]:
        """
        Converts a PDF into a series of images (rasterization).
        This is the airgap step.
        """
        logger.info(f"Rasterizing {pdf_path} to images...")
        
        # pdftoppm input.pdf output_prefix -png (or -jpeg)
        # -r 150 : 150 DPI is usually good balance for screen/print
        prefix = str(Path(output_dir) / "page")
        
        cmd = [
            "pdftoppm",
            pdf_path,
            prefix,
            "-png",
            "-r", "150"
        ]
        
        self._run_command(cmd)
        
        # Collect all generated images
        images = sorted(glob.glob(str(Path(output_dir) / "page-*.png")))
        if not images:
            raise RuntimeError("Rasterization produced no images")
            
        return images

    def reconstruct_pdf(self, images: List[str], output_path: str):
        """
        Combines images back into a PDF.
        """
        logger.info(f"Reconstructing PDF from {len(images)} images...")
        
        try:
            with open(output_path, "wb") as f:
                f.write(img2pdf.convert(images))
        except Exception as e:
            logger.error(f"PDF Reconstruction failed: {e}")
            raise RuntimeError(f"Failed to reconstruct PDF: {e}")

    def process(self, input_path: str, output_path: str) -> bool:
        """
        Main pipeline execution.
        """
        # Create a temporary directory for intermediate artifacts
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Step 1: Normalize to PDF
                # If input is already PDF, we still might want to pass it through soffice to normalize,
                # BUT soffice might fail on encrypted PDFs etc. 
                # Let's check extension.
                input_path_obj = Path(input_path)
                ext = input_path_obj.suffix.lower()
                
                intermediate_pdf = None
                
                # If it's an image, we can technically skip to_pdf and go straight to reconstruct 
                # (if we trust the image library) or treat it like a doc.
                # For consistency, let's treat everything not-PDF as 'needs conversion to PDF'.
                # Actually, pdftoppm ONLY takes PDF. So we MUST have a PDF.
                
                if ext == ".pdf":
                    # We use the input PDF directly for rasterization
                    intermediate_pdf = input_path
                else:
                    intermediate_pdf = self.to_pdf(input_path, temp_dir)
                
                # Step 2: Rasterize (The Airgap)
                # Create a subdir for images to avoid clutter
                img_dir = Path(temp_dir) / "images"
                img_dir.mkdir()
                images = self.rasterize_pdf(intermediate_pdf, str(img_dir))
                
                # Step 3: Reconstruct
                self.reconstruct_pdf(images, output_path)
                
                return True
                
            except Exception as e:
                logger.exception(f"Deep sanitization failed for {input_path}")
                raise e
