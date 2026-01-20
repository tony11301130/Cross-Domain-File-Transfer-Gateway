import pyzipper

def create_encrypted_zip():
    filename = "encrypted_test.zip"
    password = b"password123"
    secret_content = b"This is a secret document."

    print(f"Creating {filename} with password 'password123'...")
    with pyzipper.AESZipFile(filename, 'w', compression=pyzipper.ZIP_LZMA, encryption=pyzipper.WZ_AES) as zf:
        zf.setpassword(password)
        zf.writestr('secret_doc.txt', secret_content)
    print("Done.")

if __name__ == "__main__":
    create_encrypted_zip()
