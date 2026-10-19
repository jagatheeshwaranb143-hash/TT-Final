'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SubjectsPage() {
  const searchParams = useSearchParams();
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
    credits: 3,
    lab_mode: 'main',
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
  const [selectedSectionClassId, setSelectedSectionClassId] = useState('');

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

      // Check URL query parameters first, or fallback to first literature department
      const queryDeptId = searchParams.get('department_id');
      const queryDeptType = searchParams.get('department_type') as 'department' | 'lab' | null;
      const querySemester = searchParams.get('semester');

      if (queryDeptId && depts.some((d: any) => d.id === queryDeptId)) {
        const foundDept = depts.find((d: any) => d.id === queryDeptId);
        setSelectedDepartmentType(queryDeptType || ((foundDept?.department_type || 'department') as 'department' | 'lab'));
        setSelectedDeptFilter(queryDeptId);
      } else {
        const firstLiteratureDepartment = depts.find((department: any) => (department.department_type || 'department') === 'department');
        if (firstLiteratureDepartment && !selectedDeptFilter) {
          setSelectedDepartmentType('department');
          setSelectedDeptFilter(firstLiteratureDepartment.id);
        }
      }

      if (querySemester) {
        const semNum = parseInt(querySemester);
        if (semNum >= 1 && semNum <= 8) {
          setSelectedSemester(semNum);
        }
      }

      if (depts.length > 0 && !formData.department_id) {
        setFormData(prev => ({ ...prev, department_id: queryDeptId || depts[0].id }));
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
      lab_block_size: 3, credits: 3, lab_mode: 'main',
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
    setFormData(current => ({
      ...current,
      department_id: subjectDepartmentId,
      year_level: Math.ceil(selectedSemester / 2),
      semester: selectedSemester,
      class_id: selectedSectionClass?.id || 'all',
      lab_mode: 'main',
      lab_block_size: 3,
    }));
    setShowModal(true);
  };

  const openEdit = (subject: any) => {
    const targetClass = selectedSectionClass || classes.find(classItem => (classItem.subjects || []).some((item: any) => item.subject_id === subject.id));
    const assignment = targetClass?.subjects?.find((item: any) => item.subject_id === subject.id);
    const labMode = subject.lab_mode || 'main';
    const blockSize = subject.type === 'lab' ? (subject.lab_block_size || (labMode === 'main' ? 3 : 2)) : 0;
    setEditingSubjectId(subject.id);
    setFormData({
      name: subject.name || '',
      code: subject.code || '',
      subject_type: subject.type === 'lab' ? 'lab' : 'theory',
      weekly_periods: assignment?.periods_per_week || subject.periods_per_week || 3,
      lab_block_size: blockSize,
      credits: subject.credits ?? 3,
      lab_mode: labMode,
      department_id: subject.department_id || '',
      year_level: subject.year || Math.ceil(selectedSemester / 2),
      semester: subject.semester || selectedSemester,
      class_id: selectedSectionClass?.id || 'all',
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
    const targetClass = classes.find(item => item.id === formData.class_id);
    if (formData.class_id !== 'all' && (!targetClass || targetClass.department_id !== formData.department_id || targetClass.year !== formData.year_level || targetClass.semester !== formData.semester)) {
      toast.error(`No matching class section is selected for Year ${formData.year_level}, Semester ${formData.semester}. Refresh Class settings and try again.`);
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
        credits: formData.credits,
        lab_mode: isLab ? formData.lab_mode : 'main',
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
      const allSemesterClasses = classes.filter(item =>
        item.department_id === formData.department_id &&
        item.year === formData.year_level &&
        item.semester === formData.semester
      );
      const classesToUpdate = formData.class_id === 'all'
        ? allSemesterClasses
        : allSemesterClasses.filter(item => item.id === formData.class_id);

      for (const classItem of classesToUpdate) {
        const existingAssignments = (classItem.subjects || []).map((s: any) => ({
          subject_id: s.subject_id,
          faculty_id: s.faculty_id || null,
          periods_per_week: s.periods_per_week ?? null,
        }));
        const existingIdx = existingAssignments.findIndex((s: any) => s.subject_id === savedSubject.id);
        if (existingIdx >= 0) {
          existingAssignments[existingIdx] = {
            subject_id: savedSubject.id,
            faculty_id: formData.faculty_id || null,
            periods_per_week: formData.weekly_periods,
          };
        } else {
          existingAssignments.push({
            subject_id: savedSubject.id,
            faculty_id: formData.faculty_id || null,
            periods_per_week: formData.weekly_periods,
          });
        }
        await api.classes.assignSubjects(classItem.id, existingAssignments);
      }

      // Ensure other sections in the same semester also have the subject in their curriculum
      for (const otherClass of allSemesterClasses) {
        if (!classesToUpdate.some(c => c.id === otherClass.id)) {
          const existing = (otherClass.subjects || []).map((s: any) => ({
            subject_id: s.subject_id,
            faculty_id: s.faculty_id || null,
            periods_per_week: s.periods_per_week ?? null,
          }));
          if (!existing.some((s: any) => s.subject_id === savedSubject.id)) {
            existing.push({
              subject_id: savedSubject.id,
              faculty_id: null,
              periods_per_week: formData.weekly_periods,
            });
            await api.classes.assignSubjects(otherClass.id, existing);
          }
        }
      }

      toast.success(editingSubjectId ? 'Subject updated. Regenerate this semester cycle to apply it.' : 'Subject added successfully!');
      setShowModal(false);
      resetForm();
      await loadData();
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
  const sectionClasses = classes
    .filter(item => item.department_id === subjectDepartmentId && item.year === Math.ceil(selectedSemester / 2) && item.semester === selectedSemester)
    .sort((left, right) => left.section.localeCompare(right.section));
  const selectedSectionClass = sectionClasses.find(item => item.id === selectedSectionClassId) || sectionClasses[0];

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
  const prioritizedFacultyGroups = useMemo(() => {
    const targetDeptId = formData.department_id || subjectDepartmentId;
    const homeDept = departments.find(d => d.id === targetDeptId);
    const groups: { department: any; label: string; faculty: any[]; isHome: boolean }[] = [];

    // 1. TOP PRIORITY: Faculty belonging to the subject's selected department
    if (homeDept) {
      const homeFaculty = facultyList
        .filter(member => member.department_id === homeDept.id)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      if (homeFaculty.length > 0) {
        groups.push({
          department: homeDept,
          label: `⭐ ${homeDept.name} (${homeDept.code}) — Home Department Faculty (Priority)`,
          faculty: homeFaculty,
          isHome: true,
        });
      }
    }

    // 2. OTHER DEPARTMENTS: Cross-department faculty
    const otherDepts = departments
      .filter(d => d.id !== targetDeptId)
      .sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, { sensitivity: 'base' }));

    for (const dept of otherDepts) {
      const fac = facultyList
        .filter(member => member.department_id === dept.id)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      if (fac.length > 0) {
        groups.push({
          department: dept,
          label: `${dept.name} (${dept.code}) — Cross-Department Faculty`,
          faculty: fac,
          isHome: false,
        });
      }
    }

    return groups;
  }, [formData.department_id, subjectDepartmentId, departments, facultyList]);

  const facultyByDepartment = prioritizedFacultyGroups;
  const facultyWithoutDepartment = facultyList
    .filter(member => !departments.some(department => department.id === member.department_id))
    .sort((left, right) => (left.name || '').localeCompare(right.name || '', undefined, { sensitivity: 'base' }));

  return (
    <div className="overview-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="page-eyebrow">Academic Curriculum</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0 6px' }}>
            Curriculum &amp; Subjects
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Configure courses, workload credits, lab blocks, and faculty before generating the timetable.
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
                setSelectedSectionClassId('');
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
                setSelectedSectionClassId('');
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
            className="btn btn-primary"
          >
            + Add Subject
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <strong style={{ color: '#0f172a' }}>Choose semester</strong>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
              {!selectedDeptFilter
                ? `Semester ${selectedSemester} belongs to Year ${Math.ceil(selectedSemester / 2)}. Choose a department type and department to view its subjects.`
                : selectedDepartmentType === 'lab' && linkedLiteratureDepartment
                  ? `Semester ${selectedSemester} belongs to Year ${Math.ceil(selectedSemester / 2)}. Showing ${linkedLiteratureDepartment.name} lab subjects.`
                  : selectedDepartmentType === 'lab'
                    ? 'No matching literature department was found for this lab department.'
                    : `Semester ${selectedSemester} belongs to Year ${Math.ceil(selectedSemester / 2)}. Subjects and labs for the selected department are shown automatically.`}
            </div>
          </div>
          <span style={{ color: '#475569', fontSize: 13, fontWeight: 700 }}>{filteredSubjects.length} subjects · {theorySubjects.length} theory · {labSubjects.length} labs</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(84px, 1fr))', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(semester => (
            <button key={semester} type="button" onClick={() => { setSelectedSemester(semester); setSelectedSectionClassId(''); }} style={{
              border: selectedSemester === semester ? '1px solid #0f766e' : '1px solid #dbe3ee',
              background: selectedSemester === semester ? '#0f766e' : '#fff',
              color: selectedSemester === semester ? '#fff' : '#475569',
              padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap'
            }}>Sem {semester}</button>
          ))}
        </div>
        {sectionClasses.length > 0 && <div style={{ marginTop: 16 }}><strong style={{ display: 'block', marginBottom: 8, color: '#334155', fontSize: 13 }}>Choose section for Year {Math.ceil(selectedSemester / 2)} · Semester {selectedSemester}</strong><div role="group" aria-label={`Sections for semester ${selectedSemester}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{sectionClasses.map(classItem => <button key={classItem.id} type="button" aria-pressed={selectedSectionClass?.id === classItem.id} onClick={() => setSelectedSectionClassId(classItem.id)} style={{ border: selectedSectionClass?.id === classItem.id ? '1px solid #0f766e' : '1px solid #dbe3ee', background: selectedSectionClass?.id === classItem.id ? '#0f766e' : '#fff', color: selectedSectionClass?.id === classItem.id ? '#fff' : '#475569', padding: '8px 15px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Section {classItem.section}</button>)}</div><p style={{ color: '#64748b', fontSize: 12, margin: '7px 0 0' }}>New subjects will be added to Year {selectedSectionClass?.year} / Section {selectedSectionClass?.section}.</p></div>}
        {sectionClasses.length === 0 && <div role="status" style={{ marginTop: 16, padding: 12, border: '1px solid #fed7aa', borderRadius: 9, background: '#fff7ed', color: '#9a3412', fontSize: 13 }}>
          No class sections are saved for Year {Math.ceil(selectedSemester / 2)}, Semester {selectedSemester} ({selectedSemester % 2 === 0 ? 'Even' : 'Odd'}). Save this year and semester in Class settings before adding subjects.
        </div>}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <span style={{ fontSize: 28 }}>📚</span>
          </div>
          <h2 className="empty-state-title">{selectedDeptFilter ? 'No Subjects Found' : `Semester ${selectedSemester}`}</h2>
          <p className="empty-state-desc">{selectedDeptFilter ? 'Add courses to build your academic syllabus and timetable generator mappings.' : 'Choose a department type and department to view the subjects for this semester.'}</p>
          <button
            onClick={openCreate}
            className="btn btn-primary"
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
                    <th style={{ padding: '10px 18px' }}>CODE</th><th>SUBJECT</th><th>FACULTY ({selectedSectionClass ? `SEC ${selectedSectionClass.section}` : 'ASSIGNED'})</th><th style={{ textAlign: 'center' }}>CREDIT</th><th>DEPARTMENT</th><th>YEAR</th><th style={{ textAlign: 'center' }}>PERIODS / WEEK</th><th style={{ textAlign: 'right', paddingRight: 18 }}>ACTION</th>
                  </tr></thead>
                  <tbody>{group.items.map((s: any) => {
                    const dept = departments.find(d => d.id === s.department_id);
                    const sectionAssignment = (selectedSectionClass?.subjects || []).find((item: any) => item.subject_id === s.id);
                    const facultyName = sectionAssignment?.faculty_name;
                    return <tr key={s.id} style={{ borderTop: '1px solid #eef2f7' }}>
                      <td style={{ padding: '14px 18px' }}><span style={{ fontWeight: 800, color: group.color, background: group.background, padding: '4px 8px', borderRadius: 6 }}>{s.code}</span></td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}{s.type === 'lab' && s.lab_mode === 'integrated' && <small style={{ display: 'block', color: '#b45309', marginTop: 4 }}>Integrated lab (2 periods)</small>}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {facultyName ? (
                          <span style={{ fontWeight: 600, color: '#0f766e', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}>
                            👤 {facultyName}
                          </span>
                        ) : (
                          <span style={{ color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600 }}>
                            ⚠️ Not assigned
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#475569', textAlign: 'center', fontWeight: 700 }}>{s.credits ?? 3}</td>
                      <td style={{ color: '#475569' }}>{dept?.code || '-'}</td><td style={{ color: '#475569' }}>Year {s.year || '-'}</td>
                      <td style={{ color: '#475569', textAlign: 'center', fontWeight: 700 }}>{sectionAssignment?.periods_per_week || s.periods_per_week || 3}</td>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem', overflow: 'hidden' }}>
          <div className="card" style={{ borderRadius: '16px', padding: 'clamp(1rem, 3vw, 2rem)', width: '100%', maxWidth: '540px', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', overscrollBehavior: 'contain', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                {editingSubjectId ? 'Edit Course Subject' : 'Add New Course Subject'}
              </h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => { setShowModal(false); resetForm(); }}
                aria-label="Close dialog"
                style={{ fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)' }}
              >
                ✕
              </button>
            </div>
            {editingSubjectId && (
              <div style={{ margin: '-0.25rem 0 1rem', padding: '10px 14px', borderRadius: 8, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--color-primary)', fontSize: 13 }}>
                Scheduling changes clear the affected odd/even cycle. Regenerate that cycle to apply the updated curriculum.
              </div>
            )}
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem' }}>Subject Name</label>
                <input
                  type='text'
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='Enter subject name (e.g. Data Structures & Algorithms)'
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>Subject Code</label>
                  <input
                    type='text'
                    className="form-input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder='e.g. CS301 / CS301L'
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>Department</label>
                  <select
                    className="form-input"
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value, class_id: '', faculty_id: '' })}
                    disabled={Boolean(editingSubjectId)}
                    required
                  >
                    <option value="" disabled hidden>Choose department</option>
                    {literatureDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {sectionClasses.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                    Section Assignment (Year {formData.year_level || Math.ceil(selectedSemester / 2)} · Semester {formData.semester || selectedSemester})
                  </label>
                  <select
                    className="form-input"
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    required
                  >
                    <option value="all">All Sections ({sectionClasses.map(c => `Section ${c.section}`).join(', ')})</option>
                    {sectionClasses.map(c => (
                      <option key={c.id} value={c.id}>Only Section {c.section}</option>
                    ))}
                  </select>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>
                    {formData.class_id === 'all'
                      ? 'This course will be added to all sections. Each section can have its own assigned faculty.'
                      : `Assigning faculty specifically for Section ${sectionClasses.find(c => c.id === formData.class_id)?.section || ''}.`}
                  </div>
                </div>
              )}

              {formData.subject_type === 'lab' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>Laboratory type</label>
                  <select
                    className="form-input"
                    value={formData.lab_mode}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      const autoBlockSize = newMode === 'main' ? 3 : 2;
                      setFormData(prev => ({
                        ...prev,
                        lab_mode: newMode,
                        lab_block_size: autoBlockSize,
                        weekly_periods: autoBlockSize,
                      }));
                    }}
                    style={{ marginBottom: 12 }}
                  >
                    <option value="main">Main lab (3 consecutive periods)</option>
                    <option value="integrated">Integrated lab (2 consecutive periods)</option>
                  </select>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>Consecutive Lab Block</label>
                  <select
                    className="form-input"
                    value={formData.lab_block_size}
                    onChange={(e) => {
                      const size = parseInt(e.target.value) || 3;
                      setFormData(prev => ({ ...prev, lab_block_size: size, weekly_periods: prev.weekly_periods % size === 0 ? prev.weekly_periods : size }));
                    }}
                    required
                  >
                    <option value={0} disabled hidden>Choose consecutive block</option>
                    <option value={3}>3 consecutive periods (Auto-selected for Main Lab)</option>
                    <option value={2}>2 consecutive periods</option>
                  </select>
                  <div style={{ color: '#0f766e', fontSize: 12, marginTop: 5, fontWeight: 600 }}>
                    {formData.lab_mode === 'main' ? '✓ Main lab automatically sets 3 consecutive periods.' : '✓ Integrated lab sets 2 consecutive periods.'}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>Course Type</label>
                  <select
                    className="form-input"
                    value={formData.subject_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      const isLab = newType === 'lab';
                      const blockSize = isLab ? (formData.lab_mode === 'integrated' ? 2 : 3) : 1;
                      setFormData(prev => ({
                        ...prev,
                        subject_type: newType,
                        lab_mode: isLab ? (prev.lab_mode || 'main') : prev.lab_mode,
                        lab_block_size: blockSize,
                        weekly_periods: isLab ? 3 : (prev.weekly_periods || 3),
                      }));
                    }}
                    required
                  >
                    <option value="" disabled hidden>Type</option>
                    <option value="theory">Theory</option>
                    <option value="lab">Lab / Practical</option>
                    <option value="project">Project</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>Periods / Wk</label>
                  <input
                    type='number'
                    className="form-input"
                    min='1'
                    max='10'
                    value={formData.weekly_periods}
                    onChange={(e) => setFormData({ ...formData, weekly_periods: parseInt(e.target.value) || 3 })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>Credits</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="30"
                    value={formData.credits}
                    onChange={e => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Assign Faculty Member
                  </label>
                  {selectedSubjectDepartment && (
                    <span style={{ fontSize: '0.75rem', color: '#0369a1', background: 'rgba(3, 105, 161, 0.1)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                      ⭐ Prioritizing {selectedSubjectDepartment.code} Faculty
                    </span>
                  )}
                </div>
                <select
                  className="form-input"
                  value={formData.faculty_id}
                  onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                  required
                >
                  <option value="" disabled hidden>Choose faculty member</option>
                  {prioritizedFacultyGroups.map((group, idx) => (
                    <optgroup key={idx} label={group.label}>
                      {group.faculty.map(member => (
                        <option key={member.id} value={member.id}>
                          {group.isHome ? `⭐ ${member.name} (${group.department?.code || 'Home Dept'})` : `${member.name}`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {facultyWithoutDepartment.length > 0 && (
                    <optgroup label="Other Faculty">
                      {facultyWithoutDepartment.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Faculty from {selectedSubjectDepartment?.name || 'the subject department'} are prioritized at the top. Cross-department faculty can be selected from groups below if needed.
                </div>
              </div>

              {selectedFaculty && (
                <div style={{ margin: '-0.5rem 0 1.25rem', padding: 12, borderRadius: 9, border: `1px solid ${isCrossDepartment ? '#7dd3fc' : 'var(--color-border)'}`, background: isCrossDepartment ? 'rgba(3, 105, 161, 0.06)' : 'var(--color-surface-hover)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ color: isCrossDepartment ? '#0369a1' : 'var(--color-text)', fontSize: 13 }}>
                      {isCrossDepartment
                        ? `Cross-department: ${selectedFacultyDepartment?.code || 'Faculty'} → ${selectedSubjectDepartment?.code || 'Class'}`
                        : `${selectedFacultyDepartment?.code || 'Department'} faculty assignment`}
                    </strong>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 700 }}>
                      {facultyScheduleLoading ? 'Analyzing timetable…' : `${facultySchedule.length} occupied periods in the ${formData.semester % 2 === 0 ? 'even' : 'odd'} cycle`}
                    </span>
                  </div>
                  {!facultyScheduleLoading && facultySchedule.length > 0 && (
                    <div style={{ marginTop: 8, color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                      Existing: {facultySchedule.slice(0, 6).map(entry => `${['Mon','Tue','Wed','Thu','Fri','Sat'][entry.day] || `Day ${entry.day + 1}`} P${entry.period} (${entry.class_label})`).join(' · ')}
                      {facultySchedule.length > 6 ? ` · +${facultySchedule.length - 6} more` : ''}
                    </div>
                  )}
                  <div style={{ marginTop: 7, color: 'var(--color-text-muted)', fontSize: 12 }}>
                    {isCrossDepartment
                      ? `Priority: generate ${selectedFacultyDepartment?.code || 'the home department'} first. ${selectedSubjectDepartment?.code || 'The other department'} will use only this faculty member's remaining free periods.`
                      : 'This is the faculty member’s home-department assignment.'}
                  </div>
                  {facultySchedule.length > 0 && (
                    <div style={{ marginTop: 5, color: '#b45309', fontSize: 12, fontWeight: 600 }}>
                      During manual entry, an occupied period will show “{selectedFaculty.name} is attending another class” with the exact class and time.
                    </div>
                  )}
                </div>
              )}

              <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', margin: '0 -0.25rem -0.25rem', padding: '1rem 0.25rem 0.25rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <button
                  type='button'
                  className="btn btn-outline"
                  onClick={() => { setShowModal(false); resetForm(); }}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className="btn btn-primary"
                  disabled={submitting}
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
