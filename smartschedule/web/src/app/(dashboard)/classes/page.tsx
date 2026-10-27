'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraduationCap, Plus, Trash2, ArrowRight, X } from 'lucide-react';
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

  const departmentKey = (value: string = '') =>
    value.toLowerCase().replace(/laboratory|lab/g, '').replace(/[^a-z0-9]/g, '');

  const getLiteratureDepartmentForLab = (labDepartmentId: string) => {
    const labDepartment = departments.find((item) => item.id === labDepartmentId);
    if (!labDepartment) return undefined;
    const labKeys = new Set([departmentKey(labDepartment.code), departmentKey(labDepartment.name)].filter(Boolean));
    return departments.find(
      (item) =>
        (item.department_type || 'department') === 'department' &&
        (labKeys.has(departmentKey(item.code)) || labKeys.has(departmentKey(item.name)))
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
      const duplicateClass = classesList.find(
        (item) =>
          item.department_id === targetDepartmentId &&
          item.year === formData.year_level &&
          item.semester === formData.semester &&
          String(item.section || 'A').toUpperCase() === normalizedSection
      );
      if (duplicateClass) {
        toast.error(
          `Year ${formData.year_level}, Semester ${formData.semester}, Section ${normalizedSection} already exists for ${
            formLinkedLiteratureDepartment?.name ||
            departments.find((item) => item.id === targetDepartmentId)?.name ||
            'this department'
          }.`
        );
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
        const pairedDuplicate = classesList.find(
          (item) =>
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
          } catch {
            // Already created or non-blocking
          }
        }
      } else {
        toast.success('Class created successfully');
      }

      setShowModal(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create class');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;
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
  const selectedFilterDepartment = departments.find((item) => item.id === departmentFilter);
  const selectedFormDepartment = departments.find((item) => item.id === formData.department_id);
  const formLinkedLiteratureDepartment =
    selectedFormDepartment?.department_type === 'lab' ? getLiteratureDepartmentForLab(formData.department_id) : undefined;
  const linkedLiteratureDepartment =
    selectedFilterDepartment?.department_type === 'lab' ? getLiteratureDepartmentForLab(departmentFilter) : undefined;
  const classDepartmentId = linkedLiteratureDepartment?.id || departmentFilter;
  const allDepartmentIds = departments.filter((item) => (item.department_type || 'department') !== 'lab').map((item) => item.id);
  const filteredClasses = classesList.filter(
    (item) =>
      (departmentFilter === 'all' ? allDepartmentIds.includes(item.department_id) : item.department_id === classDepartmentId) &&
      item.semester === semesterFilter
  );

  return (
    <div className="overview-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <span className="page-eyebrow">Academic Cohorts</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0 6px' }}>Classes Management</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Define student cohorts and class sections for conflict-free scheduling
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Class
        </button>
      </div>

      {/* Filter and Semester Toolbar */}
      <div className="card" style={{ marginBottom: 22, padding: '18px 22px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <label className="form-label" style={{ marginBottom: 6 }}>
              Department Filter
            </label>
            <select
              className="form-input"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments
                .filter((item) => (item.department_type || 'department') !== 'lab')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
            </select>
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, paddingBottom: 8, fontWeight: 600 }}>
            {filteredClasses.length} class{filteredClasses.length === 1 ? '' : 'es'} in Semester {semesterFilter}
          </div>
        </div>

        {/* Semester Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(70px, 1fr))', gap: 8, overflowX: 'auto' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => {
            const active = semesterFilter === semester;
            return (
              <button
                key={semester}
                type="button"
                onClick={() => setSemesterFilter(semester)}
                style={{
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                Sem {semester}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : classesList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <GraduationCap size={28} />
          </div>
          <h2 className="empty-state-title">No Classes Configured Yet</h2>
          <p className="empty-state-desc">
            Create classes for your departments to generate academic timetables.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Class
          </button>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <GraduationCap size={28} />
          </div>
          <h2 className="empty-state-title">No Classes in Semester {semesterFilter}</h2>
          <p className="empty-state-desc">
            No class sections match the selected department and semester. You can add one below.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Class to Semester {semesterFilter}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredClasses.map((cls) => {
            const dept = departments.find((d) => d.id === cls.department_id);
            return (
              <div
                key={cls.id}
                className="card card-hover"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span
                      style={{
                        background: 'var(--color-primary-50)',
                        color: 'var(--color-primary)',
                        fontWeight: 750,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                      }}
                    >
                      {selectedFilterDepartment?.department_type === 'lab' ? 'Lab Class' : 'Class'}
                    </span>
                    <button
                      className="icon-button danger"
                      onClick={() => handleDelete(cls.id, `${cls.department_name || 'Class'} Year ${cls.year}`)}
                      title="Delete Class"
                      aria-label={`Delete ${cls.department_name || 'Class'}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <h2 style={{ fontSize: '1.2rem', fontWeight: 650, marginBottom: '0.35rem' }}>
                    {cls.department_name || 'Class'} · Semester {cls.semester}
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.65rem' }}>
                    <strong>Department:</strong> {dept ? `${dept.name} (${dept.code})` : 'Department'}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{YEAR_LABELS[cls.year] || `Year ${cls.year}`}</span>
                    <span
                      style={{
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: '#4f46e5',
                        fontWeight: 750,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                      }}
                    >
                      Section {cls.section || 'A'}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{cls.subjects?.length || 0} Subjects</span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '1.5rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Link
                    href={`/timetable?class_id=${cls.id}`}
                    style={{
                      color: 'var(--color-primary)',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    View Timetable <ArrowRight size={14} />
                  </Link>
                  <span
                    style={{
                      background: 'rgba(22, 163, 74, 0.1)',
                      color: '#16a34a',
                      fontSize: '0.75rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              padding: '2rem',
              width: '100%',
              maxWidth: '560px',
              borderRadius: 16,
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add New Class Section</h2>
              <button className="icon-button" onClick={() => setShowModal(false)} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              {selectedFormDepartment?.department_type === 'lab' && formData.department_id && (
                <div
                  style={{
                    margin: '-0.25rem 0 1rem',
                    padding: '11px 14px',
                    borderRadius: 8,
                    border: '1px solid #ddd6fe',
                    background: 'rgba(124, 58, 237, 0.06)',
                    color: '#6d28d9',
                    fontSize: 13,
                  }}
                >
                  <strong>Lab Class:</strong> {selectedFormDepartment?.name || 'Selected lab'}
                  {formLinkedLiteratureDepartment
                    ? ` · linked to ${formLinkedLiteratureDepartment.name} (${formLinkedLiteratureDepartment.code})`
                    : ' · no matching Literature department found'}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                  Department
                </label>
                <select
                  className="form-input"
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  required
                >
                  <option value="" disabled hidden>
                    Choose department
                  </option>
                  {formDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                      {d.department_type === 'lab' ? ' - Lab' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                    Year Level
                  </label>
                  <select
                    className="form-input"
                    value={formData.year_level}
                    onChange={(e) => {
                      const year = parseInt(e.target.value) || 1;
                      setFormData({ ...formData, year_level: year, semester: year * 2 - 1 });
                    }}
                  >
                    <option value={1}>1st Year (I)</option>
                    <option value={2}>2nd Year (II)</option>
                    <option value={3}>3rd Year (III)</option>
                    <option value={4}>4th Year (IV)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                    Semester
                  </label>
                  <select
                    className="form-input"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                  >
                    {[formData.year_level * 2 - 1, formData.year_level * 2].map((semester) => (
                      <option key={semester} value={semester}>
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                    Section
                  </label>
                  <select
                    className="form-input"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                  >
                    {['A', 'B', 'C', 'D', 'E', 'F'].map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={formData.alsoApplyToPairedSemester}
                    onChange={(e) => setFormData({ ...formData, alsoApplyToPairedSemester: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                  />
                  Also apply Section {formData.section} to paired Semester {formData.semester % 2 === 1 ? formData.semester + 1 : formData.semester - 1}
                </label>
                <p style={{ margin: '4px 0 0 24px', fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  Automatically creates Section {formData.section} in {formData.semester % 2 === 1 ? `Semester ${formData.semester + 1}` : `Semester ${formData.semester - 1}`} to maintain section continuity across Year {formData.year_level}.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
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
