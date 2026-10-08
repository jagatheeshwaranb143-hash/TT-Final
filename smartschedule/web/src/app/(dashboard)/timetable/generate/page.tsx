'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getDefaultSemesterCycle } from '@/lib/preferences';

type SemesterCycle = 'odd' | 'even';
type StageStatus = 'waiting' | 'generating' | 'completed' | 'failed';

const CYCLES: Record<SemesterCycle, number[]> = {
  // Stage sequence by class year: Year 4, Year 3, Year 2, then Year 1.
  odd: [7, 5, 3, 1],
  even: [8, 6, 4, 2],
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

const yearForSemester = (semester: number) => Math.ceil(semester / 2);

export default function GenerateTimetablePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentType, setDepartmentType] = useState<'department' | 'lab' | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [cycle, setCycle] = useState<SemesterCycle>(getDefaultSemesterCycle);
  const [generatedClassIds, setGeneratedClassIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<number, StageStatus>>({});
  const [results, setResults] = useState<Record<number, number>>({});
  const [deletingSemester, setDeletingSemester] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const semesters = useMemo(() => CYCLES[cycle], [cycle]);

  const departmentKey = (value: string = '') => value.toLowerCase().replace(/laboratory|lab/g, '').replace(/[^a-z0-9]/g, '');
  const selectedDepartment = departments.find(item => item.id === departmentId);
  const linkedLiteratureDepartment = departmentType === 'lab' && selectedDepartment
    ? departments.find(item => {
        if ((item.department_type || 'department') !== 'department') return false;
        const labKeys = new Set([departmentKey(selectedDepartment.code), departmentKey(selectedDepartment.name)].filter(Boolean));
        return labKeys.has(departmentKey(item.code)) || labKeys.has(departmentKey(item.name));
      })
    : undefined;
  const activeDepartmentId = linkedLiteratureDepartment?.id || departmentId;

  useEffect(() => {
    Promise.all([api.departments.list(), api.classes.list()])
      .then(([departmentData, classData]: any[]) => {
        const departmentList = Array.isArray(departmentData) ? departmentData : [];
        const classList = Array.isArray(classData) ? classData : [];
        setDepartments(departmentList);
        setClasses(classList);
        const requestedClass = classList.find(item => item.id === searchParams.get('class_id'));
        const requestedDepartmentId = searchParams.get('department_id') || requestedClass?.department_id || '';
        const requestedDepartment = departmentList.find(item => item.id === requestedDepartmentId);
        if (requestedDepartment) {
          setDepartmentType((searchParams.get('department_type') as 'department' | 'lab') || requestedDepartment.department_type || 'department');
          setDepartmentId(requestedDepartmentId);
          const requestedCycle = searchParams.get('cycle');
          setCycle(requestedCycle === 'even' || requestedCycle === 'odd' ? requestedCycle : (requestedClass?.semester % 2 === 0 ? 'even' : 'odd'));
        }
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    setStatuses({});
    setResults({});
    if (!activeDepartmentId || !cycle) return;
    api.timetable.master(activeDepartmentId)
      .then((entries: any) => {
        const classSemester = new Map(
          classes
            .filter(item => item.department_id === activeDepartmentId)
            .map(item => [item.id, item.semester]),
        );
        const counts: Record<number, number> = {};
        for (const entry of Array.isArray(entries) ? entries : []) {
          const semester = classSemester.get(entry.class_id);
          if (typeof semester === 'number' && semester % 2 === (cycle === 'odd' ? 1 : 0) && (departmentType !== 'lab' || entry.subject_type === 'lab')) {
            counts[semester] = (counts[semester] || 0) + 1;
          }
        }
        setResults(counts);
        const scheduled = new Set((Array.isArray(entries) ? entries : []).map((entry: any) => entry.class_id));
        setGeneratedClassIds(Array.from(scheduled));
        const completeStages = semesters.filter(semester => {
          const stage = classes.filter(item => item.department_id === activeDepartmentId && item.semester === semester);
          return stage.length > 0 && stage.every(item => scheduled.has(item.id));
        });
        setStatuses(Object.fromEntries(completeStages.map(value => [value, 'completed'])));
      })
      .catch((error: Error) => toast.error(error.message));
  }, [activeDepartmentId, cycle, classes, departmentType, semesters]);

  const filteredDepartments = useMemo(
    () => departments.filter(item => (item.department_type || 'department') === departmentType),
    [departments, departmentType],
  );
  const departmentClasses = useMemo(
    () => classes.filter(item => item.department_id === activeDepartmentId),
    [classes, activeDepartmentId],
  );
  const classesForSemester = (semester: number) =>
    departmentClasses.filter(item => item.semester === semester);
  const orderedClasses = departmentClasses.filter(item => item.semester % 2 === (cycle === 'odd' ? 1 : 0)).sort((a, b) => b.year - a.year || a.section.localeCompare(b.section));
  const nextClassToGenerate = orderedClasses.find(item => !generatedClassIds.includes(item.id));

  const generateSelectedClass = async (classToGenerate: any = nextClassToGenerate) => {
    if (!activeDepartmentId || !classToGenerate) return;
    const semester = classToGenerate.semester;
    setStatuses(previous => ({ ...previous, [semester]: 'generating' }));
    try {
      const stageIndex = semesters.indexOf(semester);
      const referenceSemesters = semesters.slice(0, stageIndex).filter(value => statuses[value] === 'completed');
      const classIndex = orderedClasses.findIndex(item => item.id === classToGenerate.id);
      const referenceClassIds = orderedClasses.slice(0, classIndex).map(item => item.id);
      const result: any = await api.timetable.generate({
        department_id: activeDepartmentId,
        semester,
        section: classToGenerate.section,
        reference_semesters: referenceSemesters,
        reference_class_ids: referenceClassIds,
      });
      const generatedEntries: any[] = await api.timetable.master(activeDepartmentId) as any[];
      const scheduledIds = new Set(generatedEntries.map(entry => entry.class_id));
      setGeneratedClassIds(Array.from(scheduledIds));
      setStatuses(previous => {
        const updated = { ...previous };
        for (const stage of semesters) {
          const stageClasses = classesForSemester(stage);
          if (stageClasses.length && stageClasses.every(item => scheduledIds.has(item.id))) updated[stage] = 'completed';
          else delete updated[stage];
        }
        return updated;
      });
      const stageClassIds = new Set([classToGenerate.id]);
      const entriesCreated = departmentType === 'lab'
        ? generatedEntries.filter(entry => stageClassIds.has(entry.class_id) && entry.subject_type === 'lab').length
        : result.entries_created || 0;
      setResults(previous => Object.fromEntries(
        Object.entries({ ...previous, [semester]: entriesCreated })
          .filter(([value]) => semesters.indexOf(Number(value)) <= stageIndex),
      ) as Record<number, number>);
      toast.success(`${ordinal(classToGenerate.year)} Section ${classToGenerate.section} generated using earlier sections as references`);
    } catch (error: any) {
      setStatuses(previous => ({ ...previous, [semester]: 'failed' }));
      toast.error(error.message || `Could not generate ${ordinal(classToGenerate.year)} Section ${classToGenerate.section}`);
    }
  };

  const refreshGeneratedClasses = async () => {
    const entries: any[] = await api.timetable.master(activeDepartmentId) as any[];
    const scheduled = new Set(entries.map(entry => entry.class_id));
    setGeneratedClassIds(Array.from(scheduled));
    setStatuses(previous => {
      const updated = { ...previous };
      for (const semester of semesters) {
        const stageClasses = classesForSemester(semester);
        if (stageClasses.length && stageClasses.every(item => scheduled.has(item.id))) updated[semester] = 'completed';
        else delete updated[semester];
      }
      return updated;
    });
  };

  const deleteClassTimetable = async (classItem: any) => {
    if (isGenerating) return;
    if (!window.confirm(`Delete ${ordinal(classItem.year)} Section ${classItem.section} and later timetables that depend on it?`)) return;
    setDeletingSemester(classItem.semester);
    try {
      const result: any = await api.timetable.clearClass(classItem.id);
      await refreshGeneratedClasses();
      toast.success(`Deleted ${result.entries_deleted || 0} periods for ${ordinal(classItem.year)} Section ${classItem.section} and dependent sections`);
    } catch (error: any) {
      toast.error(error.message || `Could not delete ${ordinal(classItem.year)} Section ${classItem.section}`);
    } finally {
      setDeletingSemester(null);
    }
  };

  const regenerateClassTimetable = async (classItem: any) => {
    if (isGenerating) return;
    if (!window.confirm(`Regenerate ${ordinal(classItem.year)} Section ${classItem.section}? Later sections and years that depend on it will be cleared.`)) return;
    setDeletingSemester(classItem.semester);
    try {
      await api.timetable.clearClass(classItem.id);
      await refreshGeneratedClasses();
      setDeletingSemester(null);
      await generateSelectedClass(classItem);
    } catch (error: any) {
      toast.error(error.message || `Could not regenerate ${ordinal(classItem.year)} Section ${classItem.section}`);
      setDeletingSemester(null);
    }
  };

  const generateLabCycle = async () => {
    if (!activeDepartmentId || isGenerating) return;
    const missingSemester = semesters.find(semester => classesForSemester(semester).length === 0);
    if (missingSemester) {
      toast.error(`Add a class for Semester ${missingSemester} before generating the ${cycle} lab timetable.`);
      return;
    }
    try {
      setStatuses(Object.fromEntries(semesters.map(semester => [semester, 'generating'])) as Record<number, StageStatus>);
      for (const semester of semesters) {
        await api.timetable.generate({
          department_id: activeDepartmentId,
          semester,
          reference_semesters: semesters.slice(0, semesters.indexOf(semester)),
        });
        setStatuses(previous => ({ ...previous, [semester]: 'completed' }));
      }
      const generatedEntries = await api.timetable.master(activeDepartmentId) as any[];
      const classSemester = new Map(departmentClasses.map(item => [item.id, item.semester]));
      const labCounts: Record<number, number> = {};
      generatedEntries.filter(entry => entry.subject_type === 'lab').forEach(entry => {
        const semester = classSemester.get(entry.class_id);
        if (typeof semester === 'number' && semesters.includes(semester)) labCounts[semester] = (labCounts[semester] || 0) + 1;
      });
      setResults(labCounts);
      toast.success(`${cycle === 'odd' ? 'Odd' : 'Even'} semester lab timetable generated`);
    } catch (error: any) {
      setStatuses(previous => Object.fromEntries(Object.entries(previous).map(([semester, status]) => [semester, status === 'generating' ? 'failed' : status])) as Record<number, StageStatus>);
      toast.error(error.message || 'Could not generate the lab timetable');
    }
  };

  // Do not skip a missing or intermediate stage. Follow the configured
  // Year 4 -> Year 3 -> Year 2 -> Year 1 sequence.
  const nextSemester = nextClassToGenerate?.semester;
  const isGenerating = deletingSemester !== null || Object.values(statuses).some(status => status === 'generating');
  const labPeriodCount = semesters.reduce((total, semester) => total + (results[semester] || 0), 0);
  const labTimetableReady = labPeriodCount > 0;
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
        <h1 style={{ fontSize: 30, color: '#0f172a', letterSpacing: '-.03em' }}>Build timetables year by year</h1>
        <p style={{ color: '#64748b', marginTop: 8, maxWidth: 820, lineHeight: 1.6 }}>
          Generate Year 4 first, then Year 3, Year 2, and Year 1. Each stage reserves faculty periods from the completed prerequisite years in the same odd/even cycle.
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 20, alignItems: 'end' }}>
              <div>
                <label className="form-label" htmlFor="department-type-selector">Department type</label>
                <select id="department-type-selector" className="form-input" value={departmentType} onChange={event => { setDepartmentType(event.target.value as 'department' | 'lab' | ''); setDepartmentId(''); setCycle(getDefaultSemesterCycle()); }} disabled={isGenerating} style={{ marginTop: 7, padding: 12 }}>
                  <option value="" disabled hidden>Choose department type</option>
                  <option value="department">Literature Department</option>
                  <option value="lab">Lab Department</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="department-selector">Department</label>
                <select id="department-selector" className="form-input" value={departmentId} onChange={event => { setDepartmentId(event.target.value); setCycle(getDefaultSemesterCycle()); }} disabled={!departmentType || isGenerating} style={{ marginTop: 7, padding: 12 }}>
                  <option value="" disabled hidden>{departmentType ? 'Choose a department' : 'Choose department type first'}</option>
                  {filteredDepartments.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="semester-type-selector">Choose semester type</label>
                <select
                  id="semester-type-selector"
                  className="form-input"
                  value={cycle}
                  onChange={event => selectWorkflow(event.target.value as SemesterCycle)}
                  disabled={isGenerating || !departmentId}
                  style={{ marginTop: 7, padding: 12 }}
                >
                  {WORKFLOW_OPTIONS.map(option => (
                    <option key={option.cycle} value={option.cycle}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p style={{ margin: '14px 0 0', color: '#64748b', fontSize: 13 }}>Sections follow the saved Class settings. Generate them in order; each completed section is used as a reference for the next.</p>
          </div>

          {!departmentId ? (
            <div className="card" style={{ padding: 42, textAlign: 'center' }}>
              <h2 style={{ color: '#0f172a', fontSize: 20 }}>Choose a department</h2>
              <p style={{ color: '#64748b', marginTop: 8 }}>Select Literature or Lab Department, then choose a department to build its timetables.</p>
            </div>
          ) : departmentType === 'lab' ? (
            <div className="card" style={{ padding: 26, border: labTimetableReady ? '1px solid #c4b5fd' : '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ color: '#7c3aed', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>Lab timetable</p>
                  <h2 style={{ color: '#0f172a', fontSize: 21 }}>{cycle === 'odd' ? 'Odd' : 'Even'} Semester Lab Timetable</h2>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 7 }}>{selectedDepartment?.name || 'Selected lab'} · {labTimetableReady ? `${labPeriodCount} lab periods generated` : 'Generate all lab periods in one timetable'}</p>
                  {linkedLiteratureDepartment && <p style={{ color: '#7c3aed', fontSize: 12, marginTop: 5 }}>Uses classes and lab subjects from {linkedLiteratureDepartment.name} ({linkedLiteratureDepartment.code})</p>}
                  {!linkedLiteratureDepartment && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 5 }}>No matching Literature department found for this lab.</p>}
                </div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {labTimetableReady && <button type="button" className="btn btn-secondary" onClick={() => router.push(`/timetable/lab?department_id=${encodeURIComponent(activeDepartmentId)}&lab_name=${encodeURIComponent(selectedDepartment?.name || 'Lab')}&cycle=${cycle}`)}>View</button>}
                  <button type="button" className="btn btn-primary" onClick={generateLabCycle} disabled={isGenerating || !linkedLiteratureDepartment}>
                    {isGenerating ? 'Generating...' : labTimetableReady ? 'Regenerate Lab Timetable' : 'Generate Lab Timetable'}
                  </button>
                </div>
              </div>
            </div>
          ) : <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ color: '#0f172a', fontSize: 20 }}>{cycle === 'odd' ? 'Odd' : 'Even'} semester timetable stages</h2>
              <span style={{ color: '#64748b', fontSize: 13 }}>{semesters.map(value => `Year ${yearForSemester(value)} (Semester ${value})`).join(' → ')}</span>
            </div>
            {semesters.map((semester, index) => {
              const stageClasses = classesForSemester(semester);
              const status = statuses[semester] || 'waiting';
              const isNext = semester === nextSemester;
              const completed = status === 'completed';
              const unavailable = stageClasses.length === 0;
              const visibleStageClasses = stageClasses
                .filter(item => generatedClassIds.includes(item.id) || item.id === nextClassToGenerate?.id)
                .sort((a, b) => a.section.localeCompare(b.section));
              return (
                <div key={semester} className="card" style={{ padding: 22, border: completed ? '1px solid #86efac' : isNext ? '1px solid #5eead4' : '1px solid #e2e8f0', opacity: unavailable ? .72 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, color: completed ? '#166534' : isNext ? '#115e59' : '#64748b', background: completed ? '#dcfce7' : isNext ? '#ccfbf1' : '#f1f5f9' }}>
                        {completed ? '✓' : index + 1}
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, color: '#0f172a', marginBottom: 4 }}>{ordinal(yearForSemester(semester))} · Semester {semester}</h2>
                        <p style={{ color: '#64748b', fontSize: 13 }}>
                          {unavailable ? 'No class sections configured for this year and semester' : `${stageClasses.length} configured section${stageClasses.length === 1 ? '' : 's'} · ${stageClasses.reduce((total, item) => total + (item.subjects?.length || 0), 0)} subject allocations`}
                        </p>
                        {completed && <p style={{ color: '#15803d', fontSize: 13, marginTop: 5 }}>{results[semester]} fixed periods; faculty allocations reserved for later stages</p>}
                        {isNext && index > 0 && <p style={{ color: '#0f766e', fontSize: 13, marginTop: 5 }}>Uses: {semesters.slice(0, index).filter(value => statuses[value] === 'completed').map(value => `Year ${yearForSemester(value)} (Semester ${value})`).join(', ')} as fixed reference</p>}
                        {status === 'failed' && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 5 }}>Generation failed. Correct the data and retry this stage.</p>}
                      </div>
                    </div>
                  </div>
                  {visibleStageClasses.map((classItem: any) => {
                    const sectionCompleted = generatedClassIds.includes(classItem.id);
                    const sectionIsNext = nextClassToGenerate?.id === classItem.id;
                    return <div key={classItem.id} style={{ marginLeft: 34, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: sectionCompleted ? '#f0fdf4' : sectionIsNext ? '#f0fdfa' : '#fff', marginTop: 8 }}>
                      <div><strong style={{ color: '#0f172a' }}>{ordinal(classItem.year)} · Semester {classItem.semester} · Section {classItem.section}</strong><div style={{ color: sectionCompleted ? '#15803d' : '#64748b', fontSize: 12, marginTop: 3 }}>{sectionCompleted ? 'Timetable generated' : sectionIsNext ? 'Ready to generate next' : 'Waiting for earlier sections'}</div></div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {sectionCompleted && <button type="button" className="btn btn-secondary" onClick={() => router.push(`/timetable?class_id=${encodeURIComponent(classItem.id)}`)}>View</button>}
                        {sectionCompleted && <button type="button" className="btn btn-secondary" onClick={() => deleteClassTimetable(classItem)} disabled={isGenerating} style={{ color: '#b91c1c', borderColor: '#fecaca' }}>{deletingSemester === classItem.semester ? 'Deleting…' : 'Delete'}</button>}
                        {sectionCompleted && <button type="button" className="btn btn-secondary" onClick={() => regenerateClassTimetable(classItem)} disabled={isGenerating}>Regenerate</button>}
                        {!sectionCompleted && <button type="button" className="btn btn-primary" onClick={() => generateSelectedClass(classItem)} disabled={!sectionIsNext || isGenerating || (index > 0 && !semesters.slice(0, index).every(value => statuses[value] === 'completed'))}>{isGenerating && status === 'generating' ? 'Generating…' : sectionIsNext ? `Generate Section ${classItem.section}` : 'Waiting'}</button>}
                      </div>
                    </div>;
                  })}
                </div>
              );
            })}
          </div>}
        </>
      )}
    </div>
  );
}
