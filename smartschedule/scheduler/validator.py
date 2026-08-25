from dataclasses import dataclass, field
from typing import List
from scheduler.models import SchedulerInput

@dataclass
class ValidationIssue:
    severity: str  # 'error' | 'warning'
    code: str
    message: str
    entity_type: str
    entity_id: str = ''

@dataclass
class ValidationReport:
    is_valid: bool
    blocking_errors: List[ValidationIssue] = field(default_factory=list)
    warnings: List[ValidationIssue] = field(default_factory=list)
    
    @property
    def total_issues(self) -> int:
        return len(self.blocking_errors) + len(self.warnings)

class DataValidator:
    def validate_pre_generation(self, data: SchedulerInput) -> ValidationReport:
        """Run all validation checks before generation."""
        errors = []
        warnings = []
        
        # 1. No working days configured
        if not data.working_days:
            errors.append(ValidationIssue('error', 'NO_WORKING_DAYS', 'No working days configured.', 'working_days'))
        
        # 2. No periods configured
        if not data.periods:
            errors.append(ValidationIssue('error', 'NO_PERIODS', 'No periods configured.', 'periods'))
        
        # 3. No classes
        if not data.classes:
            errors.append(ValidationIssue('error', 'NO_CLASSES', 'No classes found for this semester.', 'classes'))
        
        # 4. No faculty
        if not data.faculty:
            errors.append(ValidationIssue('error', 'NO_FACULTY', 'No faculty records found.', 'faculty'))
        
        # 5. Subjects without faculty assignments
        assigned_subject_ids = {fs.subject_id for fs in data.faculty_subjects}
        for s in data.subjects:
            if s.id not in assigned_subject_ids:
                errors.append(ValidationIssue('error', 'SUBJECT_NO_FACULTY', 
                    f'Subject "{s.name}" has no faculty assigned.', 'subject', s.id))
        
        # 6. Subjects with zero weekly periods
        for s in data.subjects:
            if s.weekly_periods <= 0:
                errors.append(ValidationIssue('error', 'SUBJECT_ZERO_HOURS',
                    f'Subject "{s.name}" has 0 weekly periods.', 'subject', s.id))
        
        # 7. No rooms at all
        if not data.rooms:
            errors.append(ValidationIssue('error', 'NO_ROOMS', 'No classrooms configured.', 'rooms'))
        
        # 8. Lab subjects without labs
        lab_subjects = [s for s in data.subjects if s.requires_lab]
        if lab_subjects and not data.laboratories:
            errors.append(ValidationIssue('error', 'LAB_SUBJECTS_NO_LABS',
                f'{len(lab_subjects)} subjects require labs but no labs configured.', 'laboratories'))
        
        # 9. Feasibility check: enough periods for all subjects
        if data.working_days and data.periods:
            total_available = len(data.working_days) * len([p for p in data.periods if not p.is_break])
            total_required = sum(s.weekly_periods for s in data.subjects)
            if total_required > total_available * len(data.classes):
                warnings.append(ValidationIssue('warning', 'TIGHT_SCHEDULE',
                    'Total subject hours may be tight for the available slots.', 'schedule'))
        
        # 10. Faculty overloaded
        for f in data.faculty:
            assigned = [fs for fs in data.faculty_subjects if fs.faculty_id == f.id]
            total_periods = sum(next((s.weekly_periods for s in data.subjects if s.id == fs.subject_id), 0) for fs in assigned)
            if total_periods > f.max_weekly_periods:
                warnings.append(ValidationIssue('warning', 'FACULTY_OVERLOADED',
                    f'Faculty "{f.name}" may be overloaded ({total_periods} > {f.max_weekly_periods} max).', 'faculty', f.id))
        
        return ValidationReport(
            is_valid=len(errors) == 0,
            blocking_errors=errors,
            warnings=warnings
        )
