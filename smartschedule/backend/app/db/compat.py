"""
SQLAlchemy dialect-agnostic UUID type.
Works on both SQLite (stored as VARCHAR(36)) and PostgreSQL (native UUID).
Import `UUIDCol` instead of `mapped_column(UUID(as_uuid=True), ...)`.
"""
import uuid as _uuid
from sqlalchemy import types, String


class UUIDType(types.TypeDecorator):
    """Cross-dialect UUID stored as VARCHAR(36) on SQLite, native UUID on Postgres."""
    impl = types.String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, _uuid.UUID):
            return str(value)
        return str(_uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return _uuid.UUID(str(value))

    def process_literal_param(self, value, dialect):
        return str(value) if value else None
