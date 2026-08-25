from ortools.sat.python import cp_model
from typing import Dict, List, Any, Tuple

def add_faculty_clash_constraint(model, vars: Dict, faculty_ids: List[str], days: List[int], periods: List[int]):
    """
    For each (faculty, day, period): sum of all vars where this faculty teaches <= 1
    One faculty cannot teach two classes at the same time.
    """
    for f_id in faculty_ids:
        for d in days:
            for p in periods:
                matching = [v for k, v in vars.items() 
                           if f'_f{f_id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p}')]
                if len(matching) > 1:
                    model.Add(sum(matching) <= 1)

def add_class_clash_constraint(model, vars: Dict, class_ids: List[str], days: List[int], periods: List[int]):
    """One class cannot have two subjects at the same time."""
    for c_id in class_ids:
        for d in days:
            for p in periods:
                matching = [v for k, v in vars.items()
                           if k.startswith(f'x_c{c_id}_') and f'_d{d}_' in k and k.endswith(f'_p{p}')]
                if len(matching) > 1:
                    model.Add(sum(matching) <= 1)

def add_room_clash_constraint(model, vars: Dict, room_ids: List[str], days: List[int], periods: List[int]):
    """One room cannot host two classes simultaneously."""
    for r_id in room_ids:
        for d in days:
            for p in periods:
                matching = [v for k, v in vars.items()
                           if f'_r{r_id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p}')]
                if len(matching) > 1:
                    model.Add(sum(matching) <= 1)

def add_lab_clash_constraint(model, vars: Dict, lab_ids: List[str], days: List[int], periods: List[int]):
    """One lab cannot host two sessions simultaneously."""
    for l_id in lab_ids:
        for d in days:
            for p in periods:
                matching = [v for k, v in vars.items()
                           if f'_l{l_id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p}')]
                if len(matching) > 1:
                    model.Add(sum(matching) <= 1)

def add_faculty_availability_constraint(model, vars: Dict, faculty_data):
    """Faculty cannot be scheduled during blocked periods."""
    for faculty in faculty_data:
        blocked = set()
        for avail in faculty.availability:
            if not avail.is_available:
                blocked.add((avail.day_of_week, avail.period_number))
        for (d, p) in blocked:
            matching = [v for k, v in vars.items()
                       if f'_f{faculty.id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p}')]
            for var in matching:
                model.Add(var == 0)

def add_room_availability_constraint(model, vars: Dict, room_data):
    """Rooms only available on their configured days."""
    for room in room_data:
        if room.available_days:
            unavailable_days = [d for d in range(7) if d not in room.available_days]
            for d in unavailable_days:
                matching = [v for k, v in vars.items()
                           if f'_r{room.id}_' in k and f'_d{d}_' in k]
                for var in matching:
                    model.Add(var == 0)

def add_lab_availability_constraint(model, vars: Dict, lab_data):
    """Labs only available on their configured days."""
    for lab in lab_data:
        if lab.available_days:
            unavailable_days = [d for d in range(7) if d not in lab.available_days]
            for d in unavailable_days:
                matching = [v for k, v in vars.items()
                           if f'_l{lab.id}_' in k and f'_d{d}_' in k]
                for var in matching:
                    model.Add(var == 0)

def add_consecutive_periods_constraint(model, vars: Dict, subjects_needing_consecutive, working_days, all_periods):
    """
    For subjects requiring consecutive periods (e.g., 2-period lab):
    if subject is scheduled at (day, period p), it must also be scheduled at (day, period p+1).
    """
    for subject in subjects_needing_consecutive:
        if not subject.requires_consecutive:
            continue
        count = subject.consecutive_count
        periods_list = sorted([p for p in all_periods])
        for d in working_days:
            for i, p in enumerate(periods_list):
                if i + count > len(periods_list):
                    # Cannot fit consecutive block starting at p
                    # Force no scheduling at p for this subject
                    matching_at_p = [v for k, v in vars.items()
                                    if f'_s{subject.id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p}')]
                    for var in matching_at_p:
                        model.Add(var == 0)

def add_subject_weekly_hours_constraint(model, vars: Dict, classes, subjects):
    """Each subject must have exactly its weekly_periods scheduled per class."""
    for c in classes:
        for s in subjects:
            # Get all vars for this class-subject pair
            class_subject_vars = [v for k, v in vars.items()
                                  if k.startswith(f'x_c{c.id}_s{s.id}_')]
            if class_subject_vars:
                model.Add(sum(class_subject_vars) == s.weekly_periods)

def add_faculty_eligibility_constraint(model, vars: Dict, faculty_subjects):
    """
    Only eligible (assigned) faculty can teach a subject.
    All vars for non-eligible faculty-subject combinations are forced to 0.
    """
    eligible_pairs = {(fs.faculty_id, fs.subject_id) for fs in faculty_subjects}
    for key, var in vars.items():
        parts = key.split('_')
        if len(parts) >= 4:
            f_id = parts[3][1:]
            s_id = parts[2][1:]
            if (f_id, s_id) not in eligible_pairs:
                model.Add(var == 0)

def add_locked_entries_constraint(model, vars: Dict, locked_entries):
    """Locked timetable entries cannot be changed during regeneration."""
    for entry in locked_entries:
        key = f"x_c{entry.class_id}_s{entry.subject_id}_f{entry.faculty_id}_r{entry.room_id}_d{entry.day}_p{entry.period}"
        if key in vars:
            model.Add(vars[key] == 1)

def add_capacity_constraint(model, vars: Dict, classes, rooms):
    """Room capacity must be >= class strength when assigned."""
    room_capacity = {r.id: r.capacity for r in rooms}
    class_strength = {c.id: c.strength for c in classes}
    for key, var in vars.items():
        parts = key.split('_')
        if len(parts) >= 5:
            c_id = parts[1][1:]
            r_id = parts[4][1:]
            if c_id in class_strength and r_id in room_capacity:
                if class_strength[c_id] > room_capacity[r_id]:
                    model.Add(var == 0)  # Cannot assign this room to this class

def add_batch_clash_constraint(model, vars: Dict, batches, days, periods):
    """Same batch cannot have two sessions simultaneously."""
    # For each batch, at each (day, period), at most one session
    for batch in batches:
        for d in days:
            for p in periods:
                matching = [v for k, v in vars.items()
                           if f'_b{batch.id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p}')]
                if len(matching) > 1:
                    model.Add(sum(matching) <= 1)
