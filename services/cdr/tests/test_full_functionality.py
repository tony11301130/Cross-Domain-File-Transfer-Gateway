
import unittest
from unittest.mock import patch, MagicMock, mock_open
import io
import sys
import os

# Mock modules that might be missing in local env
sys.modules["img2pdf"] = MagicMock()

# Adjust path to import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.engine import get_sanitizer
from app.core.models import SanitizationPolicy, ActionEnum

class TestFullCDRFunctionality(unittest.TestCase):
    
    def setUp(self):
        self.policy = SanitizationPolicy()

    @patch("app.sanitizers.pdf.pikepdf.open")
    def test_pdf_surgical(self, mock_uc):
        print("\nTesting PDF Surgical...")
        sanitizer = get_sanitizer("application/pdf")
        self.assertIsNotNone(sanitizer)
        
        # Mock PDF structure
        mock_pdf = MagicMock()
        mock_pdf.pages = [MagicMock(), MagicMock()]
        mock_pdf.Root = {}
        mock_uc.return_value = mock_pdf
        
        input_data = io.BytesIO(b"%PDF-1.4 dummy")
        result, report = sanitizer.sanitize(input_data, self.policy)
        
        self.assertTrue(report.is_safe)
        self.assertEqual(report.method_used, "surgical")
        print("PDF Surgical: OK")
        
    @patch("app.sanitizers.office_surgical.ArchiveExtractor")
    @patch("app.sanitizers.office_surgical.ArchiveRepacker")
    @patch("app.sanitizers.office_surgical.tempfile.mkdtemp")
    @patch("app.sanitizers.office_surgical.shutil.copyfileobj")
    @patch("app.sanitizers.office_surgical.shutil.rmtree")
    @patch("app.sanitizers.office_surgical.os.walk")
    @patch("app.sanitizers.office_surgical.os.path.exists")
    @patch("app.sanitizers.office_surgical.os.remove")
    def test_office_surgical(self, mock_remove, mock_exists, mock_walk, mock_rmtree, mock_copy, mock_mkdtemp, MockRepacker, MockExtractor):
        print("\nTesting Office Surgical...")
        sanitizer = get_sanitizer("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.assertIsNotNone(sanitizer)
        
        mock_mkdtemp.return_value = "dummy_tmp_dir"
        MockExtractor.return_value.safe_extract.return_value = True
        mock_exists.return_value = True # ensure cleanup blocks run
        
        # Mock file walk finding a safe xml file
        mock_walk.return_value = [
            ("dummy_tmp_dir", [], ["document.xml"])
        ]
        
        # Mock XML parsing
        with patch("xml.etree.ElementTree.parse") as mock_et_parse:
            mock_root = MagicMock()
            mock_et_parse.return_value.iter.return_value = [] # No dangerous tags
            
            input_data = io.BytesIO(b"PK...dummy docx")
            result, report = sanitizer.sanitize(input_data, self.policy)
            
        self.assertTrue(report.is_safe)
        self.assertEqual(report.method_used, "surgical")
        print("Office Surgical: OK")

    @patch("app.sanitizers.image.Image.open")
    def test_image_sanitizer(self, mock_img_open):
        print("\nTesting Image Sanitizer...")
        sanitizer = get_sanitizer("image/png")
        self.assertIsNotNone(sanitizer)
        
        mock_img = MagicMock()
        mock_img.format = "PNG"
        mock_img.mode = "RGB"
        mock_img.size = (100, 100) # Required for Image.new
        mock_img.getdata.return_value = [] 
        mock_img_open.return_value = mock_img
        
        input_data = io.BytesIO(b"fake png")
        result, report = sanitizer.sanitize(input_data, self.policy)
        
        self.assertTrue(report.is_safe)
        self.assertEqual(report.method_used, "surgical")
        print("Image Sanitizer: OK")

    def test_html_sanitizer(self):
        print("\nTesting HTML Sanitizer...")
        sanitizer = get_sanitizer("text/html")
        self.assertIsNotNone(sanitizer)
        
        html_content = b"<html><script>alert('xss')</script><body>Hello</body></html>"
        input_data = io.BytesIO(html_content)
        
        result, report = sanitizer.sanitize(input_data, self.policy)
        
        self.assertTrue(report.is_safe)
        self.assertEqual(report.method_used, "surgical")
        self.assertNotIn(b"<script>", result)
        self.assertIn(b"Hello", result)
        # Check logs
        self.assertTrue(any(l.action == ActionEnum.CLEAN for l in report.logs))
        print("HTML Sanitizer: OK")

    @patch("app.sanitizers.archive.sanitizer.ArchiveExtractor")
    @patch("app.sanitizers.archive.sanitizer.ArchiveRepacker")
    @patch("app.sanitizers.archive.sanitizer.tempfile.mkdtemp")
    @patch("app.sanitizers.archive.sanitizer.shutil.copyfileobj")
    @patch("app.sanitizers.archive.sanitizer.shutil.rmtree")
    @patch("app.sanitizers.archive.sanitizer.os.walk")
    @patch("app.sanitizers.archive.sanitizer.magic.Magic")
    @patch("app.sanitizers.archive.sanitizer.os.path.exists")
    def test_archive_recursive(self, mock_exists, mock_magic, mock_walk, mock_rmtree, mock_copy, mock_mkdtemp, MockRepacker, MockExtractor):
        print("\nTesting Archive Recursive...")
        sanitizer = get_sanitizer("application/zip")
        self.assertIsNotNone(sanitizer)
        
        mock_mkdtemp.return_value = "dummy_zip_temp"
        MockExtractor.return_value.safe_extract.return_value = True
        mock_exists.return_value = True
        
        # Setup specific recursive case: Zip containing an HTML file
        mock_walk.return_value = [
            ("dummy_zip_temp", [], ["bad.html"])
        ]
        
        # Mock Magic to identify the inner file as HTML
        mock_mime = MagicMock()
        mock_mime.from_file.return_value = "text/html"
        mock_magic.return_value = mock_mime
        
        # Mock file reading for inner file
        with patch("builtins.open", mock_open(read_data=b"<script>bad</script>")):
             # Mock os.remove to do nothing
             with patch("app.sanitizers.archive.sanitizer.os.remove"):
                 input_data = io.BytesIO(b"PK...")
                 result, report = sanitizer.sanitize(input_data, self.policy)
        
        self.assertTrue(report.is_safe)
        # Verify nested log exists
        nested_logs = [l for l in report.logs if "Nested:bad.html" in l.component]
        self.assertTrue(len(nested_logs) > 0)
        print("Archive Recursive: OK")

    def test_email_sanitizer(self):
        print("\nTesting Email Sanitizer...")
        sanitizer = get_sanitizer("message/rfc822")
        self.assertIsNotNone(sanitizer)
        
        # Construct a raw email with HTML body
        raw_email = (
            b"Subject: Test\r\n"
            b"Content-Type: text/html\r\n\r\n"
            b"<html><script>evil()</script><body>Safe</body></html>"
        )
        input_data = io.BytesIO(raw_email)
        
        result, report = sanitizer.sanitize(input_data, self.policy)
        
        self.assertTrue(report.is_safe)
        self.assertNotIn(b"<script>", result)
        self.assertIn(b"Safe", result)
        print("Email Sanitizer: OK")
        
    @patch("app.sanitizers.fallback.SafeConverter")
    def test_fallback_integration(self, MockConverter):
        print("\nTesting Fallback Integration via Policy...")
        # Force fallback policy
        self.policy.force_fallback = True
        
        from app.sanitizers.fallback import FallbackSanitizer
        sanitizer = FallbackSanitizer()
        
        MockConverter.return_value.process.return_value = True
        
        with patch("app.sanitizers.fallback.tempfile.TemporaryDirectory") as mock_tmp:
            mock_tmp.return_value.__enter__.return_value = "dummy_fb_path"
            with patch("builtins.open", mock_open(read_data=b"%PDF-Reconstructed")):
                 input_data = io.BytesIO(b"bad.doc")
                 result, report = sanitizer.sanitize(input_data, self.policy)

        self.assertTrue(report.is_safe)
        self.assertEqual(report.method_used, "fallback")
        print("Fallback Integration: OK")


if __name__ == '__main__':
    unittest.main()
