import pyzipper

def create_protected_zip(zip_name, file_to_zip, password):
    with pyzipper.AESZipFile(zip_name, 'w', compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as zf:
        zf.setpassword(password.encode())
        zf.writestr(file_to_zip, "This is a secret message.")

if __name__ == "__main__":
    create_protected_zip("protected.zip", "secret.txt", "test1234")
    print("protected.zip created with password 'test1234'")
