from ortools.sat.python import cp_model
from typing import Dict, List, Any

def get_faculty_gap_penalties(model, vars: Dict, faculty_ids: List[str], days: List[int], periods: List[int], weight: float = 100) -> List:
    """
    Penalize idle gaps between teaching periods for faculty.
    A gap = faculty teaches period p and p+2 but not p+1.
    """
    penalties = []
    sorted_periods = sorted(periods)
    for f_id in faculty_ids:
        for d in days:
            for i in range(len(sorted_periods) - 2):
                p1 = sorted_periods[i]
                p2 = sorted_periods[i+1]
                p3 = sorted_periods[i+2]
                vars_p1 = [v for k, v in vars.items() if f'_f{f_id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p1}')]
                vars_p2 = [v for k, v in vars.items() if f'_f{f_id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p2}')]
                vars_p3 = [v for k, v in vars.items() if f'_f{f_id}_' in k and f'_d{d}_' in k and k.endswith(f'_p{p3}')]
                if vars_p1 and vars_p2 and vars_p3:
                    teaches_p1 = model.NewBoolVar(f'teaches_{f_id}_d{d}_p{p1}')
                    teaches_p2 = model.NewBoolVar(f'teaches_{f_id}_d{d}_p{p2}')
                    teaches_p3 = model.NewBoolVar(f'teaches_{f_id}_d{d}_p{p3}')
                    model.Add(sum(vars_p1) >= 1).OnlyEnforceIf(teaches_p1)
                    model.Add(sum(vars_p1) == 0).OnlyEnforceIf(teaches_p1.Not())
                    model.Add(sum(vars_p2) >= 1).OnlyEnforceIf(teaches_p2)
                    model.Add(sum(vars_p2) == 0).OnlyEnforceIf(teaches_p2.Not())
                    model.Add(sum(vars_p3) >= 1).OnlyEnforceIf(teaches_p3)
                    model.Add(sum(vars_p3) == 0).OnlyEnforceIf(teaches_p3.Not())
                    gap = model.NewBoolVar(f'gap_{f_id}_d{d}_p{p1}')
                    # gap = teaches_p1 AND NOT teaches_p2 AND teaches_p3
                    penalties.append((gap, int(weight)))
    return penalties

def get_subject_spread_rewards(model, vars: Dict, subjects, days: List[int], weight: float = 50) -> List:
    """Reward spreading the same subject across different days of the week."""
    rewards = []
    for s in subjects:
        days_taught = []
        for d in days:
            day_vars = [v for k, v in vars.items() if f'_s{s.id}_' in k and f'_d{d}_' in k]
            if day_vars:
                day_used = model.NewBoolVar(f'day_used_s{s.id}_d{d}')
                model.Add(sum(day_vars) >= 1).OnlyEnforceIf(day_used)
                model.Add(sum(day_vars) == 0).OnlyEnforceIf(day_used.Not())
                days_taught.append(day_used)
        # Reward = number of distinct days subject is taught
        if len(days_taught) > 1:
            rewards.append((days_taught, int(weight)))
    return rewards

def get_faculty_preference_rewards(model, vars: Dict, faculty_data, weight: float = 80) -> List:
    """Reward scheduling faculty in their preferred periods and days."""
    rewards = []
    for faculty in faculty_data:
        for pref_day in (faculty.preferred_days or []):
            for pref_period in (faculty.preferred_periods or []):
                pref_vars = [v for k, v in vars.items()
                            if f'_f{faculty.id}_' in k and f'_d{pref_day}_' in k and k.endswith(f'_p{pref_period}')]
                if pref_vars:
                    teaches_in_pref = model.NewBoolVar(f'pref_{faculty.id}_d{pref_day}_p{pref_period}')
                    model.Add(sum(pref_vars) >= 1).OnlyEnforceIf(teaches_in_pref)
                    model.Add(sum(pref_vars) == 0).OnlyEnforceIf(teaches_in_pref.Not())
                    rewards.append((teaches_in_pref, int(weight)))
    return rewards
