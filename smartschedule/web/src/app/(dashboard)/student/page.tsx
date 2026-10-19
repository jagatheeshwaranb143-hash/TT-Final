'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function StudentDashboard() {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return (
    <div className="overview-page">
      {/* Hero */}
      <section className="overview-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><GraduationCap size={15} /> Student Portal</div>
          <h1>Welcome back,<br /><span>{user?.full_name || 'Student'}</span></h1>
          <p>{today}{isWeekend ? ' — Enjoy your weekend!' : ' — Have a productive day!'}</p>
          <div className="hero-actions">
            <Link className="hero-primary" href="/timetable">
              <CalendarDays size={18} /> View my timetable
            </Link>
          </div>
        </div>
        <div className="hero-health">
          <div className="health-ring">
            <Clock size={31} />
            <strong>{isWeekend ? 'Off' : 'On'}</strong>
            <span>{isWeekend ? 'no classes today' : 'check timetable'}</span>
          </div>
          <p><i />{isWeekend ? 'Weekend' : 'Weekday'}</p>
        </div>
      </section>

      {/* Quick cards */}
      <section className="overview-stats" aria-label="Quick access">
        <Link href="/timetable" className="overview-stat">
          <div className="stat-symbol blue"><CalendarDays size={21} /></div>
          <div><span>My timetable</span><strong>View weekly schedule</strong></div>
          <ArrowRight className="stat-arrow" size={17} />
        </Link>
        <Link href="/timetable/master" className="overview-stat">
          <div className="stat-symbol teal"><Sparkles size={21} /></div>
          <div><span>Department master</span><strong>All class periods</strong></div>
          <ArrowRight className="stat-arrow" size={17} />
        </Link>
      </section>

      {/* Info panel */}
      <section className="card" style={{ padding: '28px', marginTop: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
          <div className="stat-symbol blue" style={{ width: 40, height: 40, flex: '0 0 40px' }}><CalendarDays size={19} /></div>
          <div>
            <h2 style={{ fontSize: '17px', marginBottom: '2px' }}>Your schedule</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              Your department&apos;s timetable is managed by the HOD and admin. Check the timetable page for your weekly class schedule.
            </p>
          </div>
        </div>
        <Link href="/timetable" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
          Open timetable <ArrowRight size={15} />
        </Link>
      </section>
    </div>
  );
}
