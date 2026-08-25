"""
SEC Timetable Report Generator
Generates official Sudharsan Engineering College format timetables:
  - Master Class Timetable (like the image)
  - Individual Staff Timetables
  - Principal Dashboard (all timetables)
"""

import os, json
from pathlib import Path

# ─── AI&DS IV Year Sem VII DATA (2026-2027) ───────────────────────────────────
COLLEGE = {
    "name": "SUDHARSAN ENGINEERING COLLEGE",
    "tag": "An Autonomous Institution",
    "approval": "(Approved by AICTE, New Delhi | Affiliated to Anna University, Chennai | Accredited by NAAC with 'A' Grade)",
    "address": "Sathiyamangalam, Kulathur (TK), Pudukkottai District – 622 501",
    "mobile": "98434 90901",
    "website": "www.sec.ac.in",
    "email": "principal@sec.ac.in",
    "logo": "https://www.sec.ac.in/assets/images/sec-logo.png",
}

DEPT = {
    "name": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
    "branch": "B.Tech – AI&DS",
    "year": "IV",
    "semester": "VII",
    "hall": "202",
    "academic_year": "2026 – 2027",
    "effect_date": "01.08.2026",
    "class_coordinator": "Ms. M. Sowmiya, AP/AI&DS",
    "faculty_advisors": [
        "Ms. M. Porkodi, AP/AI&DS — Roll No (1–29)",
        "Ms. M. Sowmiya, AP/AI&DS — Roll No (30–57)",
    ],
}

# Period timings (7 periods per day like SEC format)
PERIODS = [
    {"num": 1, "start": "09:00 AM", "end": "09:50 AM"},
    {"num": 2, "start": "09:50 AM", "end": "10:40 AM"},
    {"num": "B", "start": "10:40 AM", "end": "10:55 AM", "is_break": True, "label": "BREAK"},
    {"num": 3, "start": "10:55 AM", "end": "11:45 AM"},
    {"num": 4, "start": "11:45 AM", "end": "12:35 PM"},
    {"num": "L", "start": "12:35 PM", "end": "01:20 PM", "is_break": True, "label": "LUNCH"},
    {"num": 5, "start": "01:20 PM", "end": "02:10 PM"},
    {"num": 6, "start": "02:10 PM", "end": "03:00 PM"},
    {"num": 7, "start": "03:00 PM", "end": "03:50 PM"},
]

# Faculty (code → details)
FACULTY = {
    "PKT": {"name": "Mrs. T. Porkodi",         "short": "PKT", "dept": "AP/AI&DS",  "full_name": "Mrs. T. Porkodi (HOD)"},
    "SWM": {"name": "Ms. M. Sowmiya",           "short": "SWM", "dept": "AP/AI&DS",  "full_name": "Ms. M. Sowmiya"},
    "SEL": {"name": "Mrs. N. Selvakumari",      "short": "SEL", "dept": "AP/AI&DS",  "full_name": "Mrs. N. Selvakumari"},
    "IND": {"name": "Mrs. P. Indu",             "short": "IND", "dept": "AP/AI&DS",  "full_name": "Mrs. P. Indu"},
    "DVM": {"name": "Mr. M. Dhavamani",         "short": "DVM", "dept": "AP/AI&DS",  "full_name": "Mr. M. Dhavamani"},
    "JPR": {"name": "Mrs. I. Jeni Priyanga",    "short": "JPR", "dept": "TA/AI&DS",  "full_name": "Mrs. I. Jeni Priyanga"},
    # Cross-dept faculty (from the original timetable image)
    "RVD": {"name": "Mr. K. Vijay Anand",       "short": "RVD", "dept": "AP/PHY",    "full_name": "Mr. K. Vijay Anand"},
    "ARY": {"name": "Ms. A. Rexcy",             "short": "ARY", "dept": "AP/ENG",    "full_name": "Ms. A. Rexcy"},
    "NAR": {"name": "Mr. G. Narayanan",         "short": "NAR", "dept": "AP/CHE",    "full_name": "Mr. G. Narayanan"},
    "BNU": {"name": "Mrs. P. Banu",             "short": "BNU", "dept": "AP/MAT",    "full_name": "Mrs. P. Banu"},
}

# Subjects
SUBJECTS = [
    {
        "code": "AI4011", "name": "Deep Learning",
        "credits": 4, "hrs_per_week": 4,
        "type": "Theory", "faculty_code": "PKT",
        "faculty_display": "Mrs. T. Porkodi",
        "abbr": "DL",
    },
    {
        "code": "AI4021", "name": "Natural Language Processing",
        "credits": 3, "hrs_per_week": 3,
        "type": "Theory", "faculty_code": "SWM",
        "faculty_display": "Ms. M. Sowmiya",
        "abbr": "NLP",
    },
    {
        "code": "AI4031", "name": "Reinforcement Learning",
        "credits": 3, "hrs_per_week": 3,
        "type": "Theory", "faculty_code": "SEL",
        "faculty_display": "Mrs. N. Selvakumari",
        "abbr": "RL",
    },
    {
        "code": "AI4041", "name": "Cloud Computing & IoT",
        "credits": 3, "hrs_per_week": 3,
        "type": "Theory", "faculty_code": "DVM",
        "faculty_display": "Mr. M. Dhavamani",
        "abbr": "CCI",
    },
    {
        "code": "OE4011", "name": "Nano Technology",
        "credits": 3, "hrs_per_week": 3,
        "type": "Theory", "faculty_code": "RVD",
        "faculty_display": "Mr. K. Vijay Anand",
        "abbr": "NT",
    },
    {
        "code": "HS4011", "name": "Professional Ethics",
        "credits": 2, "hrs_per_week": 2,
        "type": "Theory", "faculty_code": "ARY",
        "faculty_display": "Ms. A. Rexcy",
        "abbr": "PE",
    },
    {
        "code": "AI4081", "name": "Deep Learning Lab",
        "credits": 2, "hrs_per_week": 4,
        "type": "Lab", "faculty_code": "PKT",
        "faculty_display": "Mrs. T. Porkodi",
        "abbr": "DLL",
    },
    {
        "code": "AI4091", "name": "NLP Lab",
        "credits": 2, "hrs_per_week": 4,
        "type": "Lab", "faculty_code": "SWM",
        "faculty_display": "Ms. M. Sowmiya",
        "abbr": "NLPL",
    },
    {
        "code": "AI4001P", "name": "Project Phase – II",
        "credits": 6, "hrs_per_week": 6,
        "type": "Project", "faculty_code": "PKT",
        "faculty_display": "Mrs. T. Porkodi",
        "abbr": "PROJ",
    },
]

DAYS = ["MON", "TUE", "WED", "THU", "FRI"]

# Master Class Timetable — 5 days × 7 periods (None=free, "B"=break, "L"=lunch)
# Format: "ABBR(FAC)" or special markers
MASTER_TIMETABLE = {
    #       P1         P2         B      P3         P4          L       P5         P6         P7
    "MON": ["DL(PKT)", "RL(SEL)", "B", "NLP(SWM)", "CCI(DVM)", "L",  "NT(RVD)", "NT(RVD)", "PE(ARY)"],
    "TUE": ["NLP(SWM)","DL(PKT)", "B", "CCI(DVM)", "RL(SEL)",  "L",  "DLL(PKT+IND)", "DLL(PKT+IND)", "DL(PKT)"],
    "WED": ["RL(SEL)", "NT(RVD)", "B", "LIB",      "NLP(SWM)", "L",  "NLPL(SWM+DVM)", "NLPL(SWM+DVM)", "RL(SEL)"],
    "THU": ["CCI(DVM)","PE(ARY)", "B", "DL(PKT)",  "NT(RVD)", "L",  "NLP(SWM)", "RL(SEL)",  "PROJ(PKT)"],
    "FRI": ["PE(ARY)", "NLP(SWM)","B", "DL(PKT)",  "CCI(DVM)", "L",  "PROJ(PKT)", "PROJ(PKT)", "PROJ(PKT)"],
}

# ─── Dynamic Staff Timetables Generation ──────────────────────────────────────
# Automagically generate individual staff/faculty timetables from the master timetable
# as the single source of truth, handling rotating/joint faculty and detecting conflicts.

CONFLICTS = []
CLASSES_MASTER_TIMETABLES = {
    "AIDSIV-A": MASTER_TIMETABLE
}

def generate_dynamic_staff_timetables():
    staff_tt = {}
    
    # Initialize empty schedules for all registered faculty
    for code in FACULTY:
        staff_tt[code] = {day: [None] * len(PERIODS) for day in DAYS}
        
    for class_code, master_tt in CLASSES_MASTER_TIMETABLES.items():
        for day in DAYS:
            slots = master_tt.get(day, [])
            for idx, slot in enumerate(slots):
                # Skip break and lunch slots
                if idx < len(PERIODS) and PERIODS[idx].get("is_break"):
                    continue
                if not slot or slot in ("B", "L", "LIB"):
                    continue
                
                # Parse slot format e.g. "DL(PKT)" or "DLL(PKT+IND)"
                if "(" in slot and ")" in slot:
                    parts = slot.split("(")
                    subj_abbr = parts[0]
                    fac_part = parts[1].rstrip(")")
                    
                    # Split by "+" for joint faculty
                    fac_codes = fac_part.split("+")
                    for f_code in fac_codes:
                        f_code = f_code.strip()
                        
                        # Handle unassigned or unknown faculty codes
                        if f_code not in FACULTY:
                            FACULTY[f_code] = {
                                "name": f"Unassigned Staff ({f_code})",
                                "short": f_code,
                                "dept": "Unknown",
                                "full_name": f"Unassigned ({f_code})"
                            }
                            print(f"⚠️ Warning: Faculty '{f_code}' not found in FACULTY list. Created placeholder.")
                            
                        if f_code not in staff_tt:
                            staff_tt[f_code] = {d: [None] * len(PERIODS) for d in DAYS}
                            
                        existing = staff_tt[f_code][day][idx]
                        new_val = f"{subj_abbr}({class_code})"
                        
                        if existing:
                            # Conflict / Double-booking detected
                            CONFLICTS.append({
                                "faculty": f_code,
                                "day": day,
                                "period": PERIODS[idx]["num"],
                                "existing": existing,
                                "new": new_val
                            })
                            staff_tt[f_code][day][idx] += f" + {new_val}"
                        else:
                            staff_tt[f_code][day][idx] = new_val
    return staff_tt

STAFF_TIMETABLES = generate_dynamic_staff_timetables()


DAYS = ["MON", "TUE", "WED", "THU", "FRI"]
DAY_FULL = {"MON": "MONDAY", "TUE": "TUESDAY", "WED": "WEDNESDAY", "THU": "THURSDAY", "FRI": "FRIDAY"}

# ─── HTML Generation ────────────────────────────────────────────────────────────

CELL_COLORS = {
    "DL":   "#dbeafe",  # blue
    "NLP":  "#d1fae5",  # green
    "RL":   "#fef3c7",  # amber
    "CCI":  "#ede9fe",  # violet
    "NT":   "#fee2e2",  # red
    "PE":   "#fce7f3",  # pink
    "DLL":  "#bfdbfe",  # blue darker (lab)
    "NLPL": "#a7f3d0",  # green darker (lab)
    "PROJ": "#f3f4f6",  # gray (project)
    "LIB":  "#e5e7eb",  # light gray
    "B":    "#f1f5f9",  # break
    "L":    "#f1f5f9",  # lunch
}

def cell_color(cell_val):
    if not cell_val:
        return "#ffffff"
    for k, v in CELL_COLORS.items():
        if cell_val.startswith(k):
            return v
    return "#f9fafb"

def header_html():
    return f"""
    <div class="college-header">
        <div class="logo-area">
            <img src="{COLLEGE['logo']}" onerror="this.style.display='none'" class="college-logo" alt="SEC">
        </div>
        <div class="college-info">
            <h1 class="college-name">{COLLEGE['name']}</h1>
            <h3 class="college-tag">{COLLEGE['tag']}</h3>
            <p class="college-approval">{COLLEGE['approval']}</p>
            <p class="college-address">{COLLEGE['address']}</p>
            <p class="college-contact">Mobile No: {COLLEGE['mobile']} &nbsp;|&nbsp; Website: <a href="https://{COLLEGE['website']}">{COLLEGE['website']}</a> &nbsp;|&nbsp; Email: {COLLEGE['email']}</p>
        </div>
    </div>"""

def render_cell(cell_val):
    if not cell_val:
        return '<td class="tt-cell empty">—</td>'
    if cell_val == "B":
        return '<td class="tt-cell break-cell" rowspan="1">B<br>R<br>E<br>A<br>K</td>'
    if cell_val == "L":
        return '<td class="tt-cell lunch-cell" rowspan="1">L<br>U<br>N<br>C<br>H</td>'
    if cell_val == "LIB":
        return '<td class="tt-cell lib-cell">LIB</td>'
    color = cell_color(cell_val)
    # Parse ABBR(FAC) format
    if "(" in cell_val:
        abbr, fac = cell_val.split("(", 1)
        fac = fac.rstrip(")")
        return f'<td class="tt-cell subject-cell" style="background:{color}"><span class="subj-abbr">{abbr}</span><br><span class="fac-code">({fac})</span></td>'
    return f'<td class="tt-cell subject-cell" style="background:{color}">{cell_val}</td>'

def render_staff_cell(cell_val):
    if not cell_val:
        return '<td class="tt-cell empty">—</td>'
    color = cell_color(cell_val.split("(")[0]) if "(" in cell_val else "#f9fafb"
    if "(" in cell_val:
        subj, cls = cell_val.split("(", 1)
        cls = cls.rstrip(")")
        return f'<td class="tt-cell subject-cell" style="background:{color}"><span class="subj-abbr">{subj}</span><br><span class="fac-code">{cls}</span></td>'
    return f'<td class="tt-cell subject-cell" style="background:{color}">{cell_val}</td>'

def master_timetable_html():
    rows = ""
    for day in DAYS:
        cells = MASTER_TIMETABLE[day]
        row = f'<tr><td class="day-cell">{day}</td>'
        i = 0
        for period in PERIODS:
            if period.get("is_break"):
                row += f'<td class="break-cell" rowspan="5" style="writing-mode:vertical-lr;text-align:center;font-weight:bold;background:#f0f4f8;font-size:11px">{period["label"]}</td>' if day == "MON" else ''
            else:
                row += render_cell(cells[i])
                i += 1
        # Fix: count correct index
        row += "</tr>"
        rows += row

    # Rebuild rows properly
    rows = ""
    for di, day in enumerate(DAYS):
        cells = MASTER_TIMETABLE[day]  # 9 elements (incl B and L markers)
        row = f'<tr><td class="day-cell">{day}</td>'
        for j, period in enumerate(PERIODS):
            if period.get("is_break"):
                if di == 0:
                    row += f'<td class="break-cell" rowspan="5"><div class="break-text">{period["label"]}</div></td>'
            else:
                row += render_cell(cells[j])
        row += "</tr>"
        rows += row

    # Period header row
    period_header = "<tr><th class='corner-cell'>PERIOD</th>"
    time_header   = "<tr><th class='corner-cell'>DAY/TIME</th>"
    for period in PERIODS:
        if period.get("is_break"):
            continue
        period_header += f"<th class='period-th'>{period['num']}</th>"
        time_header   += f"<th class='time-th'>{period['start']}<br>–<br>{period['end']}</th>"
    period_header += "</tr>"
    time_header   += "</tr>"

    # Subjects table
    subj_rows = ""
    for i, s in enumerate(SUBJECTS, 1):
        fac_name = FACULTY[s['faculty_code']]['full_name']
        fac_dept = FACULTY[s['faculty_code']]['dept']
        subj_rows += f"""
        <tr>
            <td class="subj-td">{i}</td>
            <td class="subj-td code">{s['code']}</td>
            <td class="subj-td">{s['name']}</td>
            <td class="subj-td center">{s['credits']}</td>
            <td class="subj-td">{fac_name}</td>
            <td class="subj-td center">{fac_dept}</td>
            <td class="subj-td center">{s['hrs_per_week']}</td>
        </tr>"""

    advisor_lines = " &nbsp;|&nbsp; ".join(DEPT['faculty_advisors'])

    return f"""
    <div class="timetable-section">
        <h2 class="dept-title">DEPARTMENT OF {DEPT['name']}</h2>
        <h3 class="tt-title">TIME TABLE – ODD SEMESTER ({DEPT['academic_year']})</h3>
        <div class="tt-meta">
            <span><b>BRANCH:</b> {DEPT['branch']}</span>
            <span><b>YEAR:</b> {DEPT['year']}</span>
            <span><b>SEMESTER:</b> {DEPT['semester']}</span>
            <span><b>HALL:</b> {DEPT['hall']}</span>
            <span><b>With effect from:</b> {DEPT['effect_date']}</span>
        </div>
        <div class="tt-wrapper">
            <table class="timetable">
                <thead>
                    {period_header}
                    {time_header}
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>
        </div>

        <div class="subjects-table-wrapper">
            <table class="subjects-table">
                <thead>
                    <tr>
                        <th>S.NO</th>
                        <th>SUB CODE</th>
                        <th>SUBJECT</th>
                        <th>CREDIT</th>
                        <th>FACULTY NAME</th>
                        <th>DESIGNATION & DEPT.</th>
                        <th>NO. HRS/WEEK</th>
                    </tr>
                </thead>
                <tbody>{subj_rows}</tbody>
            </table>
        </div>

        <div class="footer-info">
            <div><b>CLASS COORDINATOR:</b> {DEPT['class_coordinator']}</div>
            <div><b>FACULTY ADVISOR:</b> {advisor_lines}</div>
        </div>
    </div>"""

def staff_timetable_html(fac_code):
    fac = FACULTY[fac_code]
    sched = STAFF_TIMETABLES.get(fac_code, {})

    period_header = "<tr><th class='corner-cell'>PERIOD</th>"
    time_header   = "<tr><th class='corner-cell'>DAY/TIME</th>"
    for period in PERIODS:
        if period.get("is_break"):
            continue
        period_header += f"<th class='period-th'>{period['num']}</th>"
        time_header   += f"<th class='time-th'>{period['start']}<br>–<br>{period['end']}</th>"
    period_header += "</tr>"
    time_header   += "</tr>"

    rows = ""
    total_hrs = 0
    for di, day in enumerate(DAYS):
        slots = sched.get(day, [None]*9)
        row = f'<tr><td class="day-cell">{day}</td>'
        pi = 0
        for j, period in enumerate(PERIODS):
            if period.get("is_break"):
                if di == 0:
                    row += f'<td class="break-cell" rowspan="5"><div class="break-text">{period["label"]}</div></td>'
            else:
                val = slots[j] if j < len(slots) else None
                if val:
                    total_hrs += 1
                row += render_staff_cell(val)
                pi += 1
        row += "</tr>"
        rows += row

    # Subjects taught
    taught = [s for s in SUBJECTS if s['faculty_code'] == fac_code]
    subj_rows = ""
    for s in taught:
        subj_rows += f"""
        <tr>
            <td class="subj-td">{s['code']}</td>
            <td class="subj-td">{s['name']}</td>
            <td class="subj-td center">{s['type']}</td>
            <td class="subj-td center">{s['hrs_per_week']} hrs</td>
        </tr>"""

    return f"""
    <div class="timetable-section staff-section">
        <div class="staff-header">
            <div class="staff-name-block">
                <h2 class="staff-name">{fac['full_name']}</h2>
                <span class="staff-dept-badge">{fac['dept']}</span>
            </div>
            <div class="staff-stats">
                <div class="stat-box">
                    <span class="stat-num">{total_hrs}</span>
                    <span class="stat-label">Periods/Week</span>
                </div>
                <div class="stat-box">
                    <span class="stat-num">{len(taught)}</span>
                    <span class="stat-label">Subjects</span>
                </div>
            </div>
        </div>
        <h3 class="tt-title">PERSONAL TIMETABLE – {fac['full_name'].upper()}</h3>
        <div class="tt-meta">
            <span><b>DEPARTMENT:</b> AI&DS</span>
            <span><b>YEAR:</b> 2026 – 2027</span>
            <span><b>SEMESTER:</b> VII (ODD)</span>
        </div>
        <div class="tt-wrapper">
            <table class="timetable">
                <thead>
                    {period_header}
                    {time_header}
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
        <div class="subjects-table-wrapper">
            <table class="subjects-table">
                <thead>
                    <tr><th>SUB CODE</th><th>SUBJECT NAME</th><th>TYPE</th><th>HOURS/WEEK</th></tr>
                </thead>
                <tbody>{subj_rows if subj_rows else '<tr><td colspan="4" style="text-align:center;color:#888">Cross-department teaching</td></tr>'}</tbody>
            </table>
        </div>
    </div>"""

def principal_summary_html():
    # Workload summary
    rows = ""
    for fc, fac in FACULTY.items():
        taught = [s for s in SUBJECTS if s['faculty_code'] == fc]
        total_hrs = sum(s['hrs_per_week'] for s in taught)
        subj_names = ", ".join(s['abbr'] for s in taught) if taught else "Cross-dept"
        status = "🟢 Optimal" if 14 <= total_hrs <= 22 else ("🟡 Light" if total_hrs < 14 else "🔴 Overloaded")
        rows += f"""
        <tr>
            <td class="subj-td">{fac['full_name']}</td>
            <td class="subj-td center">{fac['dept']}</td>
            <td class="subj-td center">{subj_names}</td>
            <td class="subj-td center">{total_hrs}</td>
            <td class="subj-td center">{status}</td>
        </tr>"""

    return f"""
    <div class="timetable-section principal-section">
        <h2 class="dept-title">🎓 PRINCIPAL'S DASHBOARD — TIMETABLE OVERVIEW</h2>
        <h3 class="tt-title">FACULTY WORKLOAD & ALLOCATION — AI&DS DEPT. | SEM VII 2026-27</h3>
        <div class="stats-grid">
            <div class="stat-card blue"><div class="sc-num">{len(SUBJECTS)}</div><div class="sc-label">Subjects Scheduled</div></div>
            <div class="stat-card green"><div class="sc-num">{len([f for f in STAFF_TIMETABLES])}</div><div class="sc-label">Faculty Active</div></div>
            <div class="stat-card purple"><div class="sc-num">5 × 7</div><div class="sc-label">Periods/Week</div></div>
            <div class="stat-card amber"><div class="sc-num">0</div><div class="sc-label">Conflicts</div></div>
        </div>
        <div class="subjects-table-wrapper" style="margin-top:20px">
            <table class="subjects-table">
                <thead>
                    <tr>
                        <th>FACULTY NAME</th>
                        <th>DEPT.</th>
                        <th>SUBJECTS ASSIGNED</th>
                        <th>TOTAL HRS/WEEK</th>
                        <th>WORKLOAD STATUS</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>

        <div class="subject-allocation-grid">
            <h3 style="margin:24px 0 12px;color:#1e3a5f">📋 Complete Subject – Faculty Allocation</h3>
            <table class="subjects-table">
                <thead>
                    <tr><th>S.No</th><th>Code</th><th>Subject</th><th>Credits</th><th>Type</th><th>Faculty</th><th>Dept.</th><th>Hrs/Week</th></tr>
                </thead>
                <tbody>
                    {''.join(f"""
                    <tr>
                        <td class='subj-td center'>{i}</td>
                        <td class='subj-td code'>{s['code']}</td>
                        <td class='subj-td'>{s['name']}</td>
                        <td class='subj-td center'>{s['credits']}</td>
                        <td class='subj-td center'>{'🧪 ' if s['type']=='Lab' else ('🎓 ' if s['type']=='Project' else '📖 ')}{s['type']}</td>
                        <td class='subj-td'>{FACULTY[s['faculty_code']]['full_name']}</td>
                        <td class='subj-td center'>{FACULTY[s['faculty_code']]['dept']}</td>
                        <td class='subj-td center'>{s['hrs_per_week']}</td>
                    </tr>""" for i, s in enumerate(SUBJECTS, 1))}
                </tbody>
            </table>
        </div>
    </div>"""

CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Times New Roman', serif; background: #f5f7fa; color: #1a1a2e; }

.page-wrapper { max-width: 1400px; margin: 0 auto; padding: 20px; }

/* NAV TABS */
.tab-nav { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tab-btn {
    padding: 10px 20px; background: #fff; border: 2px solid #1e3a5f; border-radius: 8px;
    cursor: pointer; font-weight: bold; font-size: 13px; color: #1e3a5f; transition: all .2s;
}
.tab-btn:hover, .tab-btn.active { background: #1e3a5f; color: #fff; }
.tab-content { display: none; }
.tab-content.active { display: block; }

/* COLLEGE HEADER */
.college-header {
    display: flex; align-items: center; gap: 20px;
    background: #fff; border: 2px solid #1e3a5f; border-radius: 10px;
    padding: 16px 24px; margin-bottom: 20px;
    box-shadow: 0 2px 12px rgba(30,58,95,.1);
}
.college-logo { width: 80px; height: 80px; object-fit: contain; }
.college-info { flex: 1; text-align: center; }
.college-name { font-size: 26px; font-weight: bold; color: #1e3a5f; letter-spacing: 1px; }
.college-tag { font-size: 14px; color: #c0392b; margin: 2px 0; }
.college-approval { font-size: 11px; color: #555; }
.college-address, .college-contact { font-size: 12px; margin-top: 2px; }
.college-contact a { color: #1e3a5f; }

/* TIMETABLE SECTION */
.timetable-section {
    background: #fff; border-radius: 12px; padding: 24px;
    margin-bottom: 28px; border: 1px solid #e2e8f0;
    box-shadow: 0 2px 16px rgba(0,0,0,.06);
}
.dept-title { font-size: 18px; font-weight: bold; text-align: center; color: #1e3a5f; margin-bottom: 4px; }
.tt-title { font-size: 15px; font-weight: bold; text-align: center; color: #333; margin-bottom: 12px; }
.tt-meta {
    display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;
    font-size: 13px; margin-bottom: 16px; padding: 10px;
    background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
}
.tt-meta span { font-family: Arial, sans-serif; }

/* TIMETABLE TABLE */
.tt-wrapper { overflow-x: auto; }
.timetable { width: 100%; border-collapse: collapse; font-size: 12px; }
.timetable th, .timetable td { border: 1px solid #aab; text-align: center; }
.corner-cell { background: #1e3a5f; color: #fff; padding: 8px 12px; font-size: 12px; }
.period-th { background: #1e3a5f; color: #fff; padding: 8px 14px; min-width: 60px; }
.time-th { background: #2c5282; color: #fff; padding: 6px 10px; font-size: 10px; min-width: 80px; }
.day-cell { background: #1e3a5f; color: #fff; font-weight: bold; padding: 10px 14px; font-size: 13px; }
.tt-cell { padding: 10px 6px; min-width: 80px; vertical-align: middle; }
.tt-cell.empty { color: #bbb; font-size: 18px; }
.break-cell { background: #f0f4f8; color: #1e3a5f; font-weight: bold; font-size: 11px; padding: 4px; writing-mode: vertical-rl; text-orientation: mixed; }
.lib-cell { background: #f3f4f6; color: #555; font-style: italic; }
.subj-abbr { font-weight: bold; font-size: 13px; color: #1e3a5f; }
.fac-code { font-size: 10px; color: #555; }
.break-text { writing-mode: vertical-rl; text-orientation: mixed; letter-spacing: 3px; }

/* SUBJECTS TABLE */
.subjects-table-wrapper { margin-top: 20px; overflow-x: auto; }
.subjects-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.subjects-table th { background: #1e3a5f; color: #fff; padding: 8px 12px; text-align: center; }
.subjects-table tr:nth-child(even) { background: #f8fafc; }
.subjects-table tr:hover { background: #e8f0fe; }
.subj-td { padding: 8px 12px; border: 1px solid #dde; }
.subj-td.code { font-family: monospace; font-weight: bold; color: #1e3a5f; }
.subj-td.center { text-align: center; }

/* FOOTER INFO */
.footer-info { margin-top: 14px; padding: 10px 16px; background: #f8fafc; border-radius: 8px; font-size: 12px; }
.footer-info div { margin-bottom: 4px; }

/* STAFF SECTION */
.staff-section { border-left: 4px solid #2563eb; }
.staff-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.staff-name-block { display: flex; align-items: center; gap: 12px; }
.staff-name { font-size: 20px; color: #1e3a5f; }
.staff-dept-badge { background: #2563eb; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
.staff-stats { display: flex; gap: 16px; }
.stat-box { text-align: center; background: #f0f4f8; border-radius: 8px; padding: 10px 18px; }
.stat-num { display: block; font-size: 22px; font-weight: bold; color: #1e3a5f; }
.stat-label { font-size: 10px; color: #666; }

/* PRINCIPAL SECTION */
.principal-section { border-left: 4px solid #7c3aed; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }
.stat-card { border-radius: 12px; padding: 20px; text-align: center; color: #fff; }
.stat-card.blue   { background: linear-gradient(135deg, #1d4ed8, #3b82f6); }
.stat-card.green  { background: linear-gradient(135deg, #065f46, #10b981); }
.stat-card.purple { background: linear-gradient(135deg, #5b21b6, #8b5cf6); }
.stat-card.amber  { background: linear-gradient(135deg, #92400e, #f59e0b); }
.sc-num { font-size: 32px; font-weight: bold; }
.sc-label { font-size: 13px; opacity: .9; }
@media print {
    .tab-nav { display: none; }
    .tab-content { display: block !important; }
    .timetable-section { page-break-after: always; }
}
"""

def generate_html():
    # Build tab nav
    tabs_nav = """
    <div class="tab-nav">
        <button class="tab-btn active" onclick="showTab('master')">📋 Master Timetable (AI&DS IV Year)</button>
    """
    for fc in STAFF_TIMETABLES:
        fac = FACULTY[fc]
        tabs_nav += f'<button class="tab-btn" onclick="showTab(\'staff_{fc}\')">👤 {fac["name"]}</button>\n'
    tabs_nav += '<button class="tab-btn" onclick="showTab(\'principal\')">🎓 Principal Dashboard</button>'
    tabs_nav += "</div>"

    # Build tab contents
    tab_contents = f'<div id="tab-master" class="tab-content active">{master_timetable_html()}</div>'
    for fc in STAFF_TIMETABLES:
        tab_contents += f'<div id="tab-staff_{fc}" class="tab-content">{staff_timetable_html(fc)}</div>'
    tab_contents += f'<div id="tab-principal" class="tab-content">{principal_summary_html()}</div>'

    js = """
    function showTab(name) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-' + name).classList.add('active');
        event.target.classList.add('active');
    }
    """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SEC – AI&DS IV Year Timetable 2026-27</title>
<style>{CSS}</style>
</head>
<body>
<div class="page-wrapper">
    {header_html()}
    {tabs_nav}
    {tab_contents}
</div>
<script>{js}</script>
</body>
</html>"""
    return html

if __name__ == "__main__":
    out_dir = Path(__file__).parent.parent.parent  # TIMETABLEAI root
    out_path = out_dir / "sec_aids_timetable.html"
    html = generate_html()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[OK] Timetable HTML generated: {out_path}")
    print(f"   Open in browser: file:///{out_path}")

    # Also save a JSON export
    export = {
        "college": COLLEGE,
        "department": DEPT,
        "academic_year": "2026-2027",
        "semester": "VII",
        "subjects": SUBJECTS,
        "faculty": FACULTY,
        "master_timetable": MASTER_TIMETABLE,
        "periods": PERIODS,
    }
    json_path = out_dir / "sec_aids_timetable.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export, f, indent=2, ensure_ascii=False)
    print(f"[OK] JSON export saved: {json_path}")
