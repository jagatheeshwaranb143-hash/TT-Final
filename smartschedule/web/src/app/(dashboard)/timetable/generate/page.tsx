'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

type SemesterCycle = 'odd' | 'even';
type StageStatus = 'waiting' | 'generating' | 'completed' | 'failed';

const CYCLES: Record<SemesterCycle, number[]> = {
  odd: [1, 3, 5, 7],
  even: [2, 4, 6, 8],
};

const WORKFLOW_OPTIONS: Array<{
  cycle: SemesterCycle;
  label: string;
}> = [
  { cycle: 'odd', label: 'Odd Semester' },
  { cycle: 'even', label: 'Even Semester' },
];

const ordinal = (year: number) => {
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  return '4th Year';
};

export default function GenerateTimetablePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [cycle, setCycle] = useState<SemesterCycle>('odd');
  const [statuses, setStatuses] = useState<Record<number, StageStatus>>({});
  const [results, setResults] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([api.departments.list(), api.classes.list()])
      .then(([departmentData, classData]: any[]) => {
        const departmentList = Array.isArray(departmentData) ? departmentData : [];
        const classList = Array.isArray(classData) ? classData : [];
        setDepartments(departmentList);
        setClasses(classList);
        setDepartmentId(departmentList[0]?.id || '');
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setStatuses({});
    setResults({});
    if (!departmentId) return;
    api.timetable.master(departmentId)
      .then((entries: any) => {
        const classSemester = new Map(
          classes
            .filter(item => item.department_id === departmentId)
            .map(item => [item.id, item.semester]),
        );
        const counts: Record<number, number> = {};
        for (const entry of Array.isArray(entries) ? entries : []) {
          const semester = classSemester.get(entry.class_id);
          if (typeof semester === 'number' && semester % 2 === (cycle === 'odd' ? 1 : 0)) {
            counts[semester] = (counts[semester] || 0) + 1;
          }
        }
        setResults(counts);
        setStatuses(Object.fromEntries(Object.keys(counts).map(value => [Number(value), 'completed'])));
      })
      .catch((error: Error) => toast.error(error.message));
  }, [departmentId, cycle, classes]);

  const semesters = CYCLES[cycle];
  const departmentClasses = useMemo(
    () => classes.filter(item => item.department_id === departmentId),
    [classes, departmentId],
  );
  const classesForSemester = (semester: number) =>
    departmentClasses.filter(item => item.semester === semester);

  const generateSemester = async (semester: number) => {
    if (!departmentId || classesForSemester(semester).length === 0) return;
    setStatuses(previous => ({ ...previous, [semester]: 'generating' }));
    try {
      const referenceSemesters = semesters.filter(value => value < semester && statuses[value] === 'completed');
      const result: any = await api.timetable.generate({
        department_id: departmentId,
        semester,
        reference_semesters: referenceSemesters,
      });
      // Regenerating an earlier stage invalidates every later stage in this
      // cycle. The backend removes those stale schedules, so mirror that state.
      setStatuses(previous => Object.fromEntries(
        Object.entries({ ...previous, [semester]: 'completed' })
          .filter(([value]) => Number(value) <= semester),
      ) as Record<number, StageStatus>);
      setResults(previous => Object.fromEntries(
        Object.entries({ ...previous, [semester]: result.entries_created || 0 })
          .filter(([value]) => Number(value) <= semester),
      ) as Record<number, number>);
      toast.success(`Semester ${semester} fixed as the period and faculty reference for the next stage`);
    } catch (error: any) {
      setStatuses(previous => ({ ...previous, [semester]: 'failed' }));
      toast.error(error.message || `Could not generate Semester ${semester}`);
    }
  };

  // Do not skip a missing default or intermediate stage. The selected cycle
  // must be completed strictly from top to bottom.
  const nextSemester = semesters.find(semester => statuses[semester] !== 'completed');
  const isGenerating = Object.values(statuses).some(status => status === 'generating');
  const selectWorkflow = (selectedCycle: SemesterCycle) => {
    if (isGenerating || selectedCycle === cycle) return;
    setStatuses({});
    setResults({});
    setCycle(selectedCycle);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1050, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: '#0f766e', fontWeight: 600, fontSize: 13, letterSpacing: '.01em', marginBottom: 6 }}>Class Timetable Workflow</p>
        <h1 style={{ fontSize: 30, color: '#0f172a', letterSpacing: '-.03em' }}>Build timetables semester by semester</h1>
        <p style={{ color: '#64748b', marginTop: 8, maxWidth: 820, lineHeight: 1.6 }}>
          Start with the first-year timetable. Its periods stay fixed, and its faculty allocations are reserved while each later semester in the same odd/even cycle is generated.
        </p>
      </div>

      {loading ? <div className="card">Loading departments and available classes...</div> : !departments.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 42 }}>
          <h2 style={{ marginBottom: 8 }}>Create a department first</h2>
          <p style={{ color: '#64748b', marginBottom: 18 }}>This workflow needs a department before classes can be configured.</p>
          <button className="btn btn-primary" onClick={() => router.push('/departments')}>Go to Departments</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(320px, 1.4fr)', gap: 20, alignItems: 'end' }}>
              <div>
                <label className="form-label" htmlFor="department-selector">Department</label>
                <select id="department-selector" className="form-input" value={departmentId} onChange={event => setDepartmentId(event.target.value)} style={{ marginTop: 7, padding: 12 }}>
                  <option value="">Choose a department</option>
                  {departments.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Choose semester type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 7 }}>
                  {WORKFLOW_OPTIONS.map(option => {
                    const active = cycle === option.cycle;
                    return (
                      <button
                        key={option.cycle}
                        type="button"
                        onClick={() => selectWorkflow(option.cycle)}
                        disabled={isGenerating}
                        aria-pressed={active}
                        style={{ padding: '12px 14px', borderRadius: 9, cursor: isGenerating ? 'not-allowed' : 'pointer', textAlign: 'left', border: active ? '2px solid #0f766e' : '1px solid #cbd5e1', color: active ? '#134e4a' : '#475569', background: active ? '#ccfbf1' : '#fff' }}
                      >
                        <span style={{ display: 'block', fontWeight: 800 }}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {semesters.map((semester, index) => {
              const stageClasses = classesForSemester(semester);
              const status = statuses[semester] || 'waiting';
              const isNext = semester === nextSemester;
              const completed = status === 'completed';
              const unavailable = stageClasses.length === 0;
              return (
                <div key={semester} className="card" style={{ padding: 22, border: completed ? '1px solid #86efac' : isNext ? '1px solid #5eead4' : '1px solid #e2e8f0', opacity: unavailable ? .72 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, color: completed ? '#166534' : isNext ? '#115e59' : '#64748b', background: completed ? '#dcfce7' : isNext ? '#ccfbf1' : '#f1f5f9' }}>
                        {completed ? '✓' : index + 1}
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, color: '#0f172a', marginBottom: 4 }}>{ordinal(index + 1)} · Semester {semester}</h2>
                        <p style={{ color: '#64748b', fontSize: 13 }}>
                          {unavailable ? 'No class configured — add this semester before continuing' : `${stageClasses.length} class${stageClasses.length === 1 ? '' : 'es'} · ${stageClasses.reduce((total, item) => total + (item.subjects?.length || 0), 0)} subject allocations`}
                        </p>
                        {completed && <p style={{ color: '#15803d', fontSize: 13, marginTop: 5 }}>{results[semester]} fixed periods; faculty allocations reserved for later stages</p>}
                        {isNext && index > 0 && <p style={{ color: '#0f766e', fontSize: 13, marginTop: 5 }}>Uses: {semesters.filter(value => value < semester && statuses[value] === 'completed').map(value => `Semester ${value}`).join(', ')} as fixed reference</p>}
                        {status === 'failed' && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 5 }}>Generation failed. Correct the data and retry this stage.</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 9 }}>
                      {completed && stageClasses[0] && <button type="button" className="btn btn-secondary" onClick={() => router.push(`/timetable?class_id=${stageClasses[0].id}`)}>View</button>}
                      <button type="button" className="btn btn-primary" onClick={() => generateSemester(semester)} disabled={unavailable || isGenerating || (!isNext && !completed)} title={!isNext && !completed ? 'Complete the earlier configured semester first' : undefined}>
                        {status === 'generating' ? 'Generating...' : completed ? 'Regenerate stage' : isNext ? 'Generate & reserve' : 'Waiting for earlier stage'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
