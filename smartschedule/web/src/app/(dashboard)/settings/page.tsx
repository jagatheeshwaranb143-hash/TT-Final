'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Badge, BookOpen, Building2, CalendarDays, Check, CheckCircle2, Clock3, Eye, EyeOff, FileText, Globe2, GraduationCap, KeyRound, Languages, Laptop, LayoutList, Mail, MapPin, Moon, RotateCcw, Save, Search, Settings2, ShieldCheck, Sun, Table2, UserRound, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { applyTheme, ColorTheme, getBasicPreferences, getDefaultSemesterCycle, getTimetablePreferences, SemesterCycle, setBasicPreferences, setDefaultSemesterCycle, setTimetablePreferences, TimetableOrientation } from '@/lib/preferences';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [cycle, setCycle] = useState<SemesterCycle>(getDefaultSemesterCycle);
  const [basic, setBasic] = useState(getBasicPreferences);
  const [timetable, setTimetable] = useState(getTimetablePreferences);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [pdfPreviewType, setPdfPreviewType] = useState<'class' | 'master'>('class');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classDepartmentId, setClassDepartmentId] = useState('');
  const [classCounts, setClassCounts] = useState<Record<number, number>>({ 1: 1, 2: 1, 3: 1, 4: 1 });
  const [classCycle, setClassCycle] = useState<'odd' | 'even' | 'both'>('both');
  const [savingClassSetup, setSavingClassSetup] = useState(false);
  const { user } = useAuth();
  const canManageWorkspace = user?.role === 'super_admin' || user?.role === 'hod';
  const strength = Math.min(4, (newPassword.length >= 8 ? 1 : 0) + (/[A-Z]/.test(newPassword) ? 1 : 0) + (/\d/.test(newPassword) ? 1 : 0) + (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0));
  const savedSnapshot = useRef(JSON.stringify({ cycle, basic, timetable }));
  const currentSnapshot = JSON.stringify({ cycle, basic, timetable });
  const hasUnsavedChanges = currentSnapshot !== savedSnapshot.current;

  const settingsSections = [
    { id: 'settings-overview', label: 'Overview', terms: 'overview status health summary' },
    { id: 'college-details-heading', label: 'Institution', terms: 'college institution name code affiliation principal email website address language time format logo branding' },
    { id: 'academic-settings-heading', label: 'Academic', terms: 'academic year semester odd even cycle' },
    { id: 'schedule-structure-heading', label: 'Schedule', terms: 'schedule period working days start duration break lunch weekly workload' },
    { id: 'class-settings-heading', label: 'Departments & Classes', terms: 'department class section year count' },
    { id: 'appearance-settings-heading', label: 'Appearance', terms: 'appearance theme light dark system' },
    { id: 'pdf-settings-heading', label: 'PDF & Export', terms: 'pdf export template footer title class master' },
    { id: 'account-security-heading', label: 'Account & Security', terms: 'account security password role email session' },
  ];
  const normalizedSearch = settingsSearch.trim().toLowerCase();
  const searchMatches = normalizedSearch ? settingsSections.filter(section => `${section.label} ${section.terms}`.toLowerCase().includes(normalizedSearch)) : [];
  const workingDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const scheduleWarnings = useMemo(() => {
    const warnings: { level: 'error' | 'warning' | 'info'; text: string }[] = [];
    const dayCount = timetable.workingDays.length;
    if (dayCount === 0) warnings.push({ level: 'error', text: 'Select at least one working day.' });
    if (timetable.periodsPerDay < 1 || timetable.periodsPerDay > 12) warnings.push({ level: 'error', text: 'Periods per day must be between 1 and 12.' });
    if (timetable.weeklyPeriodTarget > dayCount * timetable.periodsPerDay) warnings.push({ level: 'warning', text: `Weekly target (${timetable.weeklyPeriodTarget}) exceeds available slots (${dayCount * timetable.periodsPerDay}).` });
    if (timetable.lunchMinutes > 0 && (timetable.lunchAfterPeriod < 1 || timetable.lunchAfterPeriod >= timetable.periodsPerDay)) warnings.push({ level: 'warning', text: 'Lunch should be placed after a period that has a following period.' });
    if (timetable.intervalMinutes > 0 && (timetable.intervalAfterPeriod < 1 || timetable.intervalAfterPeriod >= timetable.periodsPerDay)) warnings.push({ level: 'warning', text: 'The short break should be placed after a period that has a following period.' });
    if (timetable.lunchMinutes > 0 && timetable.intervalMinutes > 0 && timetable.lunchAfterPeriod === timetable.intervalAfterPeriod) warnings.push({ level: 'info', text: 'Lunch and the short break are both set after the same period.' });
    if (warnings.length === 0) warnings.push({ level: 'info', text: 'Schedule settings fit within the selected working days and periods.' });
    return warnings;
  }, [timetable]);
  const schedulePreview = useMemo(() => {
    const [startHour, startMinute] = timetable.dayStart.split(':').map(Number);
    let cursor = (Number.isFinite(startHour) ? startHour : 9) * 60 + (Number.isFinite(startMinute) ? startMinute : 0);
    const formatTime = (minutes: number) => {
      const hour = Math.floor(minutes / 60) % 24;
      const minute = minutes % 60;
      if (basic.timeFormat === '24-hour') return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const suffix = hour >= 12 ? 'PM' : 'AM';
      return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
    };
    const rows: { label: string; start: string; end: string; kind: 'period' | 'break' | 'lunch' }[] = [];
    for (let period = 1; period <= Math.max(1, Math.min(12, timetable.periodsPerDay)); period += 1) {
      const start = cursor;
      cursor += timetable.periodMinutes;
      rows.push({ label: `Period ${period}`, start: formatTime(start), end: formatTime(cursor), kind: 'period' });
      if (period === timetable.intervalAfterPeriod && timetable.intervalMinutes > 0) {
        const breakStart = cursor; cursor += timetable.intervalMinutes;
        rows.push({ label: 'Short break', start: formatTime(breakStart), end: formatTime(cursor), kind: 'break' });
      }
      if (period === timetable.lunchAfterPeriod && timetable.lunchMinutes > 0) {
        const lunchStart = cursor; cursor += timetable.lunchMinutes;
        rows.push({ label: 'Lunch', start: formatTime(lunchStart), end: formatTime(cursor), kind: 'lunch' });
      }
    }
    return rows;
  }, [timetable, basic.timeFormat]);
  const configuredClasses = useMemo(() => classes.filter(item => item.department_id === classDepartmentId && (classCycle === 'both' || item.semester % 2 === (classCycle === 'odd' ? 1 : 0))), [classes, classDepartmentId, classCycle]);
  const sectionSummary = useMemo(() => [1, 2, 3, 4].map(year => ({ year, sections: [...new Set(configuredClasses.filter(item => item.year === year).map(item => String(item.section).toUpperCase()))].sort() })), [configuredClasses]);
  const healthChecks = [
    { label: 'Institution profile', ok: Boolean(basic.institutionName.trim() && basic.collegeCode.trim()), id: 'college-details-heading' },
    { label: 'Academic configuration', ok: Boolean(basic.academicYear && cycle), id: 'academic-settings-heading' },
    { label: 'Schedule structure', ok: timetable.workingDays.length > 0 && timetable.periodsPerDay > 0, id: 'schedule-structure-heading' },
    { label: 'PDF configuration', ok: Boolean(timetable.pdfTitle.trim() && timetable.timetablePdfTemplate), id: 'pdf-settings-heading' },
    { label: 'Class configuration', ok: classes.length > 0, id: 'class-settings-heading' },
    { label: 'Faculty assignments', ok: classes.some(item => (item.subjects || []).some((subject: any) => subject.faculty_id)), id: 'class-settings-heading' },
  ];

  useEffect(() => {
    api.settings.get().then((saved: any) => {
      if (saved?.basic) { setBasic(saved.basic); setBasicPreferences(saved.basic); }
      if (saved?.timetable) { setTimetable(saved.timetable); setTimetablePreferences(saved.timetable); }
      if (saved?.defaultSemesterCycle) { setCycle(saved.defaultSemesterCycle); setDefaultSemesterCycle(saved.defaultSemesterCycle); }
      savedSnapshot.current = JSON.stringify({ cycle: saved?.defaultSemesterCycle || cycle, basic: saved?.basic || basic, timetable: saved?.timetable || timetable });
    }).catch(() => toast.error('Could not load saved workspace settings'));
  }, []);

  useEffect(() => {
    Promise.all([api.departments.list(), api.classes.list()]).then(([departmentData, classData]: any[]) => {
      const depts = (departmentData || []).filter((item: any) => item.department_type !== 'lab');
      setDepartments(depts);
      setClasses(classData || []);
      if (depts.length > 0 && !classDepartmentId) {
        setClassDepartmentId(depts[0].id);
      }
    }).catch(() => toast.error('Could not load department class details'));
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const confirmNavigation = (event: MouseEvent) => {
      if (!hasUnsavedChanges || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank') return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname) return;
      if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', confirmNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', confirmNavigation, true);
    };
  }, [hasUnsavedChanges]);

  const resetUnsavedChanges = () => {
    if (!hasUnsavedChanges || !window.confirm('Discard your unsaved changes?')) return;
    try {
      const saved = JSON.parse(savedSnapshot.current);
      setCycle(saved.cycle); setBasic(saved.basic); setTimetable(saved.timetable);
      setDefaultSemesterCycle(saved.cycle); setBasicPreferences(saved.basic); setTimetablePreferences(saved.timetable);
      toast.success('Unsaved changes discarded');
    } catch { toast.error('Could not restore the last saved settings'); }
  };

  const selectedClassDepartment = departments.find(item => item.id === classDepartmentId);
  const syncClassCountsFromSaved = (departmentId: string, cycleValue: 'odd' | 'even' | 'both', classRows: any[]) => {
    const savedCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const item of classRows) {
      if (item.department_id !== departmentId || (cycleValue !== 'both' && item.semester % 2 !== (cycleValue === 'odd' ? 1 : 0))) continue;
      const sectionCount = item.section ? item.section.toUpperCase().charCodeAt(0) - 64 : 1;
      if (sectionCount > (savedCounts[item.year] || 0)) savedCounts[item.year] = sectionCount;
    }
    setClassCounts(Object.fromEntries([1, 2, 3, 4].map(year => [year, savedCounts[year]])) as Record<number, number>);
  };
  useEffect(() => {
    if (!classDepartmentId || savingClassSetup) return;
    syncClassCountsFromSaved(classDepartmentId, classCycle, classes);
    // Counts are intentionally reloaded only when the department or cycle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classDepartmentId, classCycle]);

  const saveClassSetup = async () => {
    if (!selectedClassDepartment) { toast.error('Choose a department first'); return; }
    setSavingClassSetup(true);
    try {
      const requestedCounts = Object.fromEntries([1, 2, 3, 4].map(year => [year, Math.max(0, Math.min(26, classCounts[year] || 0))])) as Record<number, number>;
      let setupResult: any = await api.classes.configure({ department_id: classDepartmentId, semester_cycle: classCycle, sections_by_year: requestedCounts });
      if (setupResult.confirmation_required) {
        const removals = (setupResult.classes_to_remove || [])
          .map((item: any) => `Year ${item.year}, Semester ${item.semester}, Section ${item.section}`)
          .join('\n');
        const confirmed = window.confirm(`Reducing section counts will permanently remove these classes, their subject assignments, and generated timetable entries:\n\n${removals}\n\nContinue?`);
        if (!confirmed) {
          toast('Class settings were not changed.');
          return;
        }
        setupResult = await api.classes.configure({ department_id: classDepartmentId, semester_cycle: classCycle, sections_by_year: requestedCounts, confirm_removals: true });
      }
      const refreshed: any = await api.classes.list();
      setClasses(refreshed || []);
      syncClassCountsFromSaved(classDepartmentId, classCycle, refreshed || []);
      const cycleDescription = classCycle === 'both' ? 'Both Odd & Even semesters (Sem 1 to 8)' : `${classCycle} semesters`;
      toast.success(`Saved ${selectedClassDepartment.code} class setup for ${cycleDescription}. Added ${setupResult.classes_created} sections and removed ${setupResult.classes_removed || 0}.`);
    } catch (error: any) { toast.error(error.message || 'Could not save class setup'); }
    finally { setSavingClassSetup(false); }
  };

  const save = async () => {
    if (!basic.institutionName.trim()) { toast.error('Enter the institution name before saving'); return; }
    if (!basic.collegeCode.trim()) { toast.error('Enter the college code before saving'); return; }
    if (basic.officialEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basic.officialEmail)) { toast.error('Enter a valid official email address'); return; }
    if (basic.website) { try { const website = new URL(basic.website); if (!['http:', 'https:'].includes(website.protocol)) throw new Error(); } catch { toast.error('Enter a valid website URL starting with http:// or https://'); return; } }
    setSavingSettings(true);
    try {
      await api.settings.save({ defaultSemesterCycle: cycle, basic, timetable });
      setDefaultSemesterCycle(cycle); setBasicPreferences(basic); setTimetablePreferences(timetable);
      savedSnapshot.current = JSON.stringify({ cycle, basic, timetable });
      setSavedAt(new Date().toLocaleString());
      toast.success('Settings saved to your workspace');
    } catch (error: any) { toast.error(error.message || 'Could not save settings'); }
    finally { setSavingSettings(false); }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    setChangingPassword(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Could not change password');
    } finally { setChangingPassword(false); }
  };

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div><span className="settings-eyebrow"><Settings2 size={14} /> SEC SCHEDX ADMINISTRATION</span><h1>Settings</h1><p>Workspace Configuration Center</p><small>Manage institution information, academic rules, timetable structure, appearance, exports, and account security.</small></div>
        <div className="settings-hero-status"><span className="status-dot" /> System configuration active{savedAt && <small>Last saved: {savedAt}</small>}</div>
      </header>
      <div className="settings-toolbar">
        <div className={`unsaved-state ${hasUnsavedChanges ? 'is-dirty' : 'is-saved'}`} aria-live="polite">{hasUnsavedChanges ? <><span className="status-dot" /> Unsaved changes</> : <><CheckCircle2 size={16} /> {savedAt ? 'All changes saved' : 'Current settings loaded'}</>}</div>
        <div className="settings-toolbar-actions"><button type="button" className="btn btn-secondary" onClick={resetUnsavedChanges} disabled={!hasUnsavedChanges || savingSettings}><RotateCcw size={16} /> Reset unsaved changes</button>{canManageWorkspace && <button type="button" className="btn btn-primary" onClick={save} disabled={savingSettings || !hasUnsavedChanges}><Save size={16} /> {savingSettings ? 'Saving settings…' : 'Save changes'}</button>}</div>
      </div>
      <div className="settings-search-wrap"><label htmlFor="settings-search"><Search size={18} /><span className="sr-only">Search settings</span><input id="settings-search" className="form-input" value={settingsSearch} onChange={event => setSettingsSearch(event.target.value)} placeholder="Search settings: periods, breaks, theme, PDF, password…" /></label>{normalizedSearch && <div className="settings-search-results" role="listbox" aria-label="Matching settings">{searchMatches.length ? searchMatches.map(section => <button type="button" role="option" aria-selected={false} key={section.id} onClick={() => { document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setSettingsSearch(''); }}><Search size={14} />{section.label}<ArrowRight size={14} /></button>) : <span>No matching settings sections</span>}</div>}</div>
      {!canManageWorkspace && <p className="settings-readonly-note"><ShieldCheck size={17} /> Workspace defaults are read-only for your role. You can still manage your account and password below.</p>}
      <div className="settings-workspace-layout">
      <nav className="settings-section-nav" aria-label="Settings sections"><strong>SETTINGS</strong>{settingsSections.map(section => <a href={`#${section.id}`} key={section.id}>{section.label}</a>)}</nav>
      <main className="settings-sections">
      <section className="settings-overview" id="settings-overview" aria-labelledby="settings-overview-title"><div className="overview-heading"><div><span className="settings-eyebrow">WORKSPACE SNAPSHOT</span><h2 id="settings-overview-title">Configuration overview</h2></div><span className="overview-role"><ShieldCheck size={15} /> {user?.role?.replace('_', ' ') || 'Signed in'}</span></div><div className="settings-overview-grid">
        <article><Building2 /><small>Institution</small><strong>{basic.institutionName || 'Not set'}</strong></article>
        <article><CalendarDays /><small>Academic year</small><strong>{basic.academicYear || 'Not set'}</strong></article>
        <article><CalendarDays /><small>Semester cycle</small><strong>{cycle === 'odd' ? 'Odd semester' : 'Even semester'}</strong></article>
        <article><Clock3 /><small>Working days</small><strong>{timetable.workingDays.map(day => workingDayNames[day - 1]?.slice(0, 3)).filter(Boolean).join(', ') || 'Not set'}</strong></article>
        <article><Clock3 /><small>Periods per day</small><strong>{timetable.periodsPerDay} / day</strong></article>
        <article><GraduationCap /><small>Weekly teaching target</small><strong>{timetable.weeklyPeriodTarget} periods</strong></article>
        <article><FileText /><small>Class PDF template</small><strong>{timetable.timetablePdfTemplate}</strong></article>
        <article><UserRound /><small>Account role</small><strong>{user?.role?.replace('_', ' ') || 'Loading'}</strong></article>
      </div><div className="configuration-health"><div><h3>Configuration health</h3><p>Based on the settings and records currently loaded in this workspace.</p></div><div className="health-check-grid">{healthChecks.map(check => <a key={check.label} href={`#${check.id}`} className={check.ok ? 'health-ok' : 'health-review'}><span>{check.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{check.label}</span><strong>{check.ok ? 'Configured' : 'Review'}</strong></a>)}</div></div></section>
      <fieldset className="workspace-settings-fieldset" disabled={!canManageWorkspace} aria-label="Workspace settings">
      <section className="settings-card basic-settings" id="settings-institution" aria-labelledby="college-details-heading">
        <div className="settings-heading"><Building2 size={22} /><div><h2 id="college-details-heading">College details</h2><p>Set the college information and display preferences used across SEC SchedX.</p></div></div>
        <div className="basic-settings-grid">
          <div className="settings-group-label">Institution identity</div>
          <label><span><Building2 size={15} /> College name</span><input className="form-input" value={basic.institutionName} maxLength={80} onChange={event => setBasic(value => ({ ...value, institutionName: event.target.value }))} placeholder="Enter college name" /></label>
          <label><span><Badge size={15} /> College code</span><input className="form-input" value={basic.collegeCode} maxLength={20} onChange={event => setBasic(value => ({ ...value, collegeCode: event.target.value.toUpperCase() }))} placeholder="Example: 1234" /></label>
          <label><span><GraduationCap size={15} /> University / affiliation</span><input className="form-input" value={basic.affiliation} maxLength={120} onChange={event => setBasic(value => ({ ...value, affiliation: event.target.value }))} placeholder="Affiliated university or board" /></label>
          <div className="settings-group-label">Administration</div>
          <label><span><UserRound size={15} /> Principal name</span><input className="form-input" value={basic.principalName} maxLength={80} onChange={event => setBasic(value => ({ ...value, principalName: event.target.value }))} placeholder="Principal's full name" /></label>
          <label><span><Mail size={15} /> Official email</span><input className="form-input" type="email" value={basic.officialEmail} maxLength={120} onChange={event => setBasic(value => ({ ...value, officialEmail: event.target.value }))} placeholder="office@college.edu" /></label>
          <label><span><Globe2 size={15} /> Website</span><input className="form-input" type="url" value={basic.website} maxLength={160} onChange={event => setBasic(value => ({ ...value, website: event.target.value }))} placeholder="https://www.college.edu" /></label>
          <div className="settings-group-label">Academic information</div>
          <label><span><CalendarDays size={15} /> Academic year</span><input className="form-input" value={basic.academicYear} maxLength={9} onChange={event => setBasic(value => ({ ...value, academicYear: event.target.value }))} placeholder="2026-2027" /></label>
          <label><span><Languages size={15} /> Language</span><select className="form-input" value={basic.language} onChange={event => setBasic(value => ({ ...value, language: event.target.value as 'English' }))}><option>English</option></select></label>
          <label><span><Clock3 size={15} /> Time format</span><select className="form-input" value={basic.timeFormat} onChange={event => setBasic(value => ({ ...value, timeFormat: event.target.value as '12-hour' | '24-hour' }))}><option value="12-hour">12-hour (9:00 AM)</option><option value="24-hour">24-hour (09:00)</option></select></label>
          <div className="settings-group-label">Contact information</div>
          <label className="college-address-field"><span><MapPin size={15} /> College address</span><textarea className="form-input" rows={3} value={basic.address} maxLength={300} onChange={event => setBasic(value => ({ ...value, address: event.target.value }))} placeholder="Full postal address" /></label>
        </div>
      </section>
      <section className="settings-card" id="settings-appearance" aria-labelledby="appearance-settings-heading">
        <div className="settings-heading"><Sun size={22} /><div><h2 id="appearance-settings-heading">Appearance</h2><p>Choose how SEC SchedX looks on this device.</p></div></div>
        <fieldset className="theme-options"><legend>Color theme</legend>
          {([
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Professional dark', icon: Moon },
            { value: 'system', label: 'System', icon: Laptop },
          ] as const).map(({ value, label, icon: Icon }) => <button type="button" className={basic.theme === value ? 'selected' : ''} aria-pressed={basic.theme === value} key={value} onClick={() => { setBasic(current => ({ ...current, theme: value as ColorTheme })); applyTheme(value); }}><Icon size={18} /><span>{label}</span>{basic.theme === value && <Check size={15} />}</button>)}
        </fieldset>
        <div className="theme-preview" data-preview-theme={basic.theme}><strong>Theme preview</strong><div className="theme-preview-sample"><span>SEC SchedX</span><span>Settings cards</span><button type="button" tabIndex={-1}>Action button</button></div><small>Preview of the selected {basic.theme === 'dark' ? 'professional dark' : basic.theme} theme. Changes apply to this screen while editing and persist when saved.</small></div>
      </section>
      <section className="settings-card" id="settings-academic" aria-labelledby="academic-settings-heading">
        <div className="settings-heading"><CalendarDays size={22} /><div><h2 id="academic-settings-heading">Academic settings</h2><p>This selection will be used by timetable, generation, and faculty schedule screens.</p></div></div>
        <fieldset className="semester-options"><legend>Default semester type</legend>
          {(['odd', 'even'] as SemesterCycle[]).map(value => <label className={`semester-option ${cycle === value ? 'selected' : ''}`} key={value}><input type="radio" name="semester-cycle" value={value} checked={cycle === value} onChange={() => setCycle(value)} /><span className="radio-mark">{cycle === value && <Check size={15} />}</span><span><strong>{value === 'odd' ? 'Odd Semester' : 'Even Semester'}</strong><small>{value === 'odd' ? 'Semesters 1, 3, 5 and 7' : 'Semesters 2, 4, 6 and 8'}</small></span></label>)}
        </fieldset>
      </section>
      <section className="settings-card" id="settings-classes" aria-labelledby="class-settings-heading">
        <div className="settings-heading"><Users size={22} /><div><h2 id="class-settings-heading">Class settings</h2><p>Review departments and set how many sections each department needs by year. Sections are created from Year 4 down to Year 1.</p></div></div>
        <div className="timetable-settings-grid">
          <label><span>Department ({departments.length} available)</span><select className="form-input" value={classDepartmentId} onChange={event => setClassDepartmentId(event.target.value)}><option value="">Choose a department</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
          <label><span>Semester cycle</span><select className="form-input" value={classCycle} onChange={event => setClassCycle(event.target.value as 'odd' | 'even' | 'both')}><option value="both">Both odd and even</option><option value="odd">Odd semester</option><option value="even">Even semester</option></select></label>
        </div>
        {selectedClassDepartment && <div className="class-config-summary"><div className="class-config-summary-head"><div><strong>{selectedClassDepartment.name}</strong><small>{selectedClassDepartment.code} · {selectedClassDepartment.department_type || 'Department'} · {classCycle === 'both' ? 'Odd & even semesters' : `${classCycle} semesters`}</small></div><span>{new Set(configuredClasses.map(item => `${item.year}-${item.section}`)).size} sections</span></div><div className="class-year-summary">{sectionSummary.map(row => <div key={row.year}><span>Year {row.year}</span><div>{row.sections.length ? row.sections.map(section => <i key={section}>{section}</i>) : <small>No saved sections</small>}</div></div>)}</div><p className="class-settings-warning"><AlertTriangle size={16} /> Changing section counts may remove dependent class, subject allocation, and timetable records. Removals require confirmation.</p></div>}
        {selectedClassDepartment && (
          <>
            <div className="timetable-settings-grid">
              {[4, 3, 2, 1].map(year => (
                <label key={year}>
                  <span>Year {year} sections (A, B, C…)</span>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="26"
                    value={classCounts[year]}
                    onChange={event => setClassCounts(current => ({ ...current, [year]: Number(event.target.value) }))}
                  />
                </label>
              ))}
            </div>
            <p style={{ color: '#64748b', margin: '8px 0 14px' }}>
              {configuredClasses.length} saved classes in {selectedClassDepartment.code}. You can increase or decrease these counts; reducing a count asks for confirmation and removes affected class assignments and timetables.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={saveClassSetup}
                disabled={savingClassSetup}
              >
                {savingClassSetup ? 'Saving class setup…' : 'Save class setup (Year 4 → Year 1)'}
              </button>
              <Link
                href={`/subjects?department_id=${classDepartmentId}&department_type=${selectedClassDepartment.department_type || 'department'}`}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontWeight: 700 }}
              >
                <BookOpen size={16} />
                <span>Go to Curriculum &amp; Subjects ({selectedClassDepartment.code})</span>
                <ArrowRight size={16} />
              </Link>
            </div>

            <div style={{ marginTop: 18, padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <strong style={{ color: '#166534', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} /> Subject &amp; Faculty Navigation Active
                  </strong>
                  <p style={{ color: '#15803d', fontSize: '0.82rem', margin: '3px 0 0' }}>
                    {classCycle === 'both'
                      ? `Both odd and even semesters (Sem 1 to 8) are selected for ${selectedClassDepartment.name}. Navigate directly to Curriculum & Subjects to assign courses and faculty.`
                      : `${classCycle === 'odd' ? 'Odd' : 'Even'} semesters selected for ${selectedClassDepartment.name}. Navigate to Curriculum & Subjects to assign courses and faculty.`}
                  </p>
                </div>
                <Link
                  href={`/subjects?department_id=${classDepartmentId}&department_type=${selectedClassDepartment.department_type || 'department'}`}
                  style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'underline' }}
                >
                  Open {selectedClassDepartment.code} Subjects →
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
      <section className="settings-card" id="settings-schedule" aria-labelledby="schedule-structure-heading">
        <div className="settings-heading"><Clock3 size={22} /><div><h2 id="schedule-structure-heading">College period details &amp; schedule structure</h2><p>Set weekly teaching periods, daily periods, period length, and break times.</p></div></div>
        <div className="settings-subsection-title">Daily schedule</div>
        <div className="timetable-settings-grid">
          <label><span>Periods per day</span><input className="form-input" type="number" min="1" max="12" value={timetable.periodsPerDay} onChange={event => setTimetable(value => ({ ...value, periodsPerDay: Number(event.target.value), lunchAfterPeriod: Math.min(value.lunchAfterPeriod, Number(event.target.value)), intervalAfterPeriod: Math.min(value.intervalAfterPeriod, Number(event.target.value)) }))} /></label>
        </div>
        <fieldset className="working-days"><legend>Working days</legend>{['Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => { const number = index + 1; const active = timetable.workingDays.includes(number); return <button type="button" className={active ? 'active' : ''} aria-pressed={active} key={day} onClick={() => setTimetable(value => ({ ...value, workingDays: active ? value.workingDays.filter(item => item !== number) : [...value.workingDays, number].sort(), weeklyPeriodTarget: active ? Math.max(value.workingDays.length - 1, 0) * value.periodsPerDay : (value.workingDays.length + 1) * value.periodsPerDay }))}>{active && <Check size={14} />}{day}</button>; })}</fieldset>
        <div className="timetable-settings-grid">
          <label><span>College start time</span><input className="form-input" type="time" value={timetable.dayStart} onChange={event => setTimetable(value => ({ ...value, dayStart: event.target.value }))} /></label>
          <label><span>Period duration</span><select className="form-input" value={timetable.periodMinutes} onChange={event => setTimetable(value => ({ ...value, periodMinutes: Number(event.target.value) }))}><option value="45">45 minutes</option><option value="50">50 minutes</option><option value="60">60 minutes</option></select></label>
        </div>
        <div className="settings-subsection-title">Break structure</div>
        <div className="timetable-settings-grid">
          <label><span>Lunch after period</span><input className="form-input" type="number" min="1" max={timetable.periodsPerDay} value={timetable.lunchAfterPeriod} onChange={event => setTimetable(value => ({ ...value, lunchAfterPeriod: Number(event.target.value) }))} /></label>
          <label><span>Lunch duration</span><input className="form-input" type="number" min="0" max="120" value={timetable.lunchMinutes} onChange={event => setTimetable(value => ({ ...value, lunchMinutes: Number(event.target.value) }))} /></label>
          <label><span>Short break after period</span><input className="form-input" type="number" min="0" max={timetable.periodsPerDay} value={timetable.intervalAfterPeriod} onChange={event => setTimetable(value => ({ ...value, intervalAfterPeriod: Number(event.target.value) }))} /></label>
          <label><span>Short break duration</span><input className="form-input" type="number" min="0" max="60" value={timetable.intervalMinutes} onChange={event => setTimetable(value => ({ ...value, intervalMinutes: Number(event.target.value) }))} /></label>
        </div>
        <div className="settings-subsection-title">Workload</div><div className="timetable-settings-grid"><label><span>Teaching periods per week <small className="field-help">Expected total teaching periods. Available slots depend on working days × periods per day.</small></span><input className="form-input" type="number" min="1" max="60" value={timetable.weeklyPeriodTarget} onChange={event => setTimetable(value => ({ ...value, weeklyPeriodTarget: Number(event.target.value) }))} /></label></div>
        <div className="schedule-preview"><div className="schedule-preview-heading"><div><h3>Live daily schedule</h3><p>Updates as you change the start time, period length, and breaks.</p></div><span>{timetable.workingDays.length} working days · {timetable.periodsPerDay} periods</span></div><div className="schedule-preview-list">{schedulePreview.map((row, index) => <div className={`schedule-preview-row ${row.kind}`} key={`${row.label}-${index}`}><span className="schedule-time">{row.start}<i />{row.end}</span><strong>{row.label}</strong><span className="schedule-kind">{row.kind === 'period' ? 'Teaching' : row.kind === 'lunch' ? 'Meal break' : 'Break'}</span></div>)}</div></div>
        <div className="schedule-validation" aria-live="polite">{scheduleWarnings.map((warning, index) => <div className={`validation-${warning.level}`} key={`${warning.level}-${index}`}><span>{warning.level.toUpperCase()}</span>{warning.text}</div>)}</div>
      </section>
      <section className="settings-card" id="settings-pdf" aria-labelledby="pdf-settings-heading">
        <div className="settings-heading"><FileText size={22} /><div><h2 id="pdf-settings-heading">PDF templates &amp; export settings</h2><p>Choose default layouts for class and master timetable PDF exports.</p></div></div>
        <div className="timetable-settings-grid"><label><span>PDF document title</span><input className="form-input" maxLength={80} value={timetable.pdfTitle} onChange={event => setTimetable(value => ({ ...value, pdfTitle: event.target.value }))} /></label><label className="inline-check"><input type="checkbox" checked={timetable.includeInstitutionName} onChange={event => setTimetable(value => ({ ...value, includeInstitutionName: event.target.checked }))} /><span>Include institution name in exports</span></label></div>
        <div className="timetable-settings-grid">
          <label><span>Default class timetable PDF</span><select className="form-input" value={timetable.timetablePdfTemplate} onChange={event => setTimetable(value => ({ ...value, timetablePdfTemplate: event.target.value as typeof value.pdfTemplate }))}><option value="modern">Modern</option><option value="classic">Classic</option><option value="minimal">Minimal</option></select></label>
          <label><span>Default master timetable PDF</span><select className="form-input" value={timetable.masterPdfTemplate} onChange={event => setTimetable(value => ({ ...value, masterPdfTemplate: event.target.value as typeof value.pdfTemplate }))}><option value="modern">Modern</option><option value="classic">Classic</option><option value="minimal">Minimal</option></select></label>
        </div>
        <div className="settings-group-label" style={{ marginTop: 'var(--space-6)' }}>Timetable layout orientation</div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
          Controls how the timetable is displayed on screen and in PDF exports. Switch between <strong>Horizontal</strong> (periods across columns, days as rows) and <strong>Vertical</strong> (days across columns, periods as rows).
        </p>
        <fieldset className="theme-options" style={{ gap: 'var(--space-3)' }}>
          <legend>Layout orientation</legend>
          {([
            { value: 'horizontal' as TimetableOrientation, label: 'Horizontal', desc: 'Days → columns, Periods → rows', Icon: Table2 },
            { value: 'vertical' as TimetableOrientation, label: 'Vertical', desc: 'Periods → columns, Days → rows', Icon: LayoutList },
          ]).map(({ value, label, desc, Icon }) => (
            <button
              type="button"
              key={value}
              className={timetable.timetableOrientation === value ? 'selected' : ''}
              aria-pressed={timetable.timetableOrientation === value}
              onClick={() => setTimetable(current => ({ ...current, timetableOrientation: value }))}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 24px', minWidth: 160 }}
            >
              <Icon size={22} />
              <span style={{ fontWeight: 600 }}>{label}</span>
              <small style={{ fontWeight: 400, opacity: 0.75, fontSize: '0.72rem' }}>{desc}</small>
              {timetable.timetableOrientation === value && <Check size={14} />}
            </button>
          ))}
        </fieldset>
        <Link href="/settings/pdf-template" className="template-page-link"><span><FileText size={19} /><span><strong>PDF template designer</strong><small>Choose the layout, color, header, and footer used for every export.</small></span></span><ArrowRight size={18} /></Link>
        <div className="pdf-settings-preview"><div className="pdf-settings-preview-toolbar"><div><h3>Export preview</h3><p>Preview uses your current institution, title, footer, and selected export style.</p></div><div role="group" aria-label="Choose PDF preview type"><button type="button" aria-pressed={pdfPreviewType === 'class'} className={pdfPreviewType === 'class' ? 'active' : ''} onClick={() => setPdfPreviewType('class')}>Class PDF</button><button type="button" aria-pressed={pdfPreviewType === 'master'} className={pdfPreviewType === 'master' ? 'active' : ''} onClick={() => setPdfPreviewType('master')}>Master PDF</button></div></div><div className={`settings-pdf-sheet ${pdfPreviewType === 'class' ? timetable.timetablePdfTemplate : timetable.masterPdfTemplate}`}><header>{timetable.includeInstitutionName && <strong>{basic.institutionName || 'Institution name not set'}</strong>}<h4>{timetable.pdfTitle || 'Timetable'}</h4><small>{pdfPreviewType === 'class' ? 'Class timetable' : 'Master timetable'} · {basic.academicYear}</small></header><table><thead><tr><th>Day</th>{Array.from({ length: Math.min(timetable.periodsPerDay, 6) }, (_, index) => <th key={index}>P{index + 1}</th>)}</tr></thead><tbody>{timetable.workingDays.slice(0, 3).map(day => <tr key={day}><th>{workingDayNames[day - 1]?.slice(0, 3)}</th>{Array.from({ length: Math.min(timetable.periodsPerDay, 6) }, (_, index) => <td key={index}>{index % 2 === 0 ? 'Subject' : '—'}<small>{index % 2 === 0 ? 'Faculty' : ''}</small></td>)}</tr>)}</tbody></table><footer>{timetable.pdfFooter}</footer></div></div>
      </section>
      </fieldset>
      <section className="settings-card account-security" id="settings-account" aria-labelledby="account-security-heading">
        <div className="settings-heading"><ShieldCheck size={22} /><div><h2 id="account-security-heading">Account &amp; Security</h2><p>Review your signed-in account and securely update its password.</p></div></div>
        <div className="account-summary"><div className="account-summary-icon"><UserRound size={22} /></div><div><strong>{user?.full_name || 'Current account'}</strong><span>{user?.email}</span><small>Account status · {user ? 'Active session' : 'Loading account'}</small></div><span className="role-badge">{user?.role.replace('_', ' ') || 'Account'}</span></div>
        <div className="security-status"><span><CheckCircle2 size={15} /> Password configured</span><span><CheckCircle2 size={15} /> Session active</span></div>
        <form className="password-form" onSubmit={changePassword}>
          <h3><KeyRound size={17} /> Change password</h3>
          <div className="password-grid">
            <label><span>Current password</span><span className="password-input"><input className="form-input" type={showCurrent ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /><button type="button" onClick={() => setShowCurrent(value => !value)} aria-label={showCurrent ? 'Hide current password' : 'Show current password'}>{showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            <label><span>New password</span><span className="password-input"><input className="form-input" type={showNew ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required /><button type="button" onClick={() => setShowNew(value => !value)} aria-label={showNew ? 'Hide new password' : 'Show new password'}>{showNew ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><span className="password-strength" aria-label={`Password strength ${strength} out of 4`}>{[1,2,3,4].map(level => <i className={strength >= level ? `on level-${strength}` : ''} key={level} />)}</span><small>{strength < 3 ? 'Use 8+ characters, uppercase, a number and a symbol' : strength === 3 ? 'Strong password' : 'Excellent password'}</small></label>
            <label><span>Confirm new password</span><input className="form-input" type={showNew ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /><small className={confirmPassword && confirmPassword !== newPassword ? 'field-error' : 'field-success'}>{confirmPassword ? (confirmPassword === newPassword ? 'Passwords match' : 'Passwords do not match') : 'Re-enter your new password'}</small></label>
          </div>
          <button className="btn btn-secondary" type="submit" disabled={changingPassword}>{changingPassword ? 'Updating…' : 'Update password'}</button>
        </form>
      </section>
      {canManageWorkspace && <div className="settings-actions settings-save"><p>Preferences are saved to the SEC SchedX backend and cached in this browser.</p><button type="button" className="btn btn-primary" onClick={save} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save all settings'}</button></div>}
      </main>
      </div>
    </div>
  );
}
