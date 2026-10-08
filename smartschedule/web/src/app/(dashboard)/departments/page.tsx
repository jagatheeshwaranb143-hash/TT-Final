'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentTypeFilter, setDepartmentTypeFilter] = useState<'all' | 'department' | 'lab'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{ name: string; code: string; department_type: 'department' | 'lab' }>({ name: '', code: '', department_type: 'department' });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.departments.list() as any[];
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

  const visibleDepartments = departments.filter(dept => departmentTypeFilter === 'all' || (dept.department_type || 'department') === departmentTypeFilter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
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
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.departments.delete(id);
      toast.success('Department deleted');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete department');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>Departments</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Manage academic departments, degree programs, and curriculum</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.25rem',
            borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span>+</span> Add Department / Lab
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Loading departments...</div>
      ) : departments.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '4rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Departments Found</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Create your first department to begin setting up faculty and timetables.</p>
          <button onClick={() => setShowModal(true)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}>+ Add Department</button>
        </div>
      ) : (
        <>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: 16, maxWidth: 460 }}>
          <label htmlFor="department-type-filter" style={{ color: '#334155', fontWeight: 700 }}>Department type</label>
          <select id="department-type-filter" className="form-input" value={departmentTypeFilter} onChange={event => setDepartmentTypeFilter(event.target.value as 'all' | 'department' | 'lab')}>
            <option value="all">Show all</option><option value="department">Literature Department</option><option value="lab">Lab Department</option>
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {visibleDepartments.map((dept) => (
            <div
              key={dept.id}
              style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', fontSize: '0.875rem' }}>
                    {dept.code}
                  </span>
                  <button
                    onClick={() => handleDelete(dept.id, dept.name)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                    title='Delete Department'
                  >
                    Delete
                  </button>
                </div>
                <span style={{ display: 'inline-block', marginBottom: '0.7rem', color: dept.department_type === 'lab' ? '#7c3aed' : '#0f766e', background: dept.department_type === 'lab' ? '#f3e8ff' : '#ccfbf1', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{dept.department_type === 'lab' ? 'Lab Department' : 'Literature Department'}</span>
                <Link href={`/timetable?department_type=${encodeURIComponent(dept.department_type || 'department')}&department_id=${encodeURIComponent(dept.id)}`} style={{ textDecoration: 'none' }} title={`Open ${dept.name} timetable`}><h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>{dept.name}</h3></Link>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>ID: {dept.id.substring(0, 8)}...</p>
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#10b981', background: '#ecfdf5', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>Active</span>
                <Link href={`/timetable?department_type=${encodeURIComponent(dept.department_type || 'department')}&department_id=${encodeURIComponent(dept.id)}`} style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>View timetable →</Link>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Add Department or Lab</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="department-type" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Choose type</label>
                <select id="department-type" className="form-input" value={formData.department_type} onChange={(e) => setFormData({ ...formData, department_type: e.target.value as 'department' | 'lab' })}>
                  <option value="department">Literature Department</option>
                  <option value="lab">Lab Department</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>{formData.department_type === 'lab' ? 'Lab Department Name' : 'Literature Department Name'}</label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={formData.department_type === 'lab' ? 'e.g. Artificial Intelligence Lab' : 'e.g. Computer Science & Engineering'}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Department Code</label>
                <input
                  type='text'
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder={formData.department_type === 'lab' ? 'e.g. AI-LAB' : 'e.g. CSE'}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type='button'
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.625rem 1.25rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  style={{ padding: '0.625rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
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
