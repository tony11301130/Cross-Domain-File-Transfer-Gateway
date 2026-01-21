import zipfile
import sys

f = "/app/storage/ingress/893edef6-78ca-46d4-8681-8ff9c57e5714_protected.zip"
print(f"Checking {f}")
print(f"is_zipfile: {zipfile.is_zipfile(f)}")

try:
    with zipfile.ZipFile(f, 'r') as zf:
        print("Opened ZipFile")
        print(f"Files: {zf.namelist()}")
        for info in zf.infolist():
            print(f"File: {info.filename}, encrypted: {info.flag_bits & 0x1}")
except Exception as e:
    print(f"Error opening ZipFile: {e}")
