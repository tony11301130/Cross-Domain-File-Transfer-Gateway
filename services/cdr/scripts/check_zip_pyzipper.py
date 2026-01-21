import pyzipper
import sys
import zipfile

f = "/app/storage/ingress/893edef6-78ca-46d4-8681-8ff9c57e5714_protected.zip"
print(f"Checking {f}")
print(f"zipfile.is_zipfile: {zipfile.is_zipfile(f)}")
print(f"pyzipper.is_zipfile: {pyzipper.is_zipfile(f)}")
