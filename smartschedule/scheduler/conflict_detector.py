"""
SmartSchedule — Real-time Conflict Detector
Finds all scheduling conflicts in a list of timetable entries.
"""
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class Conflict:
    conflict_type: str   # 'faculty' | 'class' | 'room' | 'lab'
    day_of_week: int
    period_number: int
    entity_id: str
    entry_ids: list[str]
    description: str


def detect_conflicts(entries: list[dict]) -> list[Conflict]:
    """
    Find all hard conflicts in a list of timetable entries.
    Each entry dict must have: id, faculty_id, class_id, room_id, lab_id, day_of_week, period_number
    Returns list of Conflict objects (empty if conflict-free).
    """
    conflicts = []
    
    # Group by (entity, day, period)
    faculty_slots: dict = defaultdict(list)
    class_slots: dict = defaultdict(list)
    room_slots: dict = defaultdict(list)
    lab_slots: dict = defaultdict(list)
    
    for entry in entries:
        eid = entry.get('id', '')
        day = entry.get('day_of_week')
        period = entry.get('period_number')
        
        if entry.get('faculty_id'):
            faculty_slots[(entry['faculty_id'], day, period)].append(eid)
        if entry.get('class_id'):
            class_slots[(entry['class_id'], day, period)].append(eid)
        if entry.get('room_id'):
            room_slots[(entry['room_id'], day, period)].append(eid)
        if entry.get('lab_id'):
            lab_slots[(entry['lab_id'], day, period)].append(eid)
    
    days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    for (fac_id, day, period), eids in faculty_slots.items():
        if len(eids) > 1:
            conflicts.append(Conflict(
                conflict_type='faculty', day_of_week=day, period_number=period,
                entity_id=fac_id, entry_ids=eids,
                description=f"Faculty clash on {days[day]} Period {period} ({len(eids)} classes)"
            ))
    
    for (cls_id, day, period), eids in class_slots.items():
        if len(eids) > 1:
            conflicts.append(Conflict(
                conflict_type='class', day_of_week=day, period_number=period,
                entity_id=cls_id, entry_ids=eids,
                description=f"Class clash on {days[day]} Period {period} ({len(eids)} subjects)"
            ))
    
    for (room_id, day, period), eids in room_slots.items():
        if len(eids) > 1:
            conflicts.append(Conflict(
                conflict_type='room', day_of_week=day, period_number=period,
                entity_id=room_id, entry_ids=eids,
                description=f"Room clash on {days[day]} Period {period} ({len(eids)} classes)"
            ))
    
    for (lab_id, day, period), eids in lab_slots.items():
        if len(eids) > 1:
            conflicts.append(Conflict(
                conflict_type='lab', day_of_week=day, period_number=period,
                entity_id=lab_id, entry_ids=eids,
                description=f"Lab clash on {days[day]} Period {period} ({len(eids)} classes)"
            ))
    
    return conflicts


def count_conflicts(entries: list[dict]) -> dict:
    """Count conflicts by type. Returns dict for the API."""
    conflicts = detect_conflicts(entries)
    return {
        'total': len(conflicts),
        'faculty': sum(1 for c in conflicts if c.conflict_type == 'faculty'),
        'class': sum(1 for c in conflicts if c.conflict_type == 'class'),
        'room': sum(1 for c in conflicts if c.conflict_type == 'room'),
        'lab': sum(1 for c in conflicts if c.conflict_type == 'lab'),
        'details': [{'type': c.conflict_type, 'day': c.day_of_week, 'period': c.period_number, 'description': c.description} for c in conflicts[:20]],
    }
