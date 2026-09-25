"""
Timetable Scheduling Engine — CP-SAT (OR-Tools)

Standalone module. Can be tested independently:
    python scheduler/engine.py

Grid: 6 days (Mon–Sat, 0–5) × 7 periods (1–7) = 42 slots/week per class.

Input  : list of ClassInput records (class id, list of subjects with faculty)
Output : ScheduleResult with status + list of TimetableEntryData
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from typing import Optional

try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False


DAYS = list(range(6))       # 0=Mon … 5=Sat
PERIODS = list(range(1, 8)) # 1–7
SOLVER_TIME_LIMIT = 60      # seconds


@dataclass
class SubjectInput:
    subject_id: str
    subject_name: str
    subject_type: str          # "theory" | "lab"
    periods_per_week: int
    lab_block_size: int = 2    # consecutive periods for lab blocks
    faculty_id: Optional[str] = None
    faculty_name: Optional[str] = None


@dataclass
class ClassInput:
    class_id: str
    class_label: str           # e.g. "CSE Yr2 S3 A"
    subjects: list[SubjectInput] = field(default_factory=list)


@dataclass
class TimetableEntryData:
    class_id: str
    subject_id: str
    faculty_id: Optional[str]
    day: int
    period: int


@dataclass
class ScheduleResult:
    status: str                # "FEASIBLE" | "INFEASIBLE" | "ERROR"
    entries: list[TimetableEntryData] = field(default_factory=list)
    message: str = ""
    elapsed_seconds: float = 0.0


def generate_timetable(
    classes: list[ClassInput],
    blocked_faculty_slots: Optional[set[tuple[str, int, int]]] = None,
    available_days: Optional[list[int]] = None,
    available_periods: Optional[list[int]] = None,
) -> ScheduleResult:
    """Run CP-SAT solver and return a ScheduleResult.

    ``blocked_faculty_slots`` contains (faculty_id, day, period) tuples already
    occupied by timetables generated for other classes.
    """
    if not HAS_ORTOOLS:
        return ScheduleResult(status="ERROR", message="OR-Tools not installed. Run: pip install ortools")

    model = cp_model.CpModel()
    blocked_faculty_slots = blocked_faculty_slots or set()
    schedule_days = sorted(set(available_days)) if available_days else DAYS
    schedule_periods = sorted(set(available_periods)) if available_periods else PERIODS

    # ── Decision variables ──────────────────────────────────────────────────
    # x[(class_id, subject_id, day, period)] = 1 if that class has that subject at (day, period)
    x: dict[tuple, cp_model.IntVar] = {}

    for cls in classes:
        for subj in cls.subjects:
            for d in schedule_days:
                for p in schedule_periods:
                    key = (cls.class_id, subj.subject_id, d, p)
                    x[key] = model.NewBoolVar(f"x_c{cls.class_id[:6]}_s{subj.subject_id[:6]}_d{d}_p{p}")

    # ── Hard constraint 1: Each class gets exactly periods_per_week per subject ──
    for cls in classes:
        for subj in cls.subjects:
            model.Add(
                sum(x[(cls.class_id, subj.subject_id, d, p)]
                    for d in schedule_days for p in schedule_periods) == subj.periods_per_week
            )

    # ── Hard constraint 2: No class has two subjects in same (day, period) ──
    for cls in classes:
        for d in schedule_days:
            for p in schedule_periods:
                model.Add(
                    sum(x[(cls.class_id, subj.subject_id, d, p)]
                        for subj in cls.subjects) <= 1
                )

    # ── Hard constraint 3: No faculty double-booked across classes ──
    # Group by faculty_id
    faculty_map: dict[str, list[tuple[str, str]]] = {}  # faculty_id -> [(class_id, subject_id)]
    for cls in classes:
        for subj in cls.subjects:
            if subj.faculty_id:
                faculty_map.setdefault(subj.faculty_id, []).append((cls.class_id, subj.subject_id))

    for fid, assignments in faculty_map.items():
        for d in schedule_days:
            for p in schedule_periods:
                model.Add(
                    sum(x[(cid, sid, d, p)] for cid, sid in assignments) <= 1
                )
                if (fid, d, p) in blocked_faculty_slots:
                    for cid, sid in assignments:
                        model.Add(x[(cid, sid, d, p)] == 0)

    # ── Hard constraint 4: Lab subjects = consecutive period blocks ──
    for cls in classes:
        for subj in cls.subjects:
            if subj.subject_type == "lab" and subj.lab_block_size > 1:
                bs = subj.lab_block_size
                cid, sid = cls.class_id, subj.subject_id

                # All lab periods must start at a valid block start
                # Valid starts: period p where p+bs-1 <= 7
                valid_starts = [p for p in schedule_periods if all(p + offset in schedule_periods for offset in range(bs))]

                # For each day: either 0 or exactly one block of size bs
                for d in schedule_days:
                    # Total periods on this day
                    day_total = sum(x[(cid, sid, d, p)] for p in schedule_periods)

                    # If used at all, must be used in a full block
                    # Create block indicator variables
                    block_vars = []
                    for start in valid_starts:
                        b = model.NewBoolVar(f"blk_{cid[:4]}_{sid[:4]}_d{d}_p{start}")
                        block_vars.append(b)
                        # If block is active, all periods in it must be 1
                        for offset in range(bs):
                            pp = start + offset
                            if pp in schedule_periods:
                                model.Add(x[(cid, sid, d, pp)] == 1).OnlyEnforceIf(b)
                        # If block is not active, at least one period in it is 0
                        # (implied by day_total constraint)

                    # At most one block per day per lab subject
                    model.Add(sum(block_vars) <= 1)

                    # day_total must be 0 or bs
                    # Use a boolean: used_today
                    used = model.NewBoolVar(f"used_{cid[:4]}_{sid[:4]}_d{d}")
                    model.Add(day_total == bs).OnlyEnforceIf(used)
                    model.Add(day_total == 0).OnlyEnforceIf(used.Not())
                    # If used, exactly one block must be chosen
                    model.Add(sum(block_vars) == 1).OnlyEnforceIf(used)

    # ── Soft constraint: spread load across week (minimize max periods/day per faculty) ──
    # Penalty for stacking more than 4 periods in one day for a class
    penalties = []
    for cls in classes:
        for d in schedule_days:
            day_load = sum(
                x[(cls.class_id, subj.subject_id, d, p)]
                for subj in cls.subjects
                for p in schedule_periods
            )
            over = model.NewIntVar(0, len(schedule_periods), f"over_{cls.class_id[:6]}_d{d}")
            model.Add(over >= day_load - 4)
            model.Add(over >= 0)
            penalties.append(over)

    model.Minimize(sum(penalties))

    # ── Solve ───────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = SOLVER_TIME_LIMIT
    solver.parameters.log_search_progress = False

    status_code = solver.Solve(model)
    # OR-Tools reports seconds consistently. On some Windows/Python builds the
    # process performance counter can be exposed in milliseconds, which made a
    # nine-second solve appear as roughly 9,000 seconds in the API response.
    elapsed = solver.WallTime()
    if elapsed > SOLVER_TIME_LIMIT * 10:
        # OR-Tools 9.10 on the Windows runtime used by this project returns
        # milliseconds here despite the Python API documenting seconds.
        elapsed /= 1000

    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        entries: list[TimetableEntryData] = []
        for cls in classes:
            for subj in cls.subjects:
                for d in schedule_days:
                    for p in schedule_periods:
                        if solver.Value(x[(cls.class_id, subj.subject_id, d, p)]):
                            entries.append(TimetableEntryData(
                                class_id=cls.class_id,
                                subject_id=subj.subject_id,
                                faculty_id=subj.faculty_id,
                                day=d,
                                period=p,
                            ))
        label = "OPTIMAL" if status_code == cp_model.OPTIMAL else "FEASIBLE"
        return ScheduleResult(
            status=label,
            entries=entries,
            message=f"Generated {len(entries)} timetable entries in {elapsed:.1f}s",
            elapsed_seconds=elapsed,
        )
    else:
        return ScheduleResult(
            status="INFEASIBLE",
            message=(
                f"Could not generate a conflict-free timetable in {elapsed:.1f}s. "
                "Check that: (1) total periods/week across all subjects ≤ 42 slots, "
                "(2) each faculty is assigned and not over-committed, "
                "(3) lab block sizes fit within 7 periods/day."
            ),
            elapsed_seconds=elapsed,
        )


# ── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Testing CP-SAT scheduler with sample data...")

    test_classes = [
        ClassInput(
            class_id="cls-001",
            class_label="CSE Yr2 Sem3 A",
            subjects=[
                SubjectInput("sub-001", "Data Structures", "theory", 5, faculty_id="fac-001", faculty_name="Dr. Smith"),
                SubjectInput("sub-002", "DBMS", "theory", 4, faculty_id="fac-002", faculty_name="Prof. Jones"),
                SubjectInput("sub-003", "OS", "theory", 4, faculty_id="fac-003", faculty_name="Dr. Lee"),
                SubjectInput("sub-004", "DS Lab", "lab", 2, lab_block_size=2, faculty_id="fac-001", faculty_name="Dr. Smith"),
                SubjectInput("sub-005", "DBMS Lab", "lab", 2, lab_block_size=2, faculty_id="fac-002", faculty_name="Prof. Jones"),
            ],
        ),
        ClassInput(
            class_id="cls-002",
            class_label="CSE Yr2 Sem3 B",
            subjects=[
                SubjectInput("sub-001", "Data Structures", "theory", 5, faculty_id="fac-001", faculty_name="Dr. Smith"),
                SubjectInput("sub-002", "DBMS", "theory", 4, faculty_id="fac-004", faculty_name="Prof. Kumar"),
                SubjectInput("sub-003", "OS", "theory", 4, faculty_id="fac-005", faculty_name="Ms. Priya"),
                SubjectInput("sub-004", "DS Lab", "lab", 2, lab_block_size=2, faculty_id="fac-006", faculty_name="Mr. Rajan"),
            ],
        ),
    ]

    result = generate_timetable(test_classes)
    print(f"\nStatus  : {result.status}")
    print(f"Message : {result.message}")
    print(f"Entries : {len(result.entries)}")

    if result.entries:
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        print("\nSample entries (first 10):")
        for e in result.entries[:10]:
            print(f"  Class={e.class_id[-3:]} Subject={e.subject_id[-3:]} Faculty={e.faculty_id} Day={day_names[e.day]} Period={e.period}")

    sys.exit(0 if result.status in ("OPTIMAL", "FEASIBLE") else 1)
