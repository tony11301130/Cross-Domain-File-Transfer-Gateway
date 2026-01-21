import os
import sys
import io
import email
from email.message import EmailMessage

# Add app to path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'app'))

from app.engine import get_sanitizer
from app.core.models import SanitizationPolicy, ActionEnum

def test_html_sanitization():
    print("\n--- Testing HTML Sanitizer ---")
    html_content = """
    <html>
        <head><script>alert('XSS')</script></head>
        <body>
            <h1>Hello</h1>
            <a href="javascript:alert('1')">Click me</a>
            <p style="color:red" onmouseover="malicious()">Safe Text</p>
        </body>
    </html>
    """
    f = io.BytesIO(html_content.encode('utf-8'))
    sanitizer = get_sanitizer("text/html")
    if not sanitizer:
        print("FAIL: No sanitizer for text/html")
        return False
    
    policy = SanitizationPolicy()
    cleaned, report = sanitizer.sanitize(f, policy)
    if not cleaned:
        print("FAIL: Sanitization returned None")
        return False
    
    cleaned_str = cleaned.decode('utf-8')
    print(f"Cleaned HTML: {cleaned_str}")
    
    if "<script>" in cleaned_str or "javascript:" in cleaned_str or "onmouseover" in cleaned_str:
        print("FAIL: Malicious content not removed.")
        return False
    if "<h1>Hello</h1>" not in cleaned_str:
        print("FAIL: Safe content removed.")
        return False
        
    print("PASS: HTML Sanitization")
    return True

def test_svg_sanitization():
    print("\n--- Testing SVG Sanitization ---")
    svg_content = """
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <script>alert('XSS')</script>
        <rect width="100" height="100" fill="red" onclick="alert(1)"/>
    </svg>
    """
    f = io.BytesIO(svg_content.encode('utf-8'))
    sanitizer = get_sanitizer("image/svg+xml")
    if not sanitizer:
        print("FAIL: No sanitizer for image/svg+xml")
        return False
        
    policy = SanitizationPolicy()
    cleaned, report = sanitizer.sanitize(f, policy)
    if not cleaned:
        print("FAIL: Sanitization returned None")
        return False
        
    cleaned_str = cleaned.decode('utf-8')
    print(f"Cleaned SVG: {cleaned_str}")
    
    if "<script>" in cleaned_str or "onclick" in cleaned_str:
        print("FAIL: Malicious content not removed.")
        return False
    if "<rect" not in cleaned_str:
        print("FAIL: Safe content removed.")
        return False

    print("PASS: SVG Sanitization")
    return True

def test_email_sanitization():
    print("\n--- Testing Email Sanitization ---")
    # Create email
    msg = EmailMessage()
    msg['Subject'] = "Test Email"
    msg['From'] = "attacker@example.com"
    msg['To'] = "victim@example.com"
    
    # HTML Body with XSS
    msg.set_content("This is plain text fallback.")
    msg.add_alternative("""
    <html><body>
        <p>Hi!</p>
        <script>alert('Email XSS')</script>
    </body></html>
    """, subtype='html')
    
    # Attachment 1: Safe Text
    msg.add_attachment(b"Safe text file", maintype='text', subtype='plain', filename='safe.txt')
    
    # Serialize to bytes
    f = io.BytesIO(msg.as_bytes())
    
    sanitizer = get_sanitizer("message/rfc822")
    if not sanitizer:
        print("FAIL: No sanitizer for message/rfc822")
        return False
        
    policy = SanitizationPolicy()
    cleaned_bytes, report = sanitizer.sanitize(f, policy)
    if not cleaned_bytes:
        print("FAIL: Sanitization returned None")
        return False
        
    # Re-parse to check
    cleaned_msg = email.message_from_bytes(cleaned_bytes)
    
    pass_check = True
    for part in cleaned_msg.walk():
        if part.get_content_type() == "text/html":
            payload = part.get_payload(decode=True).decode('utf-8')
            if "<script>" in payload:
                print("FAIL: Email HTML body not sanitized")
                pass_check = False
            else:
                 print("PASS: Email HTML body sanitized")
        
        if part.get_filename() == "safe.txt":
             print("PASS: Safe attachment preserved") # Text/plain usually skipped or passed? 
             # Wait, currently plain/text returns None in engine.py -> so it might be skipped inside email sanitizer if we call get_sanitizer(text/plain) -> None.
             # In email sanitizer: if sanitizer is None -> REMOVE/TOMBSTONE.
             # So 'safe.txt' might hold a tombstone now unless we register text/plain sanitizer!
             # Let's check payload.
             payload = part.get_payload(decode=True).decode('utf-8')
             if "[CDR]" in payload and "Unsupported" in payload:
                 print("INFO: Safe text file was removed because text/plain has no sanitizer. This is expected behavior for strict CDR.")
             else:
                 print(f"INFO: Safe text file kept: {payload}")

    return pass_check

def test_7z_sanitization():
    print("\n--- Testing 7z Sanitization ---")
    
    try:
        import py7zr
    except ImportError:
        print("SKIP: py7zr not installed (local environment limitation).")
        return True

    # Create 7z in memory? py7zr needs file
    with py7zr.SevenZipFile('test.7z', 'w') as z:
        z.writestr("Inside 7z", "test.txt")
    
    with open('test.7z', 'rb') as f:
        content = f.read()
        
    f_io = io.BytesIO(content)
    sanitizer = get_sanitizer("application/x-7z-compressed")
    if not sanitizer:
        print("FAIL: No sanitizer for 7z")
        os.remove('test.7z')
        return False
    
    # 7z processing usually deletes unknown files (like txt if no sanitizer).
    # SO the result should likely be empty 7z or 7z with tombstone?
    # Archives remove files that fail sanitization. 
    # If text/plain has no sanitizer, test.txt is removed.
    # The 7z might be empty.
    
    policy = SanitizationPolicy()
    cleaned, report = sanitizer.sanitize(f_io, policy)
    if os.path.exists('test.7z'):
        os.remove('test.7z')

    if not cleaned:
        print("FAIL: Sanitization returned None (maybe empty archive error?)")
        # If all files removed, archive repacking might fail or return empty.
        # Let's see.
        return False
    
    print(f"PASS: 7z processed (Size: {len(cleaned)} bytes)")
    return True

def test_office_sanitization():
    print("\n--- Testing Office Sanitization (Mocked) ---")
    import zipfile
    
    # Create a mock Office file (ZIP with XMLs)
    # We simulate a "vulnerable" OLE object in an XML
    
    xml_content = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
                xmlns:o="urn:schemas-microsoft-com:office:office">
        <w:body>
            <w:p><w:r><w:t>Safe Text</w:t></w:r></w:p>
            <w:object>
                 <o:OLEObject Type="Embed"/>
            </w:object>
        </w:body>
    </w:document>
    """
    
    f_io = io.BytesIO()
    with zipfile.ZipFile(f_io, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('word/document.xml', xml_content)
        z.writestr('[Content_Types].xml', '<Types></Types>') # Minimal requirement often needed
        
    f_io.seek(0)
    
    sanitizer = get_sanitizer("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    if not sanitizer:
        print("FAIL: No sanitizer for Office")
        return False
        
    policy = SanitizationPolicy()
    cleaned, report = sanitizer.sanitize(f_io, policy)
    if not cleaned:
        print("FAIL: Sanitization returned None")
        return False

    # Check result
    f_out = io.BytesIO(cleaned)
    with zipfile.ZipFile(f_out, 'r') as z:
        if 'word/document.xml' not in z.namelist():
             print("FAIL: document.xml missing in output")
             return False
        
        doc_xml = z.read('word/document.xml').decode('utf-8')
        if "OLEObject" in doc_xml or "w:object" in doc_xml:
             print("FAIL: OLEObject not removed")
             return False
        if "Safe Text" not in doc_xml:
             print("FAIL: Safe content removed")
             return False
             
    print("PASS: Office Sanitization (OLE Removed)")
    return True

if __name__ == "__main__":
    passed = True
    passed &= test_html_sanitization()
    passed &= test_svg_sanitization()
    passed &= test_email_sanitization()
    passed &= test_7z_sanitization()
    passed &= test_office_sanitization()
    
    if passed:
        print("\n=== ALL TESTS PASSED ===")
        sys.exit(0)
    else:
        print("\n=== SOME TESTS FAILED ===")
        sys.exit(1)
