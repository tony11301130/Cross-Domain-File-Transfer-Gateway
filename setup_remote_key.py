import paramiko
import os
import sys

def setup_key():
    host = "192.168.1.93"
    user = "root"
    password = "1qaz@WSX3edc"
    pub_key_path = "/app/storage/keys/id_rsa.pub"

    print(f"Checking for public key at {pub_key_path}...")
    if not os.path.exists(pub_key_path):
        print("Public key not found yet. Waiting or failed?")
        sys.exit(1)

    with open(pub_key_path, 'r') as f:
        pub_key = f.read().strip()

    print(f"Read public key: {pub_key[:20]}...")

    try:
        print(f"Connecting to {host}...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=user, password=password)

        print("Checking authorized_keys...")
        stdin, stdout, stderr = ssh.exec_command('mkdir -p ~/.ssh && cat ~/.ssh/authorized_keys')
        existing_keys = stdout.read().decode('utf-8')

        if pub_key in existing_keys:
            print("Key already authorized.")
        else:
            print("Adding key to authorized_keys...")
            ssh.exec_command(f'echo "{pub_key}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh')
            print("Key added successfully.")

        ssh.close()
        print("Setup complete.")
    except Exception as e:
        print(f"Error connecting or setting up key: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_key()
