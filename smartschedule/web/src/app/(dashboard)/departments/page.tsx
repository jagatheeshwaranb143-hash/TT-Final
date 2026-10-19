'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Plus, Trash2, ArrowRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentTypeFilter, setDepartmentTypeFilter] = useState<'all' | 'department' | 'lab'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{ name: string; code: string; department_type: 'department' | 'lab' }>({
    name: '',
    code: '',
    department_type: 'department',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = (await api.departments.list()) as any[];
      setDepartments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const visibleDepartments = departments.filter(
    (dept) => departmentTypeFilter === 'all' || (dept.department_type || 'department') === departmentTypeFilter
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      setSubmitting(true);
      await api.departments.create(formData);
      toast.success(formData.department_type === 'lab' ? 'Lab department created successfully!' : 'Department created successfully!');
      setShowModal(false);
      setFormData({ name: '', code: '', department_type: 'department' });
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;
    try {
      await api.departments.delete(id);
      toast.success('Department deleted');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete department');
    }
  };

  return (
    <div className="overview-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <span className="page-eyebrow">Academic Structure</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0 6px' }}>Departments</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Manage academic departments, degree programs, and curriculum units
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          <Plus size={18} /> Add Department / Lab
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Building2 size={28} />
          </div>
          <h2 className="empty-state-title">No Departments Found</h2>
          <p className="empty-state-desc">
            Create your first department to begin setting up faculty, classes, and scheduling timetables.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Department
          </button>
        </div>
      ) : (
        <>
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
              padding: '12px 18px',
              maxWidth: 420,
            }}
          >
            <label htmlFor="department-type-filter" style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: 13 }}>
              Filter by type:
            </label>
            <select
              id="department-type-filter"
              className="form-input"
              value={departmentTypeFilter}
              onChange={(e) => setDepartmentTypeFilter(e.target.value as 'all' | 'department' | 'lab')}
              style={{ padding: '6px 10px', fontSize: 13 }}
            >
              <option value="all">Show all ({departments.length})</option>
              <option value="department">Literature Departments</option>
              <option value="lab">Lab Departments</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {visibleDepartments.map((dept) => (
              <div
                key={dept.id}
                className="card card-hover"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
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
                      {dept.code}
                    </span>
                    <button
                      className="icon-button danger"
                      onClick={() => handleDelete(dept.id, dept.name)}
                      title="Delete Department"
                      aria-label={`Delete ${dept.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <span
                    style={{
                      display: 'inline-block',
                      marginBottom: '0.75rem',
                      color: dept.department_type === 'lab' ? '#7c3aed' : '#0f766e',
                      background: dept.department_type === 'lab' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(15, 118, 110, 0.1)',
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                    }}
                  >
                    {dept.department_type === 'lab' ? 'Lab Department' : 'Literature Department'}
                  </span>

                  <Link
                    href={`/timetable?department_type=${encodeURIComponent(dept.department_type || 'department')}&department_id=${encodeURIComponent(dept.id)}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    title={`Open ${dept.name} timetable`}
                  >
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 650, marginBottom: '0.5rem' }}>
                      {dept.name}
                    </h2>
                  </Link>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    ID: {dept.id.substring(0, 8)}...
                  </p>
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
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#16a34a',
                      background: 'rgba(22, 163, 74, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    Active
                  </span>
                  <Link
                    href={`/timetable?department_type=${encodeURIComponent(dept.department_type || 'department')}&department_id=${encodeURIComponent(dept.id)}`}
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-primary)',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    View timetable <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Dialog */}
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
              maxWidth: '460px',
              borderRadius: 16,
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Department or Lab</h2>
              <button className="icon-button" onClick={() => setShowModal(false)} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="department-type"
                  className="form-label"
                  style={{ display: 'block', marginBottom: '0.5rem' }}
                >
                  Department Type
                </label>
                <select
                  id="department-type"
                  className="form-input"
                  value={formData.department_type}
                  onChange={(e) => setFormData({ ...formData, department_type: e.target.value as 'department' | 'lab' })}
                >
                  <option value="department">Literature Department</option>
                  <option value="lab">Lab Department</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  {formData.department_type === 'lab' ? 'Lab Department Name' : 'Literature Department Name'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={formData.department_type === 'lab' ? 'e.g. Artificial Intelligence Lab' : 'e.g. Computer Science & Engineering'}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Department Code
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder={formData.department_type === 'lab' ? 'e.g. AI-LAB' : 'e.g. CSE'}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : formData.department_type === 'lab' ? 'Create Lab Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
