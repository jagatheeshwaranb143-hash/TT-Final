'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Department { id: string; name: string; code: string; faculty_count: number; subject_count: number; }
interface Program     { id: string; name: string; code: string; duration_years: number; }
interface AcademicYear { id: string; name: string; is_current: boolean; }
interface Semester    { id: string; name: string; number: number; }
interface Faculty     { id: string; name: string; code: string; email: string; max_hours_per_week: number; }
interface Room        { id: string; name: string; building: string; capacity: number; }
interface Lab         { id: string; name: string; capacity: number; }

interface SubjectRow {
  _key: string;      // local React key
  id?: string;       // DB uuid if existing
  code: string;
  name: string;
  subject_type: 'theory' | 'lab' | 'project';
  credits: number;
  weekly_periods: number;
  requires_consecutive: boolean;
  consecutive_count: number;
  faculty_id: string;
}

interface BlockedSlot { faculty_id: string; day_of_week: number; period_number: number; }

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Context',   icon: '🏫' },
  { num: 2, label: 'Subjects',  icon: '📚' },
  { num: 3, label: 'Faculty',   icon: '👨‍🏫' },
  { num: 4, label: 'Rooms',     icon: '🚪' },
  { num: 5, label: 'Generate',  icon: '🚀' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];
const YEAR_LEVELS = [
  { value: 1, label: 'I Year' },
  { value: 2, label: 'II Year' },
  { value: 3, label: 'III Year' },
  { value: 4, label: 'IV Year' },
];

const TYPE_COLOR: Record<string, string> = {
  theory:  '#dbeafe',
  lab:     '#d1fae5',
  project: '#fef3c7',
};

const TYPE_BADGE: Record<string, string> = {
  theory:  '#2563eb',
  lab:     '#059669',
  project: '#d97706',
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page:     { padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  card:     { background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,.06)', padding: '2rem' } as React.CSSProperties,
  label:    { display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '6px', letterSpacing: 0 },
  input:    { width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' as const },
  select:   { width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', background: '#f8fafc', cursor: 'pointer', boxSizing: 'border-box' as const },
  btnPrimary:   { background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: 'white', border: 'none', padding: '0.75rem 1.75rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
  btnSecondary: { background: 'white', color: '#374151', border: '1.5px solid #e2e8f0', padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' } as React.CSSProperties,
  btnDanger:    { background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' } as React.CSSProperties,
  badge:    (color: string) => ({ background: color, color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }) as React.CSSProperties,
  grid2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' } as React.CSSProperties,
  grid3:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' } as React.CSSProperties,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TimetableSetupWizard() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);

  // Dropdown data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms]       = useState<Program[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters]     = useState<Semester[]>([]);
  const [allFaculty, setAllFaculty]   = useState<Faculty[]>([]);
  const [rooms, setRooms]             = useState<Room[]>([]);
  const [labs, setLabs]               = useState<Lab[]>([]);

  // Step 1
  const [deptId, setDeptId]         = useState('');
  const [programId, setProgramId]   = useState('');
  const [yearLevel, setYearLevel]   = useState(1);
  const [acadYearId, setAcadYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const section = 'A'; // Internal compatibility value; sections are not shown in the UI.
  const [strength, setStrength]     = useState(60);
  const [hallNo, setHallNo]         = useState('');

  // Step 2
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);

  // Step 3 — blocked slots map: facultyId → Set of "day-period" strings
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);

  // Step 4
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedLabs, setSelectedLabs]   = useState<string[]>([]);
  const [workingDays, setWorkingDays]     = useState<number[]>([1, 2, 3, 4, 5]);

  // ── Boot: load dropdown data ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [depts, years] = await Promise.all([
          api.deptSetup.departmentsSummary() as Promise<Department[]>,
          api.academicYears.list() as Promise<AcademicYear[]>,
        ]);
        setDepartments(depts);
        setAcademicYears(years);
        if (years.length > 0) {
          const current = years.find((y: AcademicYear) => y.is_current) || years[0];
          setAcadYearId(current.id);
          const sems = await api.academicYears.semesters(current.id) as Semester[];
          setSemesters(sems);
          if (sems.length > 0) setSemesterId(sems[0].id);
        }
      } catch (e: any) {
        toast.error('Failed to load initial data: ' + e.message);
      }
    })();
  }, []);

  // ── When dept changes: load programs + faculty + rooms ────────────────────
  useEffect(() => {
    if (!deptId) return;
    (async () => {
      try {
        const [progs, fac, rms, lbs] = await Promise.all([
          api.departments.programs(deptId) as Promise<Program[]>,
          // Faculty can be assigned to classes in any department.
          api.faculty.list() as Promise<Faculty[]>,
          api.rooms.list({ department_id: deptId }) as Promise<Room[]>,
          api.labs.list() as Promise<Lab[]>,
        ]);
        setPrograms(progs);
        if (progs.length > 0) setProgramId(progs[0].id);
        setAllFaculty(fac);
        setRooms(rms);
        setLabs(lbs);
      } catch (e: any) {
        console.error(e);
      }
    })();
  }, [deptId]);

  // ── When academic year changes: reload semesters ──────────────────────────
  useEffect(() => {
    if (!acadYearId) return;
    api.academicYears.semesters(acadYearId).then((sems: any) => {
      setSemesters(sems);
      if (sems.length > 0) setSemesterId(sems[0].id);
    });
  }, [acadYearId]);

  // ── Pre-fill from DB when dept + year selected ────────────────────────────
  const prefillFromDB = useCallback(async () => {
    if (!deptId) return;
    try {
      const data: any = await api.deptSetup.get(deptId, yearLevel, semesterId || undefined);
      if (data.subjects?.length > 0) {
        setSubjects(data.subjects.map((s: any) => ({
          _key: s.id || Math.random().toString(36).slice(2),
          id: s.id,
          code: s.code,
          name: s.name,
          subject_type: (s.subject_type?.toLowerCase() || 'theory') as any,
          credits: s.credits,
          weekly_periods: s.weekly_periods || s.contact_hours_per_week || 3,
          requires_consecutive: false,
          consecutive_count: 2,
          faculty_id: s.faculty_id || '',
        })));
        toast.success(`Pre-filled ${data.subjects.length} existing subjects`);
      }
      // Keep the college-wide faculty list loaded above. The setup response
      // retains its department-only faculty payload for compatibility.
      if (data.rooms?.length > 0)   setRooms(data.rooms);
      if (data.labs?.length > 0)    setLabs(data.labs);
      if (data.programs?.length > 0) {
        setPrograms(data.programs);
        if (!programId) setProgramId(data.programs[0].id);
      }
    } catch (e) {
      // No existing data — that's fine
    }
  }, [deptId, yearLevel, semesterId, programId]);

  // ── Add a blank subject row ───────────────────────────────────────────────
  const addSubject = () => {
    setSubjects(prev => [...prev, {
      _key: Math.random().toString(36).slice(2),
      code: '', name: '', subject_type: 'theory',
      credits: 3, weekly_periods: 3,
      requires_consecutive: false, consecutive_count: 2,
      faculty_id: '',
    }]);
  };

  const updateSubject = (key: string, field: keyof SubjectRow, val: any) => {
    setSubjects(prev => prev.map(s => s._key === key ? { ...s, [field]: val } : s));
  };

  const removeSubject = (key: string) => {
    setSubjects(prev => prev.filter(s => s._key !== key));
  };

  // ── Toggle blocked slot ───────────────────────────────────────────────────
  const toggleBlock = (facultyId: string, day: number, period: number) => {
    const key = `${facultyId}-${day}-${period}`;
    const existing = blockedSlots.find(b => b.faculty_id === facultyId && b.day_of_week === day && b.period_number === period);
    if (existing) {
      setBlockedSlots(prev => prev.filter(b => !(b.faculty_id === facultyId && b.day_of_week === day && b.period_number === period)));
    } else {
      setBlockedSlots(prev => [...prev, { faculty_id: facultyId, day_of_week: day, period_number: period }]);
    }
  };

  const isBlocked = (fid: string, day: number, period: number) =>
    blockedSlots.some(b => b.faculty_id === fid && b.day_of_week === day && b.period_number === period);

  // ── Save wizard data ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!deptId || !programId || !acadYearId || !semesterId) {
      toast.error('Please complete Step 1 before saving.'); return;
    }
    setSaving(true);
    try {
      const payload = {
        department_id: deptId,
        program_id: programId,
        academic_year_id: acadYearId,
        semester_id: semesterId,
        year_level: yearLevel,
        section,
        student_strength: strength,
        hall_number: hallNo,
        subjects: subjects.map(s => ({
          id: s.id,
          code: s.code,
          name: s.name,
          subject_type: s.subject_type,
          credits: s.credits,
          weekly_periods: s.weekly_periods,
          requires_consecutive: s.requires_consecutive,
          consecutive_count: s.consecutive_count,
          faculty_id: s.faculty_id || null,
          preferred_days: [],
          restricted_days: [],
          preferred_period_numbers: [],
          restricted_period_numbers: [],
        })),
        blocked_slots: blockedSlots,
        room_ids: selectedRooms,
        lab_ids: selectedLabs,
        working_days: workingDays,
      };
      const res: any = await api.deptSetup.save(payload);
      toast.success(res.message || 'Data saved successfully!');
      return true;
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Generate timetable ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const saved = await handleSave();
    if (!saved) return;
    setGenerating(true);
    setJobStatus(null);
    try {
      const res: any = await api.deptSetup.generate({
        department_id: deptId,
        semester_id: semesterId,
        academic_year_id: acadYearId,
        version_name: `Wizard – Year ${yearLevel}`,
        time_limit_seconds: 120,
      });
      setJobId(res.job_id || null);
      toast.success('Generation started! Polling status…');
      // Poll status
      if (res.job_id) {
        const poll = setInterval(async () => {
          try {
            const status: any = await api.timetable.status(res.job_id);
            setJobStatus(status);
            if (status.status === 'completed' || status.status === 'failed') {
              clearInterval(poll);
              setGenerating(false);
              if (status.status === 'completed') {
                toast.success('Timetable generated successfully!');
              } else {
                toast.error('Generation failed: ' + status.message);
              }
            }
          } catch { clearInterval(poll); setGenerating(false); }
        }, 2500);
      } else {
        setGenerating(false);
      }
    } catch (e: any) {
      toast.error('Generation error: ' + e.message);
      setGenerating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2rem' }}>
      {STEPS.map((st, i) => {
        const done = step > st.num;
        const active = step === st.num;
        return (
          <React.Fragment key={st.num}>
            <div
              onClick={() => st.num < step && setStep(st.num)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                cursor: st.num < step ? 'pointer' : 'default',
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#2563eb' : active ? '#eff6ff' : '#f8fafc',
                border: active ? '2.5px solid #2563eb' : done ? '2.5px solid #2563eb' : '2px solid #e2e8f0',
                fontSize: '18px', fontWeight: 700,
                color: done || active ? '#2563eb' : '#94a3b8',
                transition: 'all .2s',
              }}>
                {done ? '✓' : st.icon}
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: active ? '#2563eb' : '#94a3b8', whiteSpace: 'nowrap' }}>
                {st.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: done ? '#2563eb' : '#e2e8f0', margin: '0 4px', marginBottom: '22px', transition: 'background .3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // ─── Step 1: Context ─────────────────────────────────────────────────────
  const Step1 = () => (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
        Step 1 — Select Department &amp; Year
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
        Choose the department and academic context for this timetable.
      </p>

      <div style={s.grid2}>
        <div>
          <label style={s.label}>Department *</label>
          <select style={s.select} value={deptId} onChange={e => { setDeptId(e.target.value); setSubjects([]); }}>
            <option value="">— Select Department —</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
          {deptId && (
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
              <span style={s.badge('#64748b')}>{departments.find(d=>d.id===deptId)?.faculty_count || 0} Faculty</span>
              <span style={s.badge('#475569')}>{departments.find(d=>d.id===deptId)?.subject_count || 0} Subjects</span>
            </div>
          )}
        </div>

        <div>
          <label style={s.label}>Program *</label>
          <select style={s.select} value={programId} onChange={e => setProgramId(e.target.value)}>
            <option value="">— Select Program —</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </div>

        <div>
          <label style={s.label}>Year Level *</label>
          <select style={s.select} value={yearLevel} onChange={e => setYearLevel(Number(e.target.value))}>
            {YEAR_LEVELS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
        </div>

        <div>
          <label style={s.label}>Academic Year *</label>
          <select style={s.select} value={acadYearId} onChange={e => setAcadYearId(e.target.value)}>
            <option value="">— Select Year —</option>
            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (Current)' : ''}</option>)}
          </select>
        </div>

        <div>
          <label style={s.label}>Semester *</label>
          <select style={s.select} value={semesterId} onChange={e => setSemesterId(e.target.value)}>
            <option value="">— Select Semester —</option>
            {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label style={s.label}>Student Strength</label>
          <input style={s.input} type="number" min={1} max={300} value={strength} onChange={e => setStrength(Number(e.target.value))} />
        </div>

        <div>
          <label style={s.label}>Hall / Room No.</label>
          <input style={s.input} value={hallNo} onChange={e => setHallNo(e.target.value)} placeholder="e.g. 202" />
        </div>
      </div>

      {deptId && (
        <button
          style={{ ...s.btnSecondary, marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={prefillFromDB}
        >
          ♻️ Load Existing Data from DB
        </button>
      )}
    </div>
  );

  // ─── Step 2: Subjects ─────────────────────────────────────────────────────
  const Step2 = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
            Step 2 — Subjects &amp; Courses
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Add all subjects taught this semester for the selected class.
          </p>
        </div>
        <button style={s.btnPrimary} onClick={addSubject}>+ Add Subject</button>
      </div>

      {subjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📚</div>
          <p style={{ color: '#64748b' }}>No subjects added yet. Click "+ Add Subject" to start.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {subjects.map((subj) => (
            <div key={subj._key} style={{
              background: TYPE_COLOR[subj.subject_type] || '#f8fafc',
              border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={s.label}>Code</label>
                  <input style={s.input} value={subj.code} onChange={e => updateSubject(subj._key, 'code', e.target.value)} placeholder="CS3301" />
                </div>
                <div>
                  <label style={s.label}>Subject Name</label>
                  <input style={s.input} value={subj.name} onChange={e => updateSubject(subj._key, 'name', e.target.value)} placeholder="Data Structures" />
                </div>
                <div>
                  <label style={s.label}>Type</label>
                  <select style={s.select} value={subj.subject_type} onChange={e => updateSubject(subj._key, 'subject_type', e.target.value)}>
                    <option value="theory">Theory</option>
                    <option value="lab">Lab</option>
                    <option value="project">Project</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Credits</label>
                  <input style={s.input} type="number" min={1} max={6} value={subj.credits} onChange={e => updateSubject(subj._key, 'credits', Number(e.target.value))} />
                </div>
                <div>
                  <label style={s.label}>Periods/Week</label>
                  <input style={s.input} type="number" min={1} max={14} value={subj.weekly_periods} onChange={e => updateSubject(subj._key, 'weekly_periods', Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <button style={s.btnDanger} onClick={() => removeSubject(subj._key)}>✕ Remove</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={s.label}>Assign Faculty</label>
                  <select style={s.select} value={subj.faculty_id} onChange={e => updateSubject(subj._key, 'faculty_id', e.target.value)}>
                    <option value="">— Select Faculty —</option>
                    {allFaculty.map(f => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
                  </select>
                </div>
                {subj.subject_type === 'lab' && (
                  <>
                    <div>
                      <label style={s.label}>Consecutive?</label>
                      <select style={s.select} value={subj.requires_consecutive ? 'yes' : 'no'} onChange={e => updateSubject(subj._key, 'requires_consecutive', e.target.value === 'yes')}>
                        <option value="no">No</option>
                        <option value="yes">Yes (Lab Block)</option>
                      </select>
                    </div>
                    {subj.requires_consecutive && (
                      <div>
                        <label style={s.label}>Block Size</label>
                        <select style={s.select} value={subj.consecutive_count} onChange={e => updateSubject(subj._key, 'consecutive_count', Number(e.target.value))}>
                          <option value={2}>2 periods</option>
                          <option value={3}>3 periods</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={s.badge(TYPE_BADGE[subj.subject_type] || '#64748b')}>
                  {subj.subject_type.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {subj.credits} credit{subj.credits !== 1 ? 's' : ''} • {subj.weekly_periods} period{subj.weekly_periods !== 1 ? 's' : ''}/week
                </span>
                {subj.faculty_id && (
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                    ✓ {allFaculty.find(f => f.id === subj.faculty_id)?.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.8rem', color: '#0369a1' }}>
        <strong>Summary:</strong> {subjects.filter(s => s.subject_type === 'theory').length} Theory &nbsp;•&nbsp;
        {subjects.filter(s => s.subject_type === 'lab').length} Lab/Practical &nbsp;•&nbsp;
        {subjects.filter(s => s.subject_type === 'project').length} Project &nbsp;•&nbsp;
        Total periods/week: <strong>{subjects.reduce((a, s) => a + s.weekly_periods, 0)}</strong>
      </div>
    </div>
  );

  // ─── Step 3: Faculty Availability ─────────────────────────────────────────
  // Show unique faculty assigned to subjects + allow marking unavailable slots
  const Step3 = () => {
    const assignedFacultyIds = Array.from(new Set(subjects.map(s => s.faculty_id).filter(Boolean)));
    const assignedFaculty = allFaculty.filter(f => assignedFacultyIds.includes(f.id));

    return (
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
          Step 3 — Faculty &amp; Unavailability
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Click a cell to mark it as <strong style={{ color: '#dc2626' }}>blocked</strong> (unavailable) for that faculty.
          Red = blocked. Leave blank = available.
        </p>

        {assignedFaculty.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', background: '#fef9c3', borderRadius: '12px', border: '1px solid #fde047' }}>
            <p style={{ color: '#854d0e' }}>No faculty assigned yet. Go back to Step 2 and assign faculty to subjects.</p>
          </div>
        ) : assignedFaculty.map(fac => (
          <div key={fac.id} style={{ marginBottom: '1.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#2563eb', fontSize: '1rem' }}>
                {fac.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{fac.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{fac.code} • Max {fac.max_hours_per_week} hrs/week</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                {blockedSlots.filter(b => b.faculty_id === fac.id).length} blocked slot(s)
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '500px', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', background: '#0f172a', color: 'white', borderRadius: '6px 0 0 0', textAlign: 'left' }}>Day / Period</th>
                    {PERIODS.map(p => (
                      <th key={p} style={{ padding: '6px 12px', background: '#1e293b', color: 'white', textAlign: 'center', minWidth: '50px' }}>P{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, di) => (
                    <tr key={di}>
                      <td style={{ padding: '6px 10px', fontWeight: 700, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>{day}</td>
                      {PERIODS.map(p => {
                        const blocked = isBlocked(fac.id, di + 1, p);
                        return (
                          <td
                            key={p}
                            onClick={() => toggleBlock(fac.id, di + 1, p)}
                            style={{
                              cursor: 'pointer', textAlign: 'center',
                              padding: '10px 8px', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0',
                              background: blocked ? '#fee2e2' : 'white',
                              color: blocked ? '#dc2626' : '#e2e8f0',
                              transition: 'background .15s',
                              userSelect: 'none',
                              fontWeight: blocked ? 700 : 400,
                            }}
                            title={blocked ? 'Click to unblock' : 'Click to block'}
                          >
                            {blocked ? '✕' : '·'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Step 4: Rooms & Timings ──────────────────────────────────────────────
  const Step4 = () => (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
        Step 4 — Classrooms, Labs &amp; Timings
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Select the rooms and labs available for this class, and configure working days.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <label style={s.label}>Available Classrooms</label>
          {rooms.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No rooms found for this department.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rooms.map(r => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', background: selectedRooms.includes(r.id) ? '#eff6ff' : '#f8fafc', border: `1.5px solid ${selectedRooms.includes(r.id) ? '#2563eb' : '#e2e8f0'}`, borderRadius: '8px' }}>
                  <input type="checkbox" checked={selectedRooms.includes(r.id)} onChange={e => {
                    setSelectedRooms(prev => e.target.checked ? [...prev, r.id] : prev.filter(x => x !== r.id));
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.building} • Capacity: {r.capacity}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={s.label}>Available Labs</label>
          {labs.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No labs found for this department.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {labs.map(l => (
                <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', background: selectedLabs.includes(l.id) ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${selectedLabs.includes(l.id) ? '#059669' : '#e2e8f0'}`, borderRadius: '8px' }}>
                  <input type="checkbox" checked={selectedLabs.includes(l.id)} onChange={e => {
                    setSelectedLabs(prev => e.target.checked ? [...prev, l.id] : prev.filter(x => x !== l.id));
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Capacity: {l.capacity}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <label style={s.label}>Working Days</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {DAYS.map((day, i) => {
            const dayNum = i + 1;
            const active = workingDays.includes(dayNum);
            return (
              <button
                key={dayNum}
                onClick={() => setWorkingDays(prev => active ? prev.filter(d => d !== dayNum) : [...prev, dayNum].sort())}
                style={{
                  padding: '8px 20px', borderRadius: '20px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  background: active ? '#2563eb' : '#f1f5f9', color: active ? 'white' : '#475569',
                  border: `2px solid ${active ? '#2563eb' : '#e2e8f0'}`, transition: 'all .15s',
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Step 5: Review & Generate ─────────────────────────────────────────────
  const Step5 = () => {
    const dept = departments.find(d => d.id === deptId);
    const yr = academicYears.find(y => y.id === acadYearId);
    const sem = semesters.find(s => s.id === semesterId);
    const theorySubjs = subjects.filter(s => s.subject_type === 'theory');
    const labSubjs = subjects.filter(s => s.subject_type === 'lab');
    const projSubjs = subjects.filter(s => s.subject_type === 'project');
    const totalPeriods = subjects.reduce((a, s) => a + s.weekly_periods, 0);

    return (
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
          Step 5 — Review &amp; Generate
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Review your configuration below. Click "Generate Timetable" to run the CP-SAT scheduler.
        </p>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Department', value: dept?.code || '—', sub: dept?.name || '' },
            { label: 'Year', value: `Year ${yearLevel}`, sub: sem?.name || '' },
            { label: 'Subjects', value: subjects.length, sub: `${totalPeriods} periods/week` },
            { label: 'Faculty', value: Array.from(new Set(subjects.map(s=>s.faculty_id).filter(Boolean))).length, sub: `${blockedSlots.length} blocked slot(s)` },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{c.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, letterSpacing: 0 }}>{c.label}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Subject Table */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#0f172a' }}>
            Subject Allocation Summary
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Code', 'Subject', 'Type', 'Credits', 'Periods/Week', 'Faculty'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No subjects added.</td></tr>
              )}
              {subjects.map(s => {
                const fac = allFaculty.find(f => f.id === s.faculty_id);
                return (
                  <tr key={s._key} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{s.code}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: TYPE_BADGE[s.subject_type] || '#64748b', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }}>
                        {s.subject_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.credits}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.weekly_periods}</td>
                    <td style={{ padding: '10px 12px', color: fac ? '#059669' : '#dc2626' }}>
                      {fac ? `✓ ${fac.name}` : '⚠ Not assigned'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Job Status */}
        {jobStatus && (
          <div style={{
            background: jobStatus.status === 'completed' ? '#f0fdf4' : jobStatus.status === 'failed' ? '#fef2f2' : '#fffbeb',
            border: `1px solid ${jobStatus.status === 'completed' ? '#bbf7d0' : jobStatus.status === 'failed' ? '#fecaca' : '#fde68a'}`,
            borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {jobStatus.status === 'completed' ? '✅ Generation Complete!' :
                   jobStatus.status === 'failed' ? '❌ Generation Failed' :
                   `⏳ ${jobStatus.progress_stage || 'Generating…'}`}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>{jobStatus.message}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{jobStatus.progress_percent || 0}%</div>
                {jobStatus.status === 'completed' && (
                  <a href="/timetable" style={{ ...s.btnPrimary, fontSize: '0.8rem', padding: '6px 14px', textDecoration: 'none', marginTop: '8px', display: 'inline-flex' }}>
                    View Timetable →
                  </a>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${jobStatus.progress_percent || 0}%`, background: jobStatus.status === 'completed' ? '#10b981' : '#3b82f6', borderRadius: '3px', transition: 'width .5s' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button style={s.btnSecondary} onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save Only'}
          </button>
          <button
            style={{ ...s.btnPrimary, background: generating ? '#94a3b8' : 'linear-gradient(135deg,#7c3aed,#2563eb)', minWidth: '180px', justifyContent: 'center' }}
            onClick={handleGenerate}
            disabled={generating || saving}
          >
            {generating ? '⏳ Generating…' : '🚀 Generate Timetable'}
          </button>
        </div>
      </div>
    );
  };

  // ─── Navigation helpers ───────────────────────────────────────────────────
  const canNext = () => {
    if (step === 1) return !!(deptId && programId && acadYearId && semesterId);
    if (step === 2) return subjects.length > 0;
    return true;
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <Step1 />;
      case 2: return <Step2 />;
      case 3: return <Step3 />;
      case 4: return <Step4 />;
      case 5: return <Step5 />;
      default: return null;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
          Timetable Setup Wizard
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Configure your department's timetable data step by step, then generate an AI-optimized schedule.
        </p>
      </div>

      <StepIndicator />

      <div style={s.card}>
        {renderStep()}

        {/* Bottom nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <button
            style={{ ...s.btnSecondary, opacity: step === 1 ? 0.4 : 1, cursor: step === 1 ? 'default' : 'pointer' }}
            onClick={() => step > 1 && setStep(s => s - 1)}
            disabled={step === 1}
          >
            ← Back
          </button>

          <div style={{ display: 'flex', gap: '1rem' }}>
            {step < 5 && (
              <button
                style={{ ...s.btnPrimary, opacity: canNext() ? 1 : 0.5, cursor: canNext() ? 'pointer' : 'default' }}
                onClick={() => canNext() && setStep(s => s + 1)}
                disabled={!canNext()}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
