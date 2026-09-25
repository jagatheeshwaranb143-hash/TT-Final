'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Badge, Building2, CalendarDays, Check, Clock3, Eye, EyeOff, FileText, Globe2, GraduationCap, KeyRound, Languages, Laptop, Mail, MapPin, Moon, Settings2, ShieldCheck, Sun, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { applyTheme, ColorTheme, getBasicPreferences, getDefaultSemesterCycle, getTimetablePreferences, SemesterCycle, setBasicPreferences, setDefaultSemesterCycle, setTimetablePreferences } from '@/lib/preferences';
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
  const { user } = useAuth();
  const canManageWorkspace = user?.role === 'super_admin' || user?.role === 'hod';
  const strength = Math.min(4, (newPassword.length >= 8 ? 1 : 0) + (/[A-Z]/.test(newPassword) ? 1 : 0) + (/\d/.test(newPassword) ? 1 : 0) + (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0));

  useEffect(() => {
    api.settings.get().then((saved: any) => {
      if (saved?.basic) { setBasic(saved.basic); setBasicPreferences(saved.basic); }
      if (saved?.timetable) { setTimetable(saved.timetable); setTimetablePreferences(saved.timetable); }
      if (saved?.defaultSemesterCycle) { setCycle(saved.defaultSemesterCycle); setDefaultSemesterCycle(saved.defaultSemesterCycle); }
    }).catch(() => toast.error('Could not load saved workspace settings'));
  }, []);

  const save = async () => {
    setSavingSettings(true);
    try {
      await api.settings.save({ defaultSemesterCycle: cycle, basic, timetable });
      setDefaultSemesterCycle(cycle); setBasicPreferences(basic); setTimetablePreferences(timetable);
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
      <header className="page-title"><div className="info-icon"><Settings2 size={25} /></div><div><h1>Settings</h1><p>Choose the basic defaults used across your SEC SchedX workspace.</p></div></header>
      {!canManageWorkspace && <p className="settings-readonly-note"><ShieldCheck size={17} /> Workspace defaults are read-only for your role. You can still manage your account and password below.</p>}
      <fieldset className="workspace-settings-fieldset" disabled={!canManageWorkspace} aria-label="Workspace settings">
      <section className="settings-card basic-settings" aria-labelledby="college-details-heading">
        <div className="settings-heading"><Building2 size={22} /><div><h2 id="college-details-heading">College details</h2><p>Set the college information and display preferences used across SEC SchedX.</p></div></div>
        <div className="basic-settings-grid">
          <label><span><Building2 size={15} /> College name</span><input className="form-input" value={basic.institutionName} maxLength={80} onChange={event => setBasic(value => ({ ...value, institutionName: event.target.value }))} placeholder="Enter college name" /></label>
          <label><span><Badge size={15} /> College code</span><input className="form-input" value={basic.collegeCode} maxLength={20} onChange={event => setBasic(value => ({ ...value, collegeCode: event.target.value.toUpperCase() }))} placeholder="Example: 1234" /></label>
          <label><span><GraduationCap size={15} /> University / affiliation</span><input className="form-input" value={basic.affiliation} maxLength={120} onChange={event => setBasic(value => ({ ...value, affiliation: event.target.value }))} placeholder="Affiliated university or board" /></label>
          <label><span><UserRound size={15} /> Principal name</span><input className="form-input" value={basic.principalName} maxLength={80} onChange={event => setBasic(value => ({ ...value, principalName: event.target.value }))} placeholder="Principal's full name" /></label>
          <label><span><Mail size={15} /> Official email</span><input className="form-input" type="email" value={basic.officialEmail} maxLength={120} onChange={event => setBasic(value => ({ ...value, officialEmail: event.target.value }))} placeholder="office@college.edu" /></label>
          <label><span><Globe2 size={15} /> Website</span><input className="form-input" type="url" value={basic.website} maxLength={160} onChange={event => setBasic(value => ({ ...value, website: event.target.value }))} placeholder="https://www.college.edu" /></label>
          <label><span><CalendarDays size={15} /> Academic year</span><select className="form-input" value={basic.academicYear} onChange={event => setBasic(value => ({ ...value, academicYear: event.target.value }))}><option>2025-2026</option><option>2026-2027</option><option>2027-2028</option></select></label>
          <label className="college-address-field"><span><MapPin size={15} /> College address</span><textarea className="form-input" rows={3} value={basic.address} maxLength={300} onChange={event => setBasic(value => ({ ...value, address: event.target.value }))} placeholder="Full postal address" /></label>
          <label><span><Languages size={15} /> Language</span><select className="form-input" value={basic.language} onChange={event => setBasic(value => ({ ...value, language: event.target.value as 'English' }))}><option>English</option></select></label>
          <label><span><Clock3 size={15} /> Time format</span><select className="form-input" value={basic.timeFormat} onChange={event => setBasic(value => ({ ...value, timeFormat: event.target.value as '12-hour' | '24-hour' }))}><option value="12-hour">12-hour (9:00 AM)</option><option value="24-hour">24-hour (09:00)</option></select></label>
        </div>
      </section>
      <section className="settings-card" aria-labelledby="appearance-settings-heading">
        <div className="settings-heading"><Sun size={22} /><div><h2 id="appearance-settings-heading">Appearance</h2><p>Choose how SEC SchedX looks on this device.</p></div></div>
        <fieldset className="theme-options"><legend>Color theme</legend>
          {([
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Professional dark', icon: Moon },
            { value: 'system', label: 'System', icon: Laptop },
          ] as const).map(({ value, label, icon: Icon }) => <button type="button" className={basic.theme === value ? 'selected' : ''} aria-pressed={basic.theme === value} key={value} onClick={() => { setBasic(current => { const updated = { ...current, theme: value as ColorTheme }; setBasicPreferences(updated); return updated; }); applyTheme(value); }}><Icon size={18} /><span>{label}</span>{basic.theme === value && <Check size={15} />}</button>)}
        </fieldset>
      </section>
      <section className="settings-card" aria-labelledby="academic-settings-heading">
        <div className="settings-heading"><CalendarDays size={22} /><div><h2 id="academic-settings-heading">Academic settings</h2><p>This selection will be used by timetable, generation, and faculty schedule screens.</p></div></div>
        <fieldset className="semester-options"><legend>Default semester type</legend>
          {(['odd', 'even'] as SemesterCycle[]).map(value => <label className={`semester-option ${cycle === value ? 'selected' : ''}`} key={value}><input type="radio" name="semester-cycle" value={value} checked={cycle === value} onChange={() => setCycle(value)} /><span className="radio-mark">{cycle === value && <Check size={15} />}</span><span><strong>{value === 'odd' ? 'Odd Semester' : 'Even Semester'}</strong><small>{value === 'odd' ? 'Semesters 1, 3, 5 and 7' : 'Semesters 2, 4, 6 and 8'}</small></span></label>)}
        </fieldset>
      </section>
      <section className="settings-card" aria-labelledby="schedule-structure-heading">
        <div className="settings-heading"><Clock3 size={22} /><div><h2 id="schedule-structure-heading">Schedule structure</h2><p>Define the normal teaching week and daily timetable layout.</p></div></div>
        <fieldset className="working-days"><legend>Working days</legend>{['Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => { const number = index + 1; const active = timetable.workingDays.includes(number); return <button type="button" className={active ? 'active' : ''} aria-pressed={active} key={day} onClick={() => setTimetable(value => ({ ...value, workingDays: active ? value.workingDays.filter(item => item !== number) : [...value.workingDays, number].sort() }))}>{active && <Check size={14} />}{day}</button>; })}</fieldset>
        <div className="timetable-settings-grid">
          <label><span>Periods per day</span><input className="form-input" type="number" min="1" max="12" value={timetable.periodsPerDay} onChange={event => setTimetable(value => ({ ...value, periodsPerDay: Number(event.target.value) }))} /></label>
          <label><span>College start time</span><input className="form-input" type="time" value={timetable.dayStart} onChange={event => setTimetable(value => ({ ...value, dayStart: event.target.value }))} /></label>
          <label><span>Period duration</span><select className="form-input" value={timetable.periodMinutes} onChange={event => setTimetable(value => ({ ...value, periodMinutes: Number(event.target.value) }))}><option value="45">45 minutes</option><option value="50">50 minutes</option><option value="60">60 minutes</option></select></label>
          <label><span>Lunch after period</span><input className="form-input" type="number" min="1" max={timetable.periodsPerDay} value={timetable.lunchAfterPeriod} onChange={event => setTimetable(value => ({ ...value, lunchAfterPeriod: Number(event.target.value) }))} /></label>
        </div>
      </section>
      <section className="settings-card" aria-labelledby="pdf-settings-heading">
        <div className="settings-heading"><FileText size={22} /><div><h2 id="pdf-settings-heading">PDF &amp; export branding</h2><p>Customize the heading used for official timetable exports.</p></div></div>
        <div className="timetable-settings-grid"><label><span>PDF document title</span><input className="form-input" maxLength={80} value={timetable.pdfTitle} onChange={event => setTimetable(value => ({ ...value, pdfTitle: event.target.value }))} /></label><label className="inline-check"><input type="checkbox" checked={timetable.includeInstitutionName} onChange={event => setTimetable(value => ({ ...value, includeInstitutionName: event.target.checked }))} /><span>Include institution name in exports</span></label></div>
        <Link href="/settings/pdf-template" className="template-page-link"><span><FileText size={19} /><span><strong>PDF template designer</strong><small>Choose the layout, color, header, and footer used for every export.</small></span></span><ArrowRight size={18} /></Link>
      </section>
      </fieldset>
      <section className="settings-card account-security" aria-labelledby="account-security-heading">
        <div className="settings-heading"><ShieldCheck size={22} /><div><h2 id="account-security-heading">Account &amp; Security</h2><p>Review your signed-in account and securely update its password.</p></div></div>
        <div className="account-summary"><div className="account-summary-icon"><UserRound size={22} /></div><div><strong>{user?.full_name}</strong><span>{user?.email}</span></div><span className="role-badge">{user?.role.replace('_', ' ')}</span></div>
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
    </div>
  );
}
