"""
SmartSchedule — Custom Exceptions and Error Handlers
User-friendly errors: never expose raw stack traces or database errors.
"""
from fastapi import status


class SmartScheduleException(Exception):
    """Base exception for all SmartSchedule errors."""

    def __init__(
        self,
        message: str,
        code: str = "SMARTSCHEDULE_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(self.message)


class DataNotFoundError(SmartScheduleException):
    """Raised when a requested resource is not found."""

    def __init__(self, resource: str, resource_id: str = ""):
        detail = f"{resource} not found." if not resource_id else f"{resource} with ID '{resource_id}' not found."
        super().__init__(
            message=detail,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ValidationError(SmartScheduleException):
    """Raised when input data fails validation."""

    def __init__(self, message: str):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class ConflictError(SmartScheduleException):
    """Raised when a unique constraint or business rule is violated."""

    def __init__(self, message: str):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
        )


class UnauthorizedError(SmartScheduleException):
    """Raised when authentication is required but missing."""

    def __init__(self, message: str = "Authentication required. Please log in."):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenError(SmartScheduleException):
    """Raised when user lacks permission for the requested action."""

    def __init__(self, message: str = "You do not have permission to perform this action."):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class TimetableGenerationError(SmartScheduleException):
    """Raised when timetable generation fails."""

    def __init__(self, message: str, reasons: list[str] | None = None):
        detail = message
        if reasons:
            detail = f"{message}\n\nPossible causes:\n" + "\n".join(f"• {r}" for r in reasons)
        super().__init__(
            message=detail,
            code="GENERATION_FAILED",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class ImportValidationError(SmartScheduleException):
    """Raised when imported data fails validation."""

    def __init__(self, message: str, row_errors: list[dict] | None = None):
        super().__init__(
            message=message,
            code="IMPORT_VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
        self.row_errors = row_errors or []


class DependencyError(SmartScheduleException):
    """Raised when deletion would break referential integrity."""

    def __init__(self, resource: str, dependents: list[str]):
        deps = ", ".join(dependents)
        super().__init__(
            message=f"Cannot delete {resource} because it is referenced by: {deps}. "
                    "Remove the dependent records first.",
            code="DEPENDENCY_ERROR",
            status_code=status.HTTP_409_CONFLICT,
        )
