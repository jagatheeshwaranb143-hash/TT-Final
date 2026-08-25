'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function PrincipalDashboard() {
  const [counts, setCounts] = useState({
    departments: 0,
    faculty: 0,
    subjects: 0,
    classes: 0,
    timetables: 1,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [depts, facs, subs, cls] = await Promise.all([
          api.departments.list().catch(() => []),
          api.faculty.list().catch(() => []),
          api.subjects.list().catch(() => []),
          api.classes.list().catch(() => []),
        ]);

        setCounts({
          departments: Array.isArray(depts) ? depts.length : 0,
          faculty: Array.isArray(facs) ? facs.length : 0,
          subjects: Array.isArray(subs) ? subs.length : 0,
          classes: Array.isArray(cls) ? cls.length : 0,
          timetables: 1,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '16px',
          padding: '2.5rem',
          color: 'white',
          marginBottom: '2rem',
          boxShadow: '0 10px 25px -5px rgba(15,23,42,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '999px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.75rem' }}>
             AI-Powered Conflict-Free Engine
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            College Timetable Generation Control Center
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '650px', lineHeight: 1.5 }}>
            Manage departments, qualified faculty, curriculum subjects, and auto-generate conflict-free master & personal timetables using CP-SAT constraint optimization.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link
            href="/timetable/generate"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              textDecoration: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
            }}
          >
             Generate Timetable
          </Link>
          <Link
            href="/timetable"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              textDecoration: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
             View Master Grid
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '14px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Departments</span>
            <span style={{ fontSize: '1.5rem' }}></span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{loading ? '...' : counts.departments}</div>
          <Link href="/departments" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', marginTop: '0.5rem', display: 'inline-block' }}>
            Manage departments 
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: '14px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Faculty Staff</span>
            <span style={{ fontSize: '1.5rem' }}></span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{loading ? '...' : counts.faculty}</div>
          <Link href="/faculty" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', marginTop: '0.5rem', display: 'inline-block' }}>
            View faculty workload 
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: '14px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Course Subjects</span>
            <span style={{ fontSize: '1.5rem' }}></span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{loading ? '...' : counts.subjects}</div>
          <Link href="/subjects" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', marginTop: '0.5rem', display: 'inline-block' }}>
            Configure curriculum 
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: '14px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Classes</span>
            <span style={{ fontSize: '1.5rem' }}></span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{loading ? '...' : counts.classes}</div>
          <Link href="/classes" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', marginTop: '0.5rem', display: 'inline-block' }}>
            Manage classes 
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: '14px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Schedule Status</span>
            <span style={{ fontSize: '1.5rem' }}></span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#16a34a' }}>Conflict-Free</div>
          <Link href="/timetable" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', marginTop: '0.5rem', display: 'inline-block' }}>
            Live cell editor & validation 
          </Link>
        </div>
      </div>

      {/* Step by Step Flow Guide */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>
          Standard Timetable Creation Workflow
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span style={{ background: '#2563eb', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>1</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Department Entry</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Add college departments (e.g. CSE, AI&DS, ECE, MECH) with department code.
            </p>
            <Link href="/departments" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
              Open Departments 
            </Link>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span style={{ background: '#2563eb', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>2</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Faculty & Subjects</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Add faculty members and subjects with periods/week required and theory/lab type.
            </p>
            <Link href="/faculty" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
              Open Faculty Entry 
            </Link>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span style={{ background: '#2563eb', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>3</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Auto-Generate Schedule</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Select class cohort and trigger Google OR-Tools CP-SAT solver for conflict-free placement.
            </p>
            <Link href="/timetable/generate" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
              Launch Generator 
            </Link>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span style={{ background: '#2563eb', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>4</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Master & Faculty Grids</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Inspect and export the generated master grid and individual faculty personal timetables.
            </p>
            <Link href="/timetable" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
              View Timetable Grid 
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
