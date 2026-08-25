from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional

@dataclass
class BatchData:
    id: str
    name: str
    strength: int

@dataclass
class ClassData:
    id: str
    section: str
    year_level: int
    strength: int
    batches: List[BatchData]

@dataclass
class FacultyData:
    id: str
    name: str
    max_weekly_periods: int
    available_slots: List[Tuple[int, int]]  # (day, period)

@dataclass
class SubjectData:
    id: str
    name: str
    subject_type: str
    weekly_periods: int
    requires_lab: bool
    requires_consecutive: bool
    consecutive_count: int
    preferred_days: List[int]
    restricted_days: List[int]
    preferred_periods: List[int]
    restricted_periods: List[int]

@dataclass
class FacultySubjectData:
    faculty_id: str
    subject_id: str

@dataclass
class RoomData:
    id: str
    name: str
    capacity: int
    room_type: str
    available_days: List[int]

@dataclass
class LabData:
    id: str
    name: str
    capacity: int
    subject_ids: List[str]
    available_days: List[int]

@dataclass
class PeriodData:
    period_number: int
    is_break: bool
    start_time: str
    end_time: str

@dataclass
class ConstraintData:
    constraint_type: str
    parameters: Dict[str, str]

@dataclass
class LockedEntry:
    class_id: str
    subject_id: str
    faculty_id: str
    room_id: str
    day: int
    period: int

@dataclass
class SoftWeights:
    faculty_gap_penalty: float = 1.0
    subject_spread_reward: float = 1.0
    faculty_preference_reward: float = 0.8
    workload_balance_reward: float = 0.9
    student_gap_penalty: float = 1.0
    room_utilization_reward: float = 0.5

@dataclass
class SchedulerInput:
    college_id: str
    semester_id: str
    classes: List[ClassData]
    faculty: List[FacultyData]
    subjects: List[SubjectData]
    faculty_subjects: List[FacultySubjectData]
    rooms: List[RoomData]
    laboratories: List[LabData]
    periods: List[PeriodData]
    working_days: List[int]
    constraints: List[ConstraintData]
    locked_entries: List[LockedEntry]
    soft_weights: SoftWeights

@dataclass
class ScheduledEntry:
    class_id: str
    subject_id: str
    faculty_id: str
    room_id: str
    day: int
    period: int

@dataclass
class HardViolation:
    violation_type: str
    description: str
    entities: Dict[str, str]

@dataclass
class QualityBreakdown:
    hard_constraint_score: float
    faculty_workload_score: float
    subject_distribution_score: float
    faculty_preference_score: float
    room_utilization_score: float
    gap_minimization_score: float
    overall: float

@dataclass
class SchedulerOutput:
    success: bool
    entries: List[ScheduledEntry]
    quality_score: float
    hard_violations: List[HardViolation]
    soft_score: float
    quality_breakdown: QualityBreakdown
    explanation: str
    generation_time_seconds: float
