class KSPException(Exception):
    """Base exception class for Karnataka Police State Platform errors."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class CaseNotFound(KSPException):
    """Raised when a requested case record does not exist or is out-of-scope."""
    def __init__(self, message: str = "Case not found or access denied."):
        super().__init__(message, status_code=404)

class DuplicateCrimeNumber(KSPException):
    """Raised when registering a duplicate CrimeNo or CaseNo."""
    def __init__(self, message: str = "A case with this crime or case number already exists."):
        super().__init__(message, status_code=409)

class PermissionDenied(KSPException):
    """Raised when a user lacks the required RBAC privilege code."""
    def __init__(self, message: str = "Permission denied: access to this action is restricted."):
        super().__init__(message, status_code=403)

class OfficerInactive(KSPException):
    """Raised when executing assignments for a deactivated officer."""
    def __init__(self, message: str = "This officer profile is marked inactive."):
        super().__init__(message, status_code=400)

class InvalidJurisdiction(KSPException):
    """Raised when a query attempts to cross geographic police station boundaries."""
    def __init__(self, message: str = "Invalid jurisdiction scope: access outside your district or station is prohibited."):
        super().__init__(message, status_code=403)

class ResourceConflict(KSPException):
    """Raised when an operation conflicts with existing DB states (e.g. duplicate active assignments)."""
    def __init__(self, message: str = "Resource conflict: this state update is not allowed."):
        super().__init__(message, status_code=409)
