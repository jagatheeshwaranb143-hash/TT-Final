'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function LabsPage() {
  const [labs, setLabs] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    building: 'CS Block',
    capacity: 35,
    equipment: '35 High-performance Workstations, Gigabit Switch',
    department_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [labsData, deptData] = await Promise.all([
        api.labs.list() as Promise<any[]>,
        api.departments.list() as Promise<any[]>,
      ]);
      setLabs(Array.isArray(labsData) ? labsData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      if (deptData && deptData.length > 0 && !formData.department_id) {
        setFormData(prev => ({ ...prev, department_id: deptData[0].id }));
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load laboratories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.department_id) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      setSubmitting(true);
      await api.labs.create(formData);
      toast.success('Laboratory added successfully!');
      setShowModal(false);
      setFormData({
        name: '',
        building: 'CS Block',
        capacity: 35,
        equipment: '35 High-performance Workstations, Gigabit Switch',
        department_id: departments[0]?.id || '',
      });
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add laboratory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.labs.delete(id);
      toast.success('Lab deleted');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete lab');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>Laboratories & Workspaces</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Manage specialized lab facilities, equipment capacity, and practical batch schedules</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.25rem',
            borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span>+</span> Add Laboratory
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Loading laboratories...</div>
      ) : labs.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '4rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔬</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Laboratories Configured</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Create specialized labs for practical courses and batch divisions.</p>
          <button onClick={() => setShowModal(true)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}>+ Add Laboratory</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {labs.map((l) => (
            <div
              key={l.id}
              style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    🔬 Practical Lab
                  </span>
                  <button
                    onClick={() => handleDelete(l.id, l.name)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.4rem' }}>{l.name}</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>🏢 {l.building || 'Campus Lab Wing'}</p>
                {l.equipment && (
                  <p style={{ color: '#475569', fontSize: '0.8rem', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                    🛠️ {l.equipment}
                  </p>
                )}
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: 600 }}>👥 Capacity: {l.capacity || 30}</span>
                <span style={{ fontSize: '0.75rem', background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>Active</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Add Laboratory Space</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Laboratory Name</label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='e.g. Computing Lab 1'
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Building</label>
                  <input
                    type='text'
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                    placeholder='e.g. Science Block'
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Capacity</label>
                  <input
                    type='number'
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 30 })}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Equipment / Software</label>
                <input
                  type='text'
                  value={formData.equipment}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                  placeholder='e.g. 30 Linux PCs, MATLAB, Python'
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
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
                  {submitting ? 'Saving...' : 'Add Laboratory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
