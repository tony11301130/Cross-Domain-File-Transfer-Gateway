
class SanitizationError(Exception):
    def __init__(self, message: str, requires_password: bool = False):
        super().__init__(message)
        self.requires_password = requires_password

class PasswordRequiredError(SanitizationError):
    def __init__(self, message: str = "Password required to process file"):
        super().__init__(message, requires_password=True)
