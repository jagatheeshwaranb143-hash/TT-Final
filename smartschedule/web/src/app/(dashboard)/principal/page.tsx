'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Building2, CalendarCheck2, GraduationCap, Sparkles, Users, WandSparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

const workflow = [
  { title: 'Create departments', text: 'Define the academic structure and department codes.', href: '/departments' },
  { title: 'Assign people & subjects', text: 'Connect qualified faculty to the curriculum.', href: '/faculty' },
  { title: 'Generate each semester', text: 'Build schedules in sequence with CP-SAT constraints.', href: '/timetable/generate' },
  { title: 'Review & adjust', text: 'Inspect every class and safely edit individual slots.', href: '/timetable' },
];

export default function PrincipalDashboard() {
  const [counts, setCounts] = useState({ departments: 0, faculty: 0, subjects: 0, classes: 0, entries: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [departments, faculty, subjects, classes, stats] = await Promise.all([
        api.departments.list(), api.faculty.list(), api.subjects.list(), api.classes.list(), api.dashboard.getPrincipalStats(),
      ]) as any[];
      setCounts({
        departments: departments.length,
        faculty: faculty.length,
        subjects: subjects.length,
        classes: classes.length,
        entries: stats.totalEntries || 0,
      });
    } catch (reason: any) {
      setError(true);
      toast.error(reason.message || 'Could not load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cards = [
    { label: 'Departments', value: counts.departments, href: '/departments', icon: Building2, tone: 'blue' },
    { label: 'Faculty members', value: counts.faculty, href: '/faculty', icon: Users, tone: 'violet' },
    { label: 'Course subjects', value: counts.subjects, href: '/subjects', icon: BookOpen, tone: 'amber' },
    { label: 'Active classes', value: counts.classes, href: '/classes', icon: GraduationCap, tone: 'teal' },
  ];

  return (
    <div className="overview-page">
      <section className="overview-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15} /> Constraint-powered scheduling</div>
          <h1>Your academic schedule,<br /><span>clear and conflict-free.</span></h1>
          <p>Build curricula, coordinate faculty, and generate dependable semester timetables from one focused workspace.</p>
          <div className="hero-actions">
            <Link className="hero-primary" href="/timetable/generate"><WandSparkles size={18} /> Generate timetable</Link>
            <Link className="hero-secondary" href="/timetable">Open master grid <ArrowRight size={17} /></Link>
          </div>
        </div>
        <div className="hero-health">
          <div className="health-ring"><CalendarCheck2 size={31} /><strong>{counts.entries.toLocaleString()}</strong><span>scheduled periods</span></div>
          <p><i /> Live schedule data</p>
        </div>
      </section>

      {error && <div className="alert alert-error" role="alert">Dashboard data could not be refreshed. <button className="inline-action" onClick={load}>Try again</button></div>}

      <section className="overview-stats" aria-label="Workspace summary">
        {cards.map(({ label, value, href, icon: Icon, tone }) => (
          <Link href={href} className="overview-stat" key={label}>
            <div className={`stat-symbol ${tone}`}><Icon size={21} /></div>
            <div><span>{label}</span><strong>{loading ? <i className="mini-skeleton" /> : value.toLocaleString()}</strong></div>
            <ArrowRight className="stat-arrow" size={17} />
          </Link>
        ))}
      </section>

      <section className="workflow-panel">
        <div className="panel-heading"><div><span>Recommended workflow</span><h2>From setup to a finished timetable</h2></div><p>Complete these steps in order for the strongest generation result.</p></div>
        <div className="workflow-grid">
          {workflow.map((step, index) => (
            <Link href={step.href} className="workflow-step" key={step.title}>
              <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3><p>{step.text}</p><span className="step-link">Continue <ArrowRight size={15} /></span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
