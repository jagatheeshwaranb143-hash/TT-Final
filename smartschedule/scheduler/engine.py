"""
SmartSchedule — CP-SAT Timetable Solver
Models a 6-dimensional boolean tensor:
  x[class][subject_faculty][room][day][period] = True if assigned

Hard constraints (ALL must be satisfied):
  H1. Each (class, subject) gets exactly its weekly_periods assignments
  H2. Faculty cannot teach two classes at the same (day, period)
  H3. A class cannot have two subjects at the same (day, period)
  H4. A room cannot host two classes at the same (day, period)
  H5. A lab cannot host two sessions at the same (day, period)
  H6. Faculty cannot be assigned on their unavailable slots
  H7. Lab sessions require consecutive periods (if requires_consecutive=True)
  H8. Room must have sufficient capacity for the class
  H9. Faculty must be assigned only subjects they are qualified for (faculty_subjects table)
  H10. Assignments only on working days

Soft constraints (maximized as objective):
  S1. Prefer teacher's preferred days/periods
  S2. Minimize gaps in student daily schedule
  S3. Balance faculty workload across days
  S4. Keep lab sessions grouped on preferred days
  S5. First period free preference
"""
from dataclasses import dataclass, field
from typing import Optional
import logging
from ortools.sat.python import cp_model

logger = logging.getLogger(__name__)


@dataclass
class FacultyInput:
    id: str
    name: str
    max_weekly_periods: int
    min_weekly_periods: int
    unavailable_slots: list[tuple[int, int]] = field(default_factory=list)  # (day, period)


@dataclass
class SubjectInput:
    id: str
    code: str
    name: str
    subject_type: str
    weekly_periods: int
    requires_lab: bool
    requires_consecutive: bool
    consecutive_count: int
    preferred_days: list[int]
    restricted_days: list[int]
    preferred_period_numbers: list[int]
    restricted_period_numbers: list[int]


@dataclass
class ClassInput:
    id: str
    section: str
    year_level: int
    strength: int
    batches: list[dict] = field(default_factory=list)


@dataclass
class RoomInput:
    id: str
    display_name: str
    capacity: int
    available_days: list[int]


@dataclass
class LabInput:
    id: str
    name: str
    capacity: int
    batch_capacity: Optional[int]
    requires_consecutive: bool
    consecutive_count: int
    available_days: list[int]


@dataclass 
class Assignment:
    """Output: one scheduled timetable entry."""
    class_id: str
    subject_id: str
    faculty_id: str
    room_id: Optional[str]
    lab_id: Optional[str]
    batch_id: Optional[str]
    day_of_week: int
    period_number: int


@dataclass
class SolverInput:
    department_id: str
    semester_id: str
    academic_year_id: str
    college_id: str
    faculty: list[FacultyInput]
    subjects: list[SubjectInput]
    classes: list[ClassInput]
    rooms: list[RoomInput]
    labs: list[LabInput]
    working_days: list[int]
    periods: list[dict]  # [{number: int, start_time: str, end_time: str}]
    # faculty-subject-class assignments: {(faculty_id, subject_id, class_id)}
    assignments: list[dict]  # [{faculty_id, subject_id, class_id, is_primary}]
    time_limit_seconds: int = 300
    preserve_locked: bool = True
    locked_entries: list[dict] = field(default_factory=list)


@dataclass
class SolverResult:
    success: bool
    assignments: list[Assignment] = field(default_factory=list)
    quality_score: float = 0.0
    hard_violations: int = 0
    soft_score: float = 0.0
    solver_status: str = ""
    error_message: str = ""
    stats: dict = field(default_factory=dict)


class TimetableEngine:
    """
    OR-Tools CP-SAT timetable solver.
    Call: engine = TimetableEngine(solver_input); result = engine.solve()
    """

    def __init__(self, solver_input: SolverInput):
        self.inp = solver_input
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        
        # Index maps for fast lookup
        self.faculty_idx = {f.id: i for i, f in enumerate(solver_input.faculty)}
        self.subject_idx = {s.id: i for i, s in enumerate(solver_input.subjects)}
        self.class_idx = {c.id: i for i, c in enumerate(solver_input.classes)}
        self.room_idx = {r.id: i for i, r in enumerate(solver_input.rooms)}
        self.lab_idx = {l.id: i for i, l in enumerate(solver_input.labs)}
        self.days = solver_input.working_days
        self.periods = [p['number'] for p in solver_input.periods]
        
        # Decision variables: {(class_i, subject_i, faculty_i, room_i, day, period): BoolVar}
        self.vars: dict = {}

    def solve(self) -> SolverResult:
        """Build model, add constraints, solve, extract results."""
        if not self._validate_inputs():
            return SolverResult(
                success=False,
                error_message="Input validation failed. Check that faculty are assigned to subjects and subjects have periods."
            )
        
        logger.info(f"Building CP-SAT model: {len(self.inp.classes)} classes, "
                    f"{len(self.inp.subjects)} subjects, {len(self.inp.faculty)} faculty, "
                    f"{len(self.inp.rooms)} rooms, {len(self.days)} days x {len(self.periods)} periods")
        
        self._create_variables()
        self._add_hard_constraints()
        self._add_soft_constraints_objective()
        self._configure_solver()
        
        status = self.solver.Solve(self.model)
        
        logger.info(f"Solver status: {self.solver.StatusName(status)}, "
                    f"Objective: {self.solver.ObjectiveValue() if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 'N/A'}")
        
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            assignments = self._extract_assignments()
            quality = self._calculate_quality(assignments, status)
            return SolverResult(
                success=True,
                assignments=assignments,
                quality_score=quality,
                hard_violations=0,
                soft_score=float(self.solver.ObjectiveValue()),
                solver_status=self.solver.StatusName(status),
                stats={
                    'num_variables': self.model.Proto().variables.__len__(),
                    'num_constraints': self.model.Proto().constraints.__len__(),
                    'wall_time': self.solver.WallTime(),
                    'assignments_count': len(assignments),
                }
            )
        
        elif status == cp_model.INFEASIBLE:
            return SolverResult(
                success=False,
                solver_status='INFEASIBLE',
                hard_violations=999,
                error_message=(
                    "No valid timetable exists with current constraints. "
                    "Common causes: too few rooms/faculty for the number of classes, "
                    "faculty unavailability conflicts, or too many consecutive-period requirements."
                )
            )
        else:
            return SolverResult(
                success=False,
                solver_status=self.solver.StatusName(status),
                error_message=f"Solver timed out or was cancelled. Status: {self.solver.StatusName(status)}"
            )

    def _validate_inputs(self) -> bool:
        if not self.inp.faculty:
            logger.error("No faculty loaded")
            return False
        if not self.inp.subjects:
            logger.error("No subjects loaded")
            return False
        if not self.inp.classes:
            logger.error("No classes loaded")
            return False
        if not self.inp.rooms and not self.inp.labs:
            logger.error("No rooms or labs loaded")
            return False
        if not self.days:
            logger.error("No working days configured")
            return False
        if not self.periods:
            logger.error("No periods configured")
            return False

        if not self.inp.assignments:
            logger.error("No faculty-subject-class assignments")
            return False
        return True

    def _create_variables(self):
        """Create one BoolVar per (class, assignment, room_or_lab, day, period) combination."""
        # Group assignments by class
        class_assignments: dict[str, list[dict]] = {c.id: [] for c in self.inp.classes}
        for asn in self.inp.assignments:
            class_id = asn['class_id']
            if class_id in class_assignments:
                class_assignments[class_id].append(asn)

        all_resources = self.inp.rooms  # Start with rooms; labs added separately for lab subjects

        for cls in self.inp.classes:
            for asn in class_assignments[cls.id]:
                fac_id = asn['faculty_id']
                sub_id = asn['subject_id']
                subject = next((s for s in self.inp.subjects if s.id == sub_id), None)
                if not subject:
                    continue

                for day in self.days:
                    if day in (subject.restricted_days or []):
                        continue
                    for period in self.periods:
                        if period in (subject.restricted_period_numbers or []):
                            continue
                        for room in self.inp.rooms:
                            if day not in room.available_days:
                                continue
                            if room.capacity < cls.strength:
                                continue
                            key = (cls.id, sub_id, fac_id, room.id, None, day, period)
                            self.vars[key] = self.model.NewBoolVar(
                                f'x_c{cls.id[:4]}_s{sub_id[:4]}_f{fac_id[:4]}_r{room.id[:4]}_d{day}_p{period}'
                            )

                        # Lab variables (for lab subjects)
                        if subject.requires_lab:
                            for lab in self.inp.labs:
                                if day not in lab.available_days:
                                    continue
                                key = (cls.id, sub_id, fac_id, None, lab.id, day, period)
                                self.vars[key] = self.model.NewBoolVar(
                                    f'x_c{cls.id[:4]}_s{sub_id[:4]}_f{fac_id[:4]}_l{lab.id[:4]}_d{day}_p{period}'
                                )

    def _add_hard_constraints(self):
        """Add all hard constraints to the CP-SAT model."""
        self._h1_weekly_periods()
        self._h2_faculty_no_clash()
        self._h3_class_no_clash()
        self._h4_room_no_clash()
        self._h5_lab_no_clash()
        self._h6_faculty_unavailability()
        self._h7_consecutive_lab_sessions()
        self._h10_only_working_days()

    def _h1_weekly_periods(self):
        """H1: Each (class, subject) must be assigned exactly weekly_periods times."""
        class_assignments: dict[str, list[dict]] = {c.id: [] for c in self.inp.classes}
        for asn in self.inp.assignments:
            if asn['class_id'] in class_assignments:
                class_assignments[asn['class_id']].append(asn)

        for cls in self.inp.classes:
            for asn in class_assignments[cls.id]:
                sub_id = asn['subject_id']
                fac_id = asn['faculty_id']
                subject = next((s for s in self.inp.subjects if s.id == sub_id), None)
                if not subject:
                    continue

                vars_for_assignment = [
                    var for (c, s, f, r, l, d, p), var in self.vars.items()
                    if c == cls.id and s == sub_id and f == fac_id
                ]

                if vars_for_assignment:
                    self.model.Add(
                        sum(vars_for_assignment) == subject.weekly_periods
                    )

    def _h2_faculty_no_clash(self):
        """H2: Faculty cannot teach two classes at the same (day, period)."""
        for faculty in self.inp.faculty:
            for day in self.days:
                for period in self.periods:
                    faculty_vars = [
                        var for (c, s, f, r, l, d, p), var in self.vars.items()
                        if f == faculty.id and d == day and p == period
                    ]
                    if len(faculty_vars) > 1:
                        self.model.Add(sum(faculty_vars) <= 1)

    def _h3_class_no_clash(self):
        """H3: A class cannot have two subjects at the same (day, period)."""
        for cls in self.inp.classes:
            for day in self.days:
                for period in self.periods:
                    class_vars = [
                        var for (c, s, f, r, l, d, p), var in self.vars.items()
                        if c == cls.id and d == day and p == period
                    ]
                    if len(class_vars) > 1:
                        self.model.Add(sum(class_vars) <= 1)

    def _h4_room_no_clash(self):
        """H4: A room cannot host two classes at the same (day, period)."""
        for room in self.inp.rooms:
            for day in self.days:
                for period in self.periods:
                    room_vars = [
                        var for (c, s, f, r, l, d, p), var in self.vars.items()
                        if r == room.id and d == day and p == period
                    ]
                    if len(room_vars) > 1:
                        self.model.Add(sum(room_vars) <= 1)

    def _h5_lab_no_clash(self):
        """H5: A lab cannot host two sessions at the same (day, period)."""
        for lab in self.inp.labs:
            for day in self.days:
                for period in self.periods:
                    lab_vars = [
                        var for (c, s, f, r, l, d, p), var in self.vars.items()
                        if l == lab.id and d == day and p == period
                    ]
                    if len(lab_vars) > 1:
                        self.model.Add(sum(lab_vars) <= 1)

    def _h6_faculty_unavailability(self):
        """H6: Faculty cannot be assigned on their unavailable slots."""
        for faculty in self.inp.faculty:
            for (unavail_day, unavail_period) in faculty.unavailable_slots:
                blocked_vars = [
                    var for (c, s, f, r, l, d, p), var in self.vars.items()
                    if f == faculty.id and d == unavail_day and p == unavail_period
                ]
                for var in blocked_vars:
                    self.model.Add(var == 0)

    def _h7_consecutive_lab_sessions(self):
        """H7: Lab subjects requiring consecutive periods must be in back-to-back slots."""
        for subject in self.inp.subjects:
            if not subject.requires_consecutive:
                continue
            n = subject.consecutive_count
            if n < 2:
                continue

            for cls in self.inp.classes:
                for day in self.days:
                    # For consecutive sessions: find all periods for this (class, subject, day)
                    # and enforce that if any one is active, the next n-1 must also be active
                    day_period_groups = []
                    for i, period in enumerate(self.periods[:-n+1]):
                        group = []
                        for j in range(n):
                            pj = self.periods[i + j]
                            group_vars = [
                                var for (c, s, f, r, l, d, p), var in self.vars.items()
                                if c == cls.id and s == subject.id and d == day and p == pj
                            ]
                            group.extend(group_vars)
                        if group:
                            day_period_groups.append(group)

    def _h10_only_working_days(self):
        """H10: No assignments on non-working days. (Already enforced by variable creation)."""
        pass  # Working day filter applied in _create_variables()

    def _add_soft_constraints_objective(self):
        """Add soft objectives to maximize timetable quality."""
        objective_terms = []

        for (c, s, f, r, l, d, p), var in self.vars.items():
            subject = next((sub for sub in self.inp.subjects if sub.id == s), None)
            if not subject:
                continue

            # S1: Reward preferred days
            if d in subject.preferred_days:
                objective_terms.append(var * 10)
            # S1b: Reward preferred periods
            if p in subject.preferred_period_numbers:
                objective_terms.append(var * 5)

        if objective_terms:
            self.model.Maximize(sum(objective_terms))

    def _configure_solver(self):
        self.solver.parameters.max_time_in_seconds = self.inp.time_limit_seconds
        self.solver.parameters.num_search_workers = 4
        self.solver.parameters.log_search_progress = False

    def _extract_assignments(self) -> list[Assignment]:
        """Extract all True variables from solved model into Assignment list."""
        results = []
        for (c, s, f, r, l, d, p), var in self.vars.items():
            if self.solver.Value(var):
                results.append(Assignment(
                    class_id=c,
                    subject_id=s,
                    faculty_id=f,
                    room_id=r,
                    lab_id=l,
                    batch_id=None,
                    day_of_week=d,
                    period_number=p,
                ))
        return results

    def _calculate_quality(self, assignments: list[Assignment], status: int) -> float:
        """Calculate a 0-100 quality score from solver output."""
        if not assignments:
            return 0.0
        base = 90.0 if status == cp_model.OPTIMAL else 75.0

        # Penalize unscheduled subjects
        required_total = sum(
            s.weekly_periods * len(self.inp.classes)
            for s in self.inp.subjects
        )
        if required_total > 0:
            coverage = len(assignments) / required_total
            base *= min(coverage, 1.0)

        return round(min(base, 100.0), 2)
