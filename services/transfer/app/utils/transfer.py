import paramiko
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class FileTransferError(Exception):
    pass

def transfer_file_to_remote(local_path: str, remote_filename: Optional[str] = None, config: Optional[dict] = None) -> str:
    """
    Transfers a file to a remote Linux server using SFTP.
    Reads configuration from 'config' dict or environment variables.
    """
    # Helper to get config from dict or env
    def get_conf(key, env_key, default=None):
        if config and key in config and config[key] is not None:
             return config[key]
        return os.getenv(env_key, default)

    host = get_conf("host", "TARGET_SERVER_HOST")
    port = int(get_conf("port", "TARGET_SERVER_PORT", 22))
    username = get_conf("username", "TARGET_SERVER_USER")
    password = get_conf("password", "TARGET_SERVER_PASSWORD")
    key_path = get_conf("key_path", "TARGET_SERVER_KEY_PATH", "/app/storage/keys/id_rsa")
    remote_dir = get_conf("target_dir", "TARGET_SERVER_DIR", "/tmp/cdr_uploads")

    if not host or not username:
        # If config is missing, we log a warning and raise error
        raise FileTransferError("Missing target server configuration (Host or User)")

    ssh = None
    sftp = None
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        logger.info(f"Connecting to {host}:{port} as {username}...")

        # Connector priority: Key > Password
        if key_path and os.path.exists(key_path):
            ssh.connect(host, port, username, key_filename=key_path)
        elif password:
            ssh.connect(host, port, username, password=password)
        else:
            # Try default agent/keys
            ssh.connect(host, port, username)

        sftp = ssh.open_sftp()

        # Ensure remote directory exists
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            logger.info(f"Remote directory {remote_dir} does not exist. Attempting to create it.")
            try:
                sftp.mkdir(remote_dir)
            except Exception as mkdir_err:
                 # It's possible mkdir fails if parent doesn't exist, simple impl for now
                 raise FileTransferError(f"Could not create remote directory {remote_dir}: {mkdir_err}")

        if not remote_filename:
            remote_filename = os.path.basename(local_path)

        # Linux paths use forward slash
        remote_path = f"{remote_dir}/{remote_filename}".replace("//", "/")
        
        logger.info(f"Uploading {local_path} to {host}:{remote_path}")
        sftp.put(local_path, remote_path)
        
        logger.info("Transfer complete.")
        return remote_path

    except Exception as e:
        logger.error(f"File transfer failed: {e}")
        raise FileTransferError(f"Transfer failed: {str(e)}")
    finally:
        if sftp:
            try:
                sftp.close()
            except:
                pass
        if ssh:
            try:
                ssh.close()
            except:
                pass
