'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ClassesPage() {
  const [classesList, setClassesList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    department_id: '',
    year_level: 1,
    semester: 1,
    section: 'A',
    alsoApplyToPairedSemester: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState(1);

  const departmentKey = (value: string = '') => value.toLowerCase().replace(/laboratory|lab/g, '').replace(/[^a-z0-9]/g, '');
  const getLiteratureDepartmentForLab = (labDepartmentId: string) => {
    const labDepartment = departments.find(item => item.id === labDepartmentId);
    if (!labDepartment) return undefined;
    const labKeys = new Set([departmentKey(labDepartment.code), departmentKey(labDepartment.name)].filter(Boolean));
    return departments.find(item =>
      (item.department_type || 'department') === 'department' &&
      (labKeys.has(departmentKey(item.code)) || labKeys.has(departmentKey(item.name))),
    );
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [clsData, deptData] = await Promise.all([
        api.classes.list() as Promise<any[]>,
        api.departments.list() as Promise<any[]>,
      ]);
      setClassesList(Array.isArray(clsData) ? clsData : []);
      const depts = Array.isArray(deptData) ? deptData : [];
      setDepartments(depts);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load classes or departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department_id) {
      toast.error('Please select a department');
      return;
    }
    try {
      setSubmitting(true);
      const targetDepartmentId = formLinkedLiteratureDepartment?.id || formData.department_id;
      const normalizedSection = (formData.section || 'A').trim().toUpperCase();
      const duplicateClass = classesList.find(item =>
        item.department_id === targetDepartmentId &&
        item.year === formData.year_level &&
        item.semester === formData.semester &&
        String(item.section || 'A').toUpperCase() === normalizedSection
      );
      if (duplicateClass) {
        toast.error(`Year ${formData.year_level}, Semester ${formData.semester}, Section ${normalizedSection} already exists for ${formLinkedLiteratureDepartment?.name || departments.find(item => item.id === targetDepartmentId)?.name || 'this department'}.`);
        return;
      }
      await api.classes.create({
        department_id: targetDepartmentId,
        year: formData.year_level,
        semester: formData.semester,
        section: normalizedSection,
      });

      if (formData.alsoApplyToPairedSemester) {
        const pairedSemester = formData.semester % 2 === 1 ? formData.semester + 1 : formData.semester - 1;
        const pairedDuplicate = classesList.find(item =>
          item.department_id === targetDepartmentId &&
          item.year === formData.year_level &&
          item.semester === pairedSemester &&
          String(item.section || 'A').toUpperCase() === normalizedSection
        );
        if (!pairedDuplicate) {
          try {
            await api.classes.create({
              department_id: targetDepartmentId,
              year: formData.year_level,
              semester: pairedSemester,
              section: normalizedSection,
            });
            toast.success(`Section ${normalizedSection} created for Semester ${formData.semester} and paired Semester ${pairedSemester}!`);
          } catch (pairedErr: any) {
            console.warn('Paired semester creation note:', pairedErr);
            toast.success(`Class created for Semester ${formData.semester}!`);
          }
        } else {
          toast.success(`Class created for Semester ${formData.semester} (paired Semester ${pairedSemester} already exists).`);
        }
      } else {
        toast.success('Class created successfully!');
      }

      setShowModal(false);
      setFormData({
        department_id: '',
        year_level: 1,
        semester: 1,
        section: 'A',
        alsoApplyToPairedSemester: true,
      });
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create class');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.classes.delete(id);
      toast.success('Class deleted');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete class');
    }
  };

  const YEAR_LABELS: Record<number, string> = {
    1: '1st Year (I)',
    2: '2nd Year (II)',
    3: '3rd Year (III)',
    4: '4th Year (IV)',
  };
  const formDepartments = departments;
  const selectedFilterDepartment = departments.find(item => item.id === departmentFilter);
  const selectedFormDepartment = departments.find(item => item.id === formData.department_id);
  const formLinkedLiteratureDepartment = selectedFormDepartment?.department_type === 'lab'
    ? getLiteratureDepartmentForLab(formData.department_id)
    : undefined;
  const linkedLiteratureDepartment = selectedFilterDepartment?.department_type === 'lab'
    ? getLiteratureDepartmentForLab(departmentFilter)
    : undefined;
  const classDepartmentId = linkedLiteratureDepartment?.id || departmentFilter;
  const allDepartmentIds = departments.filter(item => (item.department_type || 'department') !== 'lab').map(item => item.id);
  const filteredClasses = classesList.filter(item =>
    (departmentFilter === 'all' ? allDepartmentIds.includes(item.department_id) : item.department_id === classDepartmentId) &&
    item.semester === semesterFilter
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Classes Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Define student year levels and department cohorts for conflict-free scheduling
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
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
          <span>+</span> Add Class
        </button>
      </div>

      <div className="card" style={{ marginBottom: 22, padding: 18 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ minWidth: 280, flex: 1 }}><label className="form-label">Department</label><select className="form-input" value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)} style={{ marginTop: 6, color: '#334155' }}><option value="all">All Departments</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code}){item.department_type === 'lab' ? ' - Lab' : ''}</option>)}</select></div>
          <div style={{ color: '#64748b', fontSize: 13, paddingBottom: 10 }}>{filteredClasses.length} class{filteredClasses.length === 1 ? '' : 'es'} in Semester {semesterFilter}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(82px, 1fr))', gap: 8, overflowX: 'auto' }}>{[1,2,3,4,5,6,7,8].map(semester => <button key={semester} type="button" onClick={() => setSemesterFilter(semester)} style={{ padding: '10px 12px', borderRadius: 8, border: semesterFilter === semester ? '1px solid #0f766e' : '1px solid #dbe3ee', background: semesterFilter === semester ? '#0f766e' : '#fff', color: semesterFilter === semester ? '#fff' : '#475569', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Sem {semester}</button>)}</div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Loading classes...</div>
      ) : classesList.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '4rem', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>No Classes Configured Yet</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Create classes for your departments to generate academic timetables.</p>
          <button
            onClick={() => setShowModal(true)}
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
            + Add Class
          </button>
        </div>
      ) : filteredClasses.length === 0 ? <div className="card" style={{ padding: 36, textAlign: 'center' }}><h3>No classes in Semester {semesterFilter}</h3><p style={{ color: '#64748b' }}>Change the department or semester, or add a class.</p></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredClasses.map((cls) => {
            const dept = departments.find(d => d.id === cls.department_id);
            return (
              <div
                key={cls.id}
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '1.5rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ background: selectedFilterDepartment?.department_type === 'lab' ? '#f3e8ff' : '#dbeafe', color: selectedFilterDepartment?.department_type === 'lab' ? '#7c3aed' : '#1e40af', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                      {selectedFilterDepartment?.department_type === 'lab' ? 'Lab Class' : 'Class'}
                    </span>
                    <button
                      onClick={() => handleDelete(cls.id, `${cls.department_name || 'Class'} Year ${cls.year}`)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                      title='Delete Class'
                    >
                      Delete
                    </button>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                    {cls.department_name || 'Class'} · Semester {cls.semester}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>
                    <strong>Department:</strong> {dept ? `${dept.name} (${dept.code})` : 'Department'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>{YEAR_LABELS[cls.year] || `Year ${cls.year}`}</span>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                      Section {cls.section || 'A'}
                    </span>
                    <span>{cls.subjects?.length || 0} Subjects</span>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <a
                    href={`/timetable?class_id=${cls.id}`}
                    style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    View Timetable 
                  </a>
                  <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    Active
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Class */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '2rem', width: '100%', maxWidth: '620px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.5rem', color: '#0f172a' }}>Add New Class</h2>
            <form onSubmit={handleCreate}>
              {selectedFormDepartment?.department_type === 'lab' && formData.department_id && (
                <div style={{ margin: '-0.25rem 0 1rem', padding: '11px 13px', borderRadius: 8, border: '1px solid #ddd6fe', background: '#faf5ff', color: '#6d28d9', fontSize: 13 }}>
                  <strong>Lab Class:</strong> {selectedFormDepartment?.name || 'Selected lab'}
                  {formLinkedLiteratureDepartment
                    ? ` · linked to ${formLinkedLiteratureDepartment.name} (${formLinkedLiteratureDepartment.code})`
                    : ' · no matching Literature department found'}
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                  required
                >
                  <option value="" disabled hidden>Choose department</option>
                  {formDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code}){d.department_type === 'lab' ? ' - Lab' : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Year Level</label>
                  <select
                    value={formData.year_level}
                    onChange={(e) => {
                      const year = parseInt(e.target.value) || 1;
                      setFormData({ ...formData, year_level: year, semester: year * 2 - 1 });
                    }}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                  >
                    <option value={1}>1st Year (I)</option>
                    <option value={2}>2nd Year (II)</option>
                    <option value={3}>3rd Year (III)</option>
                    <option value={4}>4th Year (IV)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                  >
                    {[formData.year_level * 2 - 1, formData.year_level * 2].map(semester => (
                      <option key={semester} value={semester}>Semester {semester}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Section</label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                  >
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(sec => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem', padding: '11px 14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={formData.alsoApplyToPairedSemester}
                    onChange={(e) => setFormData({ ...formData, alsoApplyToPairedSemester: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                  />
                  Also apply Section {formData.section} to paired Semester {formData.semester % 2 === 1 ? formData.semester + 1 : formData.semester - 1}
                </label>
                <p style={{ margin: '4px 0 0 24px', fontSize: '0.78rem', color: '#64748b' }}>
                  Automatically creates Section {formData.section} in {formData.semester % 2 === 1 ? `Semester ${formData.semester + 1}` : `Semester ${formData.semester - 1}`} so student sections stay consistent across both semesters in Year {formData.year_level}.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type='button'
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.65rem 1.25rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  style={{ padding: '0.65rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? 'Saving...' : 'Add Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
