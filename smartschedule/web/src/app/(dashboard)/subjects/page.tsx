'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    subject_type: '',
    weekly_periods: 3,
    lab_block_size: 0,
    department_id: '',
    year_level: 0,
    semester: 0,
    class_id: '',
    faculty_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [facultySchedule, setFacultySchedule] = useState<any[]>([]);
  const [facultyScheduleLoading, setFacultyScheduleLoading] = useState(false);
  const [selectedDepartmentType, setSelectedDepartmentType] = useState<'department' | 'lab' | ''>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(1);

  const departmentKey = (value: string = '') => value
    .toLowerCase()
    .replace(/laboratory|lab/g, '')
    .replace(/[^a-z0-9]/g, '');

  const getLiteratureDepartmentForLab = (labDepartmentId: string) => {
    const labDepartment = departments.find(department => department.id === labDepartmentId);
    if (!labDepartment) return undefined;
    const labKeys = new Set([
      departmentKey(labDepartment.code),
      departmentKey(labDepartment.name),
    ].filter(Boolean));
    return departments.find(department =>
      (department.department_type || 'department') === 'department' &&
      (labKeys.has(departmentKey(department.code)) || labKeys.has(departmentKey(department.name))),
    );
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [subjData, deptData, facData, classData] = await Promise.all([
        api.subjects.list() as Promise<any[]>,
        api.departments.list() as Promise<any[]>,
        api.faculty.list() as Promise<any[]>,
        api.classes.list() as Promise<any[]>,
      ]);
      setSubjects(Array.isArray(subjData) ? subjData : []);
      const depts = Array.isArray(deptData) ? deptData : [];
      setDepartments(depts);
      setFacultyList(Array.isArray(facData) ? facData : []);
      setClasses(Array.isArray(classData) ? classData : []);

      if (depts.length > 0 && !formData.department_id) {
        setFormData(prev => ({ ...prev, department_id: depts[0].id }));
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load subjects or faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showModal || !formData.faculty_id) {
      setFacultySchedule([]);
      return;
    }
    let active = true;
    setFacultyScheduleLoading(true);
    const cycle = formData.semester % 2 === 0 ? 'even' : 'odd';
    api.timetable.facultyTimetable(formData.faculty_id, cycle)
      .then((data: any) => { if (active) setFacultySchedule(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setFacultySchedule([]); })
      .finally(() => { if (active) setFacultyScheduleLoading(false); });
    return () => { active = false; };
  }, [showModal, formData.faculty_id, formData.semester]);

  const resetForm = () => {
    const linkedLiteratureDepartment = selectedDepartmentType === 'lab'
      ? getLiteratureDepartmentForLab(selectedDeptFilter)
      : undefined;
    const activeDepartmentId = linkedLiteratureDepartment?.id || selectedDeptFilter || '';
    setEditingSubjectId(null);
    setFormData({
      name: '', code: '', subject_type: '', weekly_periods: 3,
      lab_block_size: 0,
      department_id: activeDepartmentId, year_level: 0, semester: 0,
      class_id: '', faculty_id: '',
    });
  };

  const openCreate = () => {
    if (!selectedDepartmentType || !selectedDeptFilter) {
      toast.error('Choose a department type and department first');
      return;
    }
    resetForm();
    setShowModal(true);
  };

  const openEdit = (subject: any) => {
    const assignment = classes
      .flatMap(classItem => classItem.subjects || [])
      .find((item: any) => item.subject_id === subject.id);
    setEditingSubjectId(subject.id);
    setFormData({
      name: subject.name || '',
      code: subject.code || '',
      subject_type: subject.type === 'lab' ? 'lab' : 'theory',
      weekly_periods: subject.periods_per_week || 3,
      lab_block_size: subject.lab_block_size || 2,
      department_id: subject.department_id || '',
      year_level: subject.year || 1,
      semester: subject.semester || 1,
      class_id: 'all',
      faculty_id: assignment?.faculty_id || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.department_id || !formData.subject_type || !formData.year_level || !formData.semester || !formData.class_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const isLab = formData.subject_type === 'lab' || formData.subject_type === 'practical';
      if (isLab && !formData.lab_block_size) {
        toast.error('Choose a consecutive lab block');
        return;
      }
      if (isLab && formData.weekly_periods % formData.lab_block_size !== 0) {
        toast.error('Lab periods per week must be a multiple of the consecutive block size');
        return;
      }

      const subjectPayload = {
        name: formData.name,
        code: formData.code,
        type: isLab ? 'lab' : 'theory',
        periods_per_week: formData.weekly_periods,
        lab_block_size: isLab ? formData.lab_block_size : 1,
        department_id: formData.department_id,
        year: formData.year_level,
        semester: formData.semester,
      };
      const savedSubject = editingSubjectId
        ? await api.subjects.update(editingSubjectId, subjectPayload) as any
        : await api.subjects.create(subjectPayload) as any;

      // 2. If faculty selected, assign faculty to subject
      if (formData.faculty_id && savedSubject?.id) {
        try {
          const selectedFaculty = facultyList.find(f => f.id === formData.faculty_id);
          const existingSubjectIds = (selectedFaculty?.subjects || []).map((subject: any) => subject.id);
          await api.faculty.assignSubject(formData.faculty_id, {
            subject_ids: Array.from(new Set([...existingSubjectIds, savedSubject.id])),
          });
        } catch (assignErr) {
          console.warn('Faculty assignment note:', assignErr);
        }
      }

      // Attach the subject to the selected class (or every matching class).
      const matchingClasses = classes.filter(item =>
        item.department_id === formData.department_id &&
        item.year === formData.year_level &&
        item.semester === formData.semester &&
        (formData.class_id === 'all' || item.id === formData.class_id)
      );
      if (editingSubjectId) {
        const matchingClassIds = new Set(matchingClasses.map(item => item.id));
        for (const classItem of classes.filter(item =>
          !matchingClassIds.has(item.id) &&
          (item.subjects || []).some((subject: any) => subject.subject_id === savedSubject.id)
        )) {
          await api.classes.assignSubjects(classItem.id, (classItem.subjects || [])
            .filter((subject: any) => subject.subject_id !== savedSubject.id)
            .map((subject: any) => ({
              subject_id: subject.subject_id,
              faculty_id: subject.faculty_id || null,
            })));
        }
      }
      for (const classItem of matchingClasses) {
        const existingAssignments = (classItem.subjects || []).map((subject: any) => ({
          subject_id: subject.subject_id,
          faculty_id: subject.faculty_id || null,
        }));
        const hasSubject = existingAssignments.some((item: any) => item.subject_id === savedSubject.id);
        const updatedAssignments = hasSubject
          ? existingAssignments.map((item: any) => item.subject_id === savedSubject.id
              ? { ...item, faculty_id: formData.faculty_id || null }
              : item)
          : [...existingAssignments, { subject_id: savedSubject.id, faculty_id: formData.faculty_id || null }];
        await api.classes.assignSubjects(classItem.id, updatedAssignments);
      }

      toast.success(editingSubjectId ? 'Subject updated. Regenerate this semester cycle to apply it.' : 'Subject added successfully!');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${editingSubjectId ? 'update' : 'add'} subject`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.subjects.delete(id);
      toast.success('Subject deleted');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete subject');
    }
  };

  const selectedLabDepartment = selectedDepartmentType === 'lab'
    ? departments.find(department => department.id === selectedDeptFilter)
    : undefined;
  const linkedLiteratureDepartment = selectedLabDepartment
    ? getLiteratureDepartmentForLab(selectedLabDepartment.id)
    : undefined;
  const subjectDepartmentId = linkedLiteratureDepartment?.id || selectedDeptFilter;
  const filteredSubjects = subjects.filter(s =>
    Boolean(selectedDepartmentType && selectedDeptFilter) &&
    s.department_id === subjectDepartmentId &&
    (selectedDepartmentType !== 'lab' || s.type === 'lab') &&
    s.semester === selectedSemester
  );
  const theorySubjects = filteredSubjects.filter(s => s.type !== 'lab');
  const labSubjects = filteredSubjects.filter(s => s.type === 'lab');

  const selectedFaculty = facultyList.find(f => f.id === formData.faculty_id);
  const selectedFacultyDepartment = departments.find(d => d.id === selectedFaculty?.department_id);
  const selectedSubjectDepartment = departments.find(d => d.id === formData.department_id);
  const isCrossDepartment = Boolean(selectedFaculty && formData.department_id && selectedFaculty.department_id !== formData.department_id);
  const filteredDepartments = departments.filter(
    department => (department.department_type || 'department') === selectedDepartmentType,
  );
  const literatureDepartments = departments.filter(
    department => (department.department_type || 'department') === 'department',
  );
  const facultyByDepartment = [...departments]
    .sort((left, right) =>
      (left.name || left.code || '').localeCompare(right.name || right.code || '', undefined, { sensitivity: 'base' }),
    )
    .map(department => ({
      department,
      faculty: facultyList
        .filter(member => member.department_id === department.id)
        .sort((left, right) => (left.name || '').localeCompare(right.name || '', undefined, { sensitivity: 'base' })),
    }))
    .filter(group => group.faculty.length > 0);
  const facultyWithoutDepartment = facultyList
    .filter(member => !departments.some(department => department.id === member.department_id))
    .sort((left, right) => (left.name || '').localeCompare(right.name || '', undefined, { sensitivity: 'base' }));

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Curriculum & Subjects
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Configure courses and use Edit to adapt semester, workload, lab blocks, and faculty before regenerating the timetable.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {departments.length > 0 && (
            <div>
            <label htmlFor="department-type-filter" style={{ display: 'block', marginBottom: 5, color: '#334155', fontSize: 12, fontWeight: 700 }}>Department Type</label>
            <select
              id="department-type-filter"
              value={selectedDepartmentType}
              onChange={(e) => {
                setSelectedDepartmentType(e.target.value as 'department' | 'lab' | '');
                setSelectedDeptFilter('');
              }}
              style={{ padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', background: 'white', fontWeight: 600, color: selectedDepartmentType ? '#334155' : '#94a3b8' }}
            >
              <option value="" disabled hidden>Choose department type</option>
              <option value="department" style={{ color: '#334155' }}>Literature Department</option>
              <option value="lab" style={{ color: '#334155' }}>Lab Department</option>
            </select>
            </div>
          )}
          {departments.length > 0 && (
            <div>
            <label htmlFor="department-filter" style={{ display: 'block', marginBottom: 5, color: '#334155', fontSize: 12, fontWeight: 700 }}>Department</label>
            <select
              id="department-filter"
              value={selectedDeptFilter}
              onChange={(e) => {
                const departmentId = e.target.value;
                setSelectedDeptFilter(departmentId);
                if (!editingSubjectId) {
                  setFormData(prev => ({
                    ...prev,
                    department_id: departmentId,
                    class_id: '',
                  }));
                }
              }}
              disabled={!selectedDepartmentType}
              style={{
                padding: '0.6rem 1rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'white',
                fontWeight: 600,
                color: selectedDeptFilter ? '#334155' : '#94a3b8',
              }}
            >
              <option value="" disabled hidden>
                {selectedDepartmentType ? 'Choose department' : 'Choose department type first'}
              </option>
              {filteredDepartments.map(d => (
                <option key={d.id} value={d.id} style={{ color: '#334155' }}>{d.name} ({d.code})</option>
              ))}
            </select>
            </div>
          )}
          <button
            onClick={openCreate}
            style={{
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              border: 'none',
              padding: '0.65rem 1.35rem',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
            }}
          >
            <span>+</span> Add Subject
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <strong style={{ color: '#0f172a' }}>Choose semester</strong>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
              {!selectedDeptFilter
                ? `Semester ${selectedSemester} selected. Choose a department type and department to view its subjects.`
                : selectedDepartmentType === 'lab' && linkedLiteratureDepartment
                  ? `Showing ${linkedLiteratureDepartment.name} lab subjects for the selected semester.`
                  : selectedDepartmentType === 'lab'
                    ? 'No matching literature department was found for this lab department.'
                    : 'Subjects and labs for the selected department and semester are shown automatically.'}
            </div>
          </div>
          <span style={{ color: '#475569', fontSize: 13, fontWeight: 700 }}>{filteredSubjects.length} subjects · {theorySubjects.length} theory · {labSubjects.length} labs</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(84px, 1fr))', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(semester => (
            <button key={semester} type="button" onClick={() => setSelectedSemester(semester)} style={{
              border: selectedSemester === semester ? '1px solid #0f766e' : '1px solid #dbe3ee',
              background: selectedSemester === semester ? '#0f766e' : '#fff',
              color: selectedSemester === semester ? '#fff' : '#475569',
              padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap'
            }}>Sem {semester}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Loading courses...</div>
      ) : filteredSubjects.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '4rem', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>{selectedDeptFilter ? 'No Subjects Found' : `Semester ${selectedSemester}`}</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{selectedDeptFilter ? 'Add courses to build your academic syllabus and timetable generator mappings.' : 'Choose a department type and department to view the subjects for this semester.'}</p>
          <button
            onClick={openCreate}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.65rem 1.35rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Subject
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {(selectedDepartmentType === 'lab' ? [
            { title: 'Laboratory subjects', items: labSubjects, color: '#b45309', background: '#fffbeb' },
          ] : [
            { title: 'Theory subjects', items: theorySubjects, color: '#0f766e', background: '#ecfdf5' },
            { title: 'Laboratory subjects', items: labSubjects, color: '#b45309', background: '#fffbeb' },
          ]).map(group => (
            <section key={group.title} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '15px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', background: group.background }}>
                <strong style={{ color: group.color }}>{group.title}</strong><span style={{ color: group.color, fontSize: 13, fontWeight: 700 }}>{group.items.length}</span>
              </div>
              {group.items.length === 0 ? <div style={{ padding: 22, color: '#64748b' }}>No {group.title.toLowerCase()} in Semester {selectedSemester}.</div> : (
                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead><tr style={{ color: '#64748b', fontSize: 12, textAlign: 'left', background: '#f8fafc' }}>
                    <th style={{ padding: '10px 18px' }}>CODE</th><th>SUBJECT</th><th>DEPARTMENT</th><th>YEAR</th><th style={{ textAlign: 'center' }}>PERIODS / WEEK</th><th style={{ textAlign: 'right', paddingRight: 18 }}>ACTION</th>
                  </tr></thead>
                  <tbody>{group.items.map((s: any) => {
                    const dept = departments.find(d => d.id === s.department_id);
                    return <tr key={s.id} style={{ borderTop: '1px solid #eef2f7' }}>
                      <td style={{ padding: '14px 18px' }}><span style={{ fontWeight: 800, color: group.color, background: group.background, padding: '4px 8px', borderRadius: 6 }}>{s.code}</span></td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                      <td style={{ color: '#475569' }}>{dept?.code || '—'}</td><td style={{ color: '#475569' }}>Year {s.year || '—'}</td>
                      <td style={{ color: '#475569', textAlign: 'center', fontWeight: 700 }}>{s.periods_per_week || 3}</td>
                      <td style={{ textAlign: 'right', paddingRight: 18 }}><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}><button onClick={() => openEdit(s)} style={{ border: 0, background: 'transparent', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}>Edit</button><button onClick={() => handleDelete(s.id, s.name)} style={{ border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}>Delete</button></div></td>
                    </tr>;
                  })}</tbody>
                </table></div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Modal: Add or edit subject */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem', overflow: 'hidden' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: 'clamp(1rem, 3vw, 2rem)', width: '100%', maxWidth: '520px', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', overscrollBehavior: 'contain', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.5rem', color: '#0f172a' }}>{editingSubjectId ? 'Edit Course Subject' : 'Add New Course Subject'}</h2>
            {editingSubjectId && <div style={{ margin: '-0.75rem 0 1rem', padding: '10px 12px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', fontSize: 13 }}>
              Scheduling changes clear the affected odd/even cycle. Regenerate that cycle to apply the updated curriculum.
            </div>}
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Subject Name</label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='Enter subject name (e.g. Data Structures & Algorithms)'
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Subject Code</label>
                  <input
                    type='text'
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder='Enter subject code (e.g. CS301 / CS301L)'
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: formData.lab_block_size ? '#334155' : '#94a3b8' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value, class_id: '', faculty_id: '' })}
                    disabled={Boolean(editingSubjectId)}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: formData.department_id ? '#334155' : '#94a3b8' }}
                    required
                  >
                    <option value="" disabled hidden>Department: Choose literature department</option>
                    {literatureDepartments.map((d) => (
                      <option key={d.id} value={d.id} style={{ color: '#334155' }}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.subject_type === 'lab' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Consecutive Lab Block</label>
                  <select
                    value={formData.lab_block_size}
                    onChange={(e) => setFormData({ ...formData, lab_block_size: parseInt(e.target.value) || 2 })}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}
                    required
                  >
                    <option value={0} disabled hidden>Choose consecutive block</option>
                    <option value={2} style={{ color: '#334155' }}>2 consecutive periods</option>
                    <option value={3} style={{ color: '#334155' }}>3 consecutive periods</option>
                  </select>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 5 }}>Periods/week must be divisible by this block size.</div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Year Level</label>
                  <select
                    value={formData.year_level}
                    onChange={(e) => {
                      const year = parseInt(e.target.value) || 0;
                      setFormData({ ...formData, year_level: year, semester: 0, class_id: '' });
                    }}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: formData.year_level ? '#334155' : '#94a3b8' }}
                    required
                  >
                    <option value={0} disabled hidden>Choose year level</option>
                    {[1, 2, 3, 4].map(year => <option key={year} value={year} style={{ color: '#334155' }}>Year {year}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1, class_id: '' })}
                    disabled={!formData.year_level}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: formData.semester ? '#334155' : '#94a3b8' }}
                    required
                  >
                    <option value={0} disabled hidden>{formData.year_level ? 'Choose semester' : 'Choose year level first'}</option>
                    {formData.year_level > 0 && [formData.year_level * 2 - 1, formData.year_level * 2].map(semester => <option key={semester} value={semester} style={{ color: '#334155' }}>Semester {semester}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Class</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    disabled={!formData.year_level || !formData.semester}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: formData.class_id ? '#334155' : '#94a3b8' }}
                    required
                  >
                    <option value="" disabled hidden>{formData.year_level && formData.semester ? 'Choose class' : 'Choose year and semester first'}</option>
                    {formData.year_level > 0 && formData.semester > 0 && <option value="all" style={{ color: '#334155' }}>
                      {formData.year_level} Year {selectedSubjectDepartment?.code || selectedSubjectDepartment?.name || 'Department'}
                    </option>}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Course Type</label>
                  <select
                    value={formData.subject_type}
                    onChange={(e) => setFormData({ ...formData, subject_type: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: formData.subject_type ? '#334155' : '#94a3b8' }}
                    required
                  >
                    <option value="" disabled hidden>Choose course type</option>
                    <option value="theory" style={{ color: '#334155' }}>Theory</option>
                    <option value="lab" style={{ color: '#334155' }}>Lab / Practical</option>
                    <option value="project" style={{ color: '#334155' }}>Project</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Periods / Week</label>
                  <input
                    type='number'
                    min='1'
                    max='10'
                    value={formData.weekly_periods}
                    onChange={(e) => setFormData({ ...formData, weekly_periods: parseInt(e.target.value) || 3 })}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Assign Faculty Member (Required for generation)
                </label>
                <select
                  value={formData.faculty_id}
                  onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: formData.faculty_id ? '#334155' : '#94a3b8' }}
                  required
                >
                  <option value="" disabled hidden>Faculty: Choose faculty member</option>
                  {facultyByDepartment.map(({ department, faculty }) => (
                    <optgroup key={department.id} label={`${department.name} (${department.code})`} style={{ color: '#334155' }}>
                      {faculty.map(member => (
                        <option key={member.id} value={member.id} style={{ color: '#334155' }}>{member.name}</option>
                      ))}
                    </optgroup>
                  ))}
                  {facultyWithoutDepartment.length > 0 && (
                    <optgroup label="Other Faculty" style={{ color: '#334155' }}>
                      {facultyWithoutDepartment.map(member => (
                        <option key={member.id} value={member.id} style={{ color: '#334155' }}>{member.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {selectedFaculty && (
                <div style={{ margin: '-0.5rem 0 1.25rem', padding: 12, borderRadius: 9, border: `1px solid ${isCrossDepartment ? '#7dd3fc' : '#dbe3ee'}`, background: isCrossDepartment ? '#f0f9ff' : '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ color: isCrossDepartment ? '#0369a1' : '#334155', fontSize: 13 }}>
                      {isCrossDepartment
                        ? `Cross-department: ${selectedFacultyDepartment?.code || 'Faculty'} → ${selectedSubjectDepartment?.code || 'Class'}`
                        : `${selectedFacultyDepartment?.code || 'Department'} faculty assignment`}
                    </strong>
                    <span style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>
                      {facultyScheduleLoading ? 'Analyzing timetable…' : `${facultySchedule.length} occupied periods in the ${formData.semester % 2 === 0 ? 'even' : 'odd'} cycle`}
                    </span>
                  </div>
                  {!facultyScheduleLoading && facultySchedule.length > 0 && (
                    <div style={{ marginTop: 8, color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>
                      Existing: {facultySchedule.slice(0, 6).map(entry => `${['Mon','Tue','Wed','Thu','Fri','Sat'][entry.day] || `Day ${entry.day + 1}`} P${entry.period} (${entry.class_label})`).join(' · ')}
                      {facultySchedule.length > 6 ? ` · +${facultySchedule.length - 6} more` : ''}
                    </div>
                  )}
                  <div style={{ marginTop: 7, color: '#475569', fontSize: 12 }}>
                    {isCrossDepartment
                      ? `Priority: generate ${selectedFacultyDepartment?.code || 'the home department'} first. ${selectedSubjectDepartment?.code || 'The other department'} will use only this faculty member's remaining free periods.`
                      : 'This is the faculty member’s home-department assignment.'}
                  </div>
                  {facultySchedule.length > 0 && <div style={{ marginTop: 5, color: '#b45309', fontSize: 12, fontWeight: 600 }}>
                    During manual entry, an occupied period will show “{selectedFaculty.name} is attending another class” with the exact class and time.
                  </div>
                  }
                </div>
              )}

              <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', margin: '0 -0.25rem -0.25rem', padding: '1rem 0.25rem 0.25rem', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                <button
                  type='button'
                  onClick={() => { setShowModal(false); resetForm(); }}
                  style={{ padding: '0.65rem 1.25rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  style={{ padding: '0.65rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? 'Saving...' : editingSubjectId ? 'Save Changes' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
