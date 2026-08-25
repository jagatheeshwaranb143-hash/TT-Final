from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from uuid import UUID

class GenerateRequest(BaseModel):
    semester_id: UUID
    version_name: str
    constraint_weights: Optional[dict[str, int]] = None
    use_previous_version_id: Optional[UUID] = None

class GenerateResponse(BaseModel):
    job_id: UUID
    message: str
    status: str

class JobStatusResponse(BaseModel):
    job_id: UUID
    status: str
    progress: int
    message: Optional[str] = None
    result_version_id: Optional[UUID] = None
    error: Optional[str] = None

class DataValidationReport(BaseModel):
    is_valid: bool
    errors: list[str] = []
    warnings: list[str] = []
    missing_data: dict[str, list[str]] = {}

class MoveValidationRequest(BaseModel):
    entry_id: UUID
    new_day_of_week: int
    new_period_number: int

class MoveValidationResponse(BaseModel):
    is_valid: bool
    conflicts: list[str] = []
    warnings: list[str] = []

class QualityBreakdown(BaseModel):
    faculty_utilization: float
    room_utilization: float
    gap_distribution: float
    constraint_satisfaction: float

class QualityScoreResponse(BaseModel):
    version_id: UUID
    overall_score: float
    breakdown: QualityBreakdown

class ConflictReportResponse(BaseModel):
    version_id: UUID
    conflicts: list[dict[str, Any]]
    total_conflicts: int

class SimulationRequest(BaseModel):
    semester_id: UUID
    scenario_parameters: dict[str, Any]

class SimulationResponse(BaseModel):
    simulation_id: UUID
    results: dict[str, Any]
    recommendations: list[str] = []

class ImportRowError(BaseModel):
    row_number: int
    errors: list[str]

class ImportValidationResponse(BaseModel):
    is_valid: bool
    row_errors: list[ImportRowError] = []
    total_valid_rows: int = 0
    total_invalid_rows: int = 0

class PublishValidationResponse(BaseModel):
    can_publish: bool
    unresolved_conflicts: int
    warnings: list[str] = []

class SetupStep(BaseModel):
    step_name: str
    is_complete: bool
    missing_items: list[str] = []

class SetupStatusResponse(BaseModel):
    college_id: UUID
    is_ready: bool
    steps: list[SetupStep]

class VersionComparisonResponse(BaseModel):
    version1_id: UUID
    version2_id: UUID
    differences: list[dict[str, Any]]
    metrics_comparison: dict[str, dict[str, float]]
