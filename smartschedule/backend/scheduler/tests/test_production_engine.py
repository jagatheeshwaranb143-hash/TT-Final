from backend.scheduler.engine import ClassInput, SubjectInput, generate_timetable


def _subject(subject_id: str, periods: int, faculty_id: str = "basil") -> SubjectInput:
    return SubjectInput(subject_id, subject_id, "theory", periods, faculty_id=faculty_id)


def test_shared_faculty_is_not_double_booked_between_target_classes():
    result = generate_timetable([
        ClassInput("cse", "CSE", [_subject("cse-subject", 4)]),
        ClassInput("ece", "ECE", [_subject("ece-subject", 4)]),
    ], available_days=[0, 1], available_periods=[1, 2, 3, 4])

    assert result.status in {"OPTIMAL", "FEASIBLE"}
    basil_slots = [(entry.day, entry.period) for entry in result.entries if entry.faculty_id == "basil"]
    assert len(basil_slots) == len(set(basil_slots))


def test_shared_faculty_respects_slots_occupied_by_another_department():
    blocked = {("basil", 0, 1), ("basil", 0, 2)}
    result = generate_timetable(
        [ClassInput("ece", "ECE", [_subject("ece-subject", 2)])],
        blocked_faculty_slots=blocked,
        available_days=[0],
        available_periods=[1, 2, 3, 4],
    )

    assert result.status in {"OPTIMAL", "FEASIBLE"}
    assert all((entry.faculty_id, entry.day, entry.period) not in blocked for entry in result.entries)


def test_impossible_shared_faculty_workload_is_rejected():
    result = generate_timetable(
        [ClassInput("ece", "ECE", [_subject("ece-subject", 3)])],
        blocked_faculty_slots={("basil", 0, 1), ("basil", 0, 2)},
        available_days=[0],
        available_periods=[1, 2, 3, 4],
    )

    assert result.status == "INFEASIBLE"
