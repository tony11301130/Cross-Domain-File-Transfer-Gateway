
import os
import sys
import glob
import time
import shutil

# Add CDR Service to path
CDR_SERVICE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../services/cdr/app'))
sys.path.insert(0, CDR_SERVICE_PATH)

from engine import get_sanitizer
from sanitizers.base import BaseSanitizer
# We need to ensure magic is available (requires python-magic-bin on Windows)
try:
    import magic
except ImportError:
    print("Error: python-magic not installed. Run 'pip install python-magic-bin'")
    sys.exit(1)

# Formatting Colors
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# On Windows ANSI might not work by default in cmd, but usually works in modern terminals. 
# If it looks bad, we can disable it.
if os.name == 'nt':
    os.system('color')
    
EICAR_STRING = b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== {text} ==={Colors.ENDC}")

def analyze_file(path):
    """
    Simple analysis to detect our known injected threats.
    In a real demo, this would use more tools.
    """
    size = os.path.getsize(path)
    threats = []
    
    with open(path, 'rb') as f:
        content = f.read()
        
    # EICAR Check
    if EICAR_STRING in content:
        threats.append("EICAR Test Signature")
        
    # PDF Checks
    if b'/JavaScript' in content or b'/JS' in content:
        threats.append("PDF JavaScript")
    if b'/OpenAction' in content:
        threats.append("PDF OpenAction")
        
    # Office Checks
    if b'vbaProject.bin' in content:
        threats.append("Office Macro (VBA)")
    if b'oleObject' in content:
        threats.append("Office OLE Object")
        
    # RTF Checks
    if b'\\object' in content:
        threats.append("RTF Embedded Object")
        
    return size, threats

def run_demo():
    print_header("CDR DEMO: Content Disarm and Reconstruction")
    print(f"Engine Path: {CDR_SERVICE_PATH}")
    
    samples_dir = os.path.join(os.path.dirname(__file__), 'samples')
    clean_dir = os.path.join(os.path.dirname(__file__), 'clean')
    
    if os.path.exists(clean_dir):
        shutil.rmtree(clean_dir)
    os.makedirs(clean_dir)
    
    files = glob.glob(os.path.join(samples_dir, '*'))
    print(f"Found {len(files)} sample files.")
    
    for file_path in files:
        filename = os.path.basename(file_path)
        print_header(f"Processing: {filename}")
        
        # 1. Analyze Original
        orig_size, orig_threats = analyze_file(file_path)
        print(f"{Colors.WARNING}[Original]{Colors.ENDC} Size: {orig_size} bytes")
        if orig_threats:
            print(f"{Colors.FAIL}[Threats Found]{Colors.ENDC} {', '.join(orig_threats)}")
        else:
            print(f"[Analysis] No obvious patterns (could be Archive or Image metadata)")

        # 2. Identify Type & Sanitize
        mime = magic.Magic(mime=True)
        file_type = mime.from_file(file_path)
        print(f"[Detected MIME] {file_type}")
        
        start_time = time.time()
        
        sanitizer = get_sanitizer(file_type)
        if not sanitizer:
            print(f"{Colors.FAIL}[Error]{Colors.ENDC} No sanitizer found for {file_type}")
            continue
            
        with open(file_path, 'rb') as f_in:
             sanitized_bytes = sanitizer.sanitize(f_in)
             
        duration = time.time() - start_time
        
        if sanitized_bytes:
            output_path = os.path.join(clean_dir, filename)
            with open(output_path, 'wb') as f_out:
                f_out.write(sanitized_bytes)
                
            # 3. Analyze Cleaned
            clean_size, clean_threats = analyze_file(output_path)
            
            print(f"{Colors.OKGREEN}[Sanitized]{Colors.ENDC} Saved to clean/{filename}")
            print(f"[Stats] Time: {duration:.4f}s | New Size: {clean_size} bytes")
            
            if clean_threats:
                print(f"{Colors.FAIL}[FAILURE]{Colors.ENDC} Threats still present: {', '.join(clean_threats)}")
            else:
                print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} File is clean.")
                
                # Special Check for Archive
                if filename.endswith(".zip"):
                    print("  [Archive Check] Inspecting contents...")
                    # We peek inside
                    with open(output_path, 'rb') as f:
                        if b'\\object' not in f.read():
                             print(f"  {Colors.OKGREEN}[PASS]{Colors.ENDC} Nested malicious RTF cleaned/removed.")
                        else:
                             print(f"  {Colors.FAIL}[FAIL]{Colors.ENDC} Nested threat detected.")
                        
                        if EICAR_STRING not in f.read():
                             print(f"  {Colors.OKGREEN}[PASS]{Colors.ENDC} Nested EICAR file removed.")
                        else:
                             print(f"  {Colors.FAIL}[FAIL]{Colors.ENDC} Nested EICAR file still detected!")

        else:
            print(f"{Colors.FAIL}[FAILED]{Colors.ENDC} Sanitization returned empty result.")

    print_header("Demo Complete")
    print(f"Clean files available in: {clean_dir}")

if __name__ == "__main__":
    run_demo()
