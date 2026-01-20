import paramiko
import os
import sys

def test_key_auth():
    host = "192.168.1.93"
    user = "root"
    key_path = "/app/storage/keys/id_rsa"
    
    print(f"Testing key auth to {user}@{host} using {key_path}...")

    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Connect WITHOUT password, explicitly using key
        ssh.connect(host, username=user, key_filename=key_path, look_for_keys=False)
        
        print("SUCCESS: Connected using SSH Key!")
        stdin, stdout, stderr = ssh.exec_command('whoami')
        print(f"Remote user: {stdout.read().decode().strip()}")
        ssh.close()
    except Exception as e:
        print(f"FAILURE: Could not connect with key: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_key_auth()
