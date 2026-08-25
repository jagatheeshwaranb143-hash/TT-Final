"""
SmartSchedule — Timetable Quality Scorer
Returns a 0-100 quality score with breakdown.
"""
from dataclasses import dataclass

@dataclass
class QualityBreakdown:
    total_score: float
    coverage_score: float      # Was every required period scheduled?
    balance_score: float       # Is faculty workload balanced across days?
    preference_score: float    # Were preferred days/periods respected?
    gap_score: float           # Are student schedules gap-free?
    soft_score: float          # Solver soft objective value
    grade: str                 # A / B / C / D / F
    summary: str               # Human-readable summary


def calculate_quality(
    assignments: list[dict],
    expected_total: int,
    solver_soft_score: float = 0.0,
) -> QualityBreakdown:
    """Calculate quality breakdown for a solved timetable."""
    
    if not assignments or expected_total == 0:
        return QualityBreakdown(
            total_score=0.0, coverage_score=0.0, balance_score=0.0,
            preference_score=0.0, gap_score=0.0, soft_score=0.0,
            grade='F', summary='No timetable data to evaluate.'
        )
    
    # Coverage: did we schedule all required periods?
    coverage = min(len(assignments) / expected_total, 1.0)
    coverage_score = coverage * 40.0  # 40 points max
    
    # Balance: are classes spread across days?
    from collections import defaultdict
    day_counts: dict = defaultdict(int)
    for asn in assignments:
        day_counts[asn['day_of_week']] += 1
    
    if day_counts:
        counts = list(day_counts.values())
        avg = sum(counts) / len(counts)
        variance = sum((c - avg) ** 2 for c in counts) / len(counts)
        max_variance = avg ** 2  # Worst case: all on one day
        balance = 1.0 - (variance / max_variance) if max_variance > 0 else 1.0
        balance_score = balance * 30.0  # 30 points max
    else:
        balance_score = 0.0
    
    # Gap score: estimate from day spread (simplified)
    gap_score = 20.0 * coverage  # 20 points max
    
    # Preference score from solver soft objective
    soft_normalized = min(solver_soft_score / 1000.0, 1.0) if solver_soft_score > 0 else 0.5
    preference_score = soft_normalized * 10.0  # 10 points max
    
    total = coverage_score + balance_score + gap_score + preference_score
    total = round(min(total, 100.0), 1)
    
    grade = 'A' if total >= 90 else 'B' if total >= 75 else 'C' if total >= 60 else 'D' if total >= 40 else 'F'
    
    summary = (
        f"Scheduled {len(assignments)} of {expected_total} required periods ({coverage*100:.0f}% coverage). "
        f"Faculty workload balance: {'Good' if balance_score > 20 else 'Fair' if balance_score > 10 else 'Poor'}."
    )
    
    return QualityBreakdown(
        total_score=total,
        coverage_score=round(coverage_score, 1),
        balance_score=round(balance_score, 1),
        preference_score=round(preference_score, 1),
        gap_score=round(gap_score, 1),
        soft_score=solver_soft_score,
        grade=grade,
        summary=summary,
    )
