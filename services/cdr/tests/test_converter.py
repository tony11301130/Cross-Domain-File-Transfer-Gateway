
import unittest
from unittest.mock import patch, MagicMock, mock_open
import sys
import os

# Mock img2pdf if not installed
sys.modules["img2pdf"] = MagicMock()

# Adjust path to import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.converter import SafeConverter
from app.sanitizers.fallback import FallbackSanitizer
from app.core.models import SanitizationPolicy, ActionEnum

class TestSafeConverter(unittest.TestCase):
    
    @patch("app.core.converter.subprocess.run")
    def test_to_pdf_success(self, mock_run):
        converter = SafeConverter()
        mock_run.return_value = MagicMock(returncode=0)
        
        # Mock Path.exists to return True for the expected PDF
        with patch("app.core.converter.Path.exists", return_value=True):
            pdf_path = converter.to_pdf("test.docx", "/tmp")
            
        self.assertTrue(pdf_path.endswith(".pdf"))
        mock_run.assert_called_once()
        cmd_args = mock_run.call_args[0][0]
        self.assertIn("soffice", cmd_args)
        self.assertIn("--convert-to", cmd_args)

    @patch("app.core.converter.subprocess.run")
    @patch("app.core.converter.glob.glob")
    def test_rasterize_pdf_success(self, mock_glob, mock_run):
        converter = SafeConverter()
        mock_run.return_value = MagicMock(returncode=0)
        mock_glob.return_value = ["/tmp/page-1.png", "/tmp/page-2.png"]
        
        images = converter.rasterize_pdf("test.pdf", "/tmp")
        
        self.assertEqual(len(images), 2)
        mock_run.assert_called_once()
        self.assertIn("pdftoppm", mock_run.call_args[0][0])

    @patch("app.core.converter.img2pdf.convert")
    def test_reconstruct_pdf(self, mock_convert):
        converter = SafeConverter()
        mock_convert.return_value = b"%PDF-1.4..."
        
        with patch("builtins.open", mock_open()) as mock_file:
            converter.reconstruct_pdf(["img1.png"], "output.pdf")
            
        mock_file().write.assert_called_once()

    @patch("app.core.converter.SafeConverter.to_pdf")
    @patch("app.core.converter.SafeConverter.rasterize_pdf")
    @patch("app.core.converter.SafeConverter.reconstruct_pdf")
    @patch("app.core.converter.tempfile.TemporaryDirectory")
    def test_process_integrated(self, mock_temp_dir, mock_reconstruct, mock_rasterize, mock_to_pdf):
        # Setup logic
        # Use a path that allows mkdir to verify flow, or mock mkdir.
        # But we are running logic that calls mkdir. 
        # Easier to specificy a path that DOES exist or mock mkdir of Path.
        # Let's mock mkdir by patching Path.mkdir on the object
        
        # Actually, let's just use a real temp dir for the logic, or mock the mkdir call.
        # But wait, we mocked TemporaryDirectory, so the context manager yields a string.
        # We need to ensure that string is valid if we want real FS ops, or mock FS ops.
        # Since we didn't mock Path completely, it tries real FS.
        
        # Solution: Mock Path.mkdir
        with patch("app.core.converter.Path.mkdir") as mock_mkdir:
            mock_temp_dir.return_value.__enter__.return_value = "dummy_temp"
            mock_to_pdf.return_value = "dummy_temp/intermediate.pdf"
            mock_rasterize.return_value = ["img1.png"]
            
            converter = SafeConverter()
            
            # Test non-PDF input triggering conversion
            converter.process("suspicious.doc", "final.pdf")
            
            mock_to_pdf.assert_called_once()
            mock_rasterize.assert_called_once()
            mock_reconstruct.assert_called_once()
            mock_mkdir.assert_called()


class TestFallbackSanitizer(unittest.TestCase):

    @patch("app.sanitizers.fallback.SafeConverter")
    def test_fallback_flow(self, MockConverter):
        # Setup Mock
        mock_instance = MockConverter.return_value
        mock_instance.process.return_value = True
        
        sanitizer = FallbackSanitizer()
        policy = SanitizationPolicy(fallback_enabled=True)
        
        # Mock file input
        input_file = MagicMock()
        input_file.read.return_value = b"dangerous content"
        
        # Mock file system inside sanitize
        with patch("app.sanitizers.fallback.tempfile.TemporaryDirectory") as mock_tmp:
            mock_tmp.return_value.__enter__.return_value = "/tmp/fallback"
            
            # Need to mock open to handle reading the 'result'
            with patch("builtins.open", mock_open(read_data=b"clean_pdf_bytes")) as mock_file:
                # Also need shutil.copyfileobj to not crash
                with patch("app.sanitizers.fallback.shutil.copyfileobj"):
                    result, report = sanitizer.sanitize(input_file, policy)
        
        self.assertEqual(result, b"clean_pdf_bytes")
        self.assertTrue(report.is_safe)
        self.assertEqual(len(report.logs), 2)
        self.assertEqual(report.logs[1].action, ActionEnum.RECONSTRUCT)

if __name__ == '__main__':
    unittest.main()
