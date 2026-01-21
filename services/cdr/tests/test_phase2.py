import os
import sys
import io
import email
from email.message import EmailMessage

# Add app to path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'app'))

from app.engine import get_sanitizer
from app.core.models import SanitizationPolicy, SanitizationReport, ActionEnum

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
    policy = SanitizationPolicy()
    
    cleaned, report = sanitizer.sanitize(f, policy)
    
    if not cleaned:
        print("FAIL: Sanitization returned None")
        return False
    
    cleaned_str = cleaned.decode('utf-8')
    print(f"Cleaned HTML: {cleaned_str}")
    print(f"Report Logs: {len(report.logs)}")
    
    if "<script>" in cleaned_str:
        print("FAIL: Script not removed")
        return False
        
    if report.logs[0].action != ActionEnum.CLEAN:
         print("FAIL: Log action incorrect")
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
    policy = SanitizationPolicy()
    
    cleaned, report = sanitizer.sanitize(f, policy)
    
    cleaned_str = cleaned.decode('utf-8')
    if "<script>" in cleaned_str:
        print("FAIL: Script not removed")
        return False
        
    # Check specific log for script removal
    script_log = next((l for l in report.logs if l.component == "SVG_Cleaner" and l.action == ActionEnum.REMOVE), None)
    if not script_log:
         print("FAIL: Missing log for script removal")
         return False

    print("PASS: SVG Sanitization")
    return True

def test_email_sanitization():
    print("\n--- Testing Email Sanitization ---")
    msg = EmailMessage()
    msg['Subject'] = "Test Email"
    msg['From'] = "attacker@example.com"
    msg['To'] = "victim@example.com"
    
    msg.set_content("Plain text fallback.")
    msg.add_alternative("""<html><body><script>alert('XSS')</script><p>Safe</p></body></html>""", subtype='html')
    msg.add_attachment(b"Safe text file", maintype='text', subtype='plain', filename='safe.txt')
    
    f = io.BytesIO(msg.as_bytes())
    sanitizer = get_sanitizer("message/rfc822")
    policy = SanitizationPolicy()
    
    cleaned_bytes, report = sanitizer.sanitize(f, policy)
    
    cleaned_msg = email.message_from_bytes(cleaned_bytes)
    
    # Check logs
    html_log = next((l for l in report.logs if "Body:HTML" in l.component and l.action == ActionEnum.CLEAN), None)
    if not html_log:
        print("FAIL: Missing HTML body log")
        return False
        
    print("PASS: Email Sanitization (Logs Validated)")
    return True

def test_office_policy():
    print("\n--- Testing Office Policy (Macro Blocking) ---")
    import zipfile
    
    # Mock Office file with "macro"
    f_io = io.BytesIO()
    with zipfile.ZipFile(f_io, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('word/vbaProject.bin', b'MALICIOUS_MACRO_CODE')
        z.writestr('[Content_Types].xml', '<Types></Types>')
        
    f_io.seek(0)
    
    sanitizer = get_sanitizer("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    
    # Case 1: Block Macros (Default)
    policy_strict = SanitizationPolicy(allow_macros=False)
    f_io.seek(0)
    cleaned1, report1 = sanitizer.sanitize(f_io, policy_strict)
    
    with zipfile.ZipFile(io.BytesIO(cleaned1), 'r') as z:
        if 'word/vbaProject.bin' in z.namelist():
            print("FAIL: Macro not removed in strict mode")
            return False
            
    removed_log = next((l for l in report1.logs if l.component == "Macro" and l.action == ActionEnum.REMOVE), None)
    if not removed_log:
        print("FAIL: Missing Macro removal log")
        return False
        
    # Case 2: Allow Macros
    policy_lax = SanitizationPolicy(allow_macros=True)
    f_io.seek(0)
    cleaned2, report2 = sanitizer.sanitize(f_io, policy_lax)
    
    with zipfile.ZipFile(io.BytesIO(cleaned2), 'r') as z:
        if 'word/vbaProject.bin' not in z.namelist():
            print("FAIL: Macro removed in lax mode")
            return False
            
    allowed_log = next((l for l in report2.logs if l.component == "Macro" and l.action == ActionEnum.PASS), None)
    if not allowed_log:
         print("FAIL: Missing Macro allowed log")
         return False

    print("PASS: Office Policy (Strict vs Lax)")
    return True

if __name__ == "__main__":
    passed = True
    passed &= test_html_sanitization()
    passed &= test_svg_sanitization()
    passed &= test_email_sanitization()
    passed &= test_office_policy()
    
    if passed:
        print("\n=== ALL PHASE 2 TESTS PASSED ===")
        sys.exit(0)
    else:
        print("\n=== PHASE 2 TESTS FAILED ===")
        sys.exit(1)
