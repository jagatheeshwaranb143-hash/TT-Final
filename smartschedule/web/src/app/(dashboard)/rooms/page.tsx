'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    building: 'Engineering Block A',
    floor: 1,
    capacity: 60,
    department_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roomsData, deptData] = await Promise.all([
        api.rooms.list() as Promise<any[]>,
        api.departments.list() as Promise<any[]>,
      ]);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      if (deptData && deptData.length > 0 && !formData.department_id) {
        setFormData(prev => ({ ...prev, department_id: deptData[0].id }));
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load rooms');
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
      await api.rooms.create(formData);
      toast.success('Room added successfully!');
      setShowModal(false);
      setFormData({
        name: '',
        building: 'Engineering Block A',
        floor: 1,
        capacity: 60,
        department_id: departments[0]?.id || '',
      });
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.rooms.delete(id);
      toast.success('Room deleted');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete room');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>Lecture Halls & Rooms</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Manage physical lecture spaces, seating capacities, and building allocations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.25rem',
            borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span>+</span> Add Room
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Loading classrooms...</div>
      ) : rooms.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '4rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚪</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Classrooms Added</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Add lecture halls to start assigning class sessions.</p>
          <button onClick={() => setShowModal(true)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}>+ Add Room</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {rooms.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ background: '#f8fafc', color: '#0f172a', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', fontSize: '0.9rem', border: '1px solid #e2e8f0' }}>
                    {r.name}
                  </span>
                  <button
                    onClick={() => handleDelete(r.id, r.name)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>
                <div style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '0.25rem' }}>🏢 {r.building || 'Main Campus'}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Floor {r.floor || 1}</div>
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600 }}>👥 Capacity: {r.capacity || 60}</span>
                <span style={{ fontSize: '0.75rem', background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>Available</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '460px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Add New Classroom</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Room Name / Number</label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='e.g. Room 101'
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Building</label>
                <input
                  type='text'
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  placeholder='e.g. Block A'
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Floor</label>
                  <input
                    type='number'
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Capacity</label>
                  <input
                    type='number'
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 60 })}
                    style={{ width: '100%', padding: '0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
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
                  {submitting ? 'Saving...' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
