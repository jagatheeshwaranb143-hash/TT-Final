from dataclasses import dataclass

from ortools.sat.python import cp_model

from scheduler.constraints.hard import (
    add_capacity_constraint,
    add_class_clash_constraint,
    add_faculty_clash_constraint,
    add_locked_entries_constraint,
    add_room_clash_constraint,
)


def solve_with_both_true(constraint, keys, entity_ids):
    model = cp_model.CpModel()
    variables = {key: model.NewBoolVar(key) for key in keys}
    constraint(model, variables, entity_ids, [1], [1])
    for variable in variables.values():
        model.Add(variable == 1)
    return cp_model.CpSolver().Solve(model)


def test_faculty_cannot_teach_two_classes_at_once():
    status = solve_with_both_true(
        add_faculty_clash_constraint,
        ["x_c1_s1_f1_r1_d1_p1", "x_c2_s2_f1_r2_d1_p1"],
        ["1"],
    )
    assert status == cp_model.INFEASIBLE


def test_class_cannot_take_two_subjects_at_once():
    status = solve_with_both_true(
        add_class_clash_constraint,
        ["x_c1_s1_f1_r1_d1_p1", "x_c1_s2_f2_r2_d1_p1"],
        ["1"],
    )
    assert status == cp_model.INFEASIBLE


def test_room_cannot_host_two_classes_at_once():
    status = solve_with_both_true(
        add_room_clash_constraint,
        ["x_c1_s1_f1_r1_d1_p1", "x_c2_s2_f2_r1_d1_p1"],
        ["1"],
    )
    assert status == cp_model.INFEASIBLE


def test_locked_entry_is_preserved():
    model = cp_model.CpModel()
    key = "x_c1_s1_f1_r1_d1_p1"
    variable = model.NewBoolVar(key)

    @dataclass
    class Entry:
        class_id: str = "1"
        subject_id: str = "1"
        faculty_id: str = "1"
        room_id: str = "1"
        day: int = 1
        period: int = 1

    add_locked_entries_constraint(model, {key: variable}, [Entry()])
    model.Add(variable == 0)
    assert cp_model.CpSolver().Solve(model) == cp_model.INFEASIBLE


def test_room_capacity_rejects_undersized_room():
    model = cp_model.CpModel()
    key = "x_c1_s1_f1_r1_d1_p1"
    variable = model.NewBoolVar(key)

    @dataclass
    class Class:
        id: str = "1"
        strength: int = 60

    @dataclass
    class Room:
        id: str = "1"
        capacity: int = 30

    add_capacity_constraint(model, {key: variable}, [Class()], [Room()])
    model.Add(variable == 1)
    assert cp_model.CpSolver().Solve(model) == cp_model.INFEASIBLE
