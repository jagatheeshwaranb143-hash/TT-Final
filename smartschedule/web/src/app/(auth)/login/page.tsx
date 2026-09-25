'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/principal');
    } catch (reason: any) {
      setError(reason.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1',
    borderRadius: 9, color: '#0f172a', background: 'white', outline: 'none',
  } as const;

  return (
    <main className="login-shell" style={{ minHeight: '100vh', background: '#f4f7f6' }}>
      <section className="login-brand" style={{ background: 'linear-gradient(145deg, #0f172a 0%, #134e4a 65%, #0f766e 100%)', color: 'white', padding: 'clamp(32px, 7vw, 96px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: '#14b8a6', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800 }}>S</div>
          <span style={{ fontSize: 23, fontWeight: 750, letterSpacing: '-.02em' }}>SEC SchedX</span>
        </div>
        <p style={{ color: '#99f6e4', fontSize: 14, fontWeight: 600, letterSpacing: '.01em', marginBottom: 6 }}>Academic scheduling system</p>
        <p style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 800, letterSpacing: '.01em', marginBottom: 14 }}>AI &amp; DS · Sudharsan Engineering College</p>
        <h1 style={{ color: 'white', fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.08, letterSpacing: '-.045em', maxWidth: 700, marginBottom: 22 }}>Build reliable timetables without scheduling conflicts.</h1>
        <p style={{ maxWidth: 610, color: '#cbd5e1', fontSize: 18, lineHeight: 1.7 }}>Manage departments, faculty, subjects, and classes in one focused workspace powered by constraint optimization.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 36 }}>
          {['Conflict checks', 'Faculty schedules', 'Automatic generation'].map(item => <span key={item} style={{ padding: '8px 12px', border: '1px solid rgba(153,246,228,.25)', borderRadius: 999, background: 'rgba(20,184,166,.1)', color: '#ccfbf1', fontSize: 13 }}>{item}</span>)}
        </div>
      </section>

      <section style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
        <div style={{ width: '100%', maxWidth: 430, background: 'white', border: '1px solid #dce5e3', borderRadius: 18, padding: 'clamp(26px, 5vw, 42px)', boxShadow: '0 22px 55px rgba(15, 23, 42, .10)' }}>
          <h2 style={{ color: '#0f172a', fontSize: 30, letterSpacing: '-.03em', marginBottom: 8 }}>Welcome back</h2>
          <p style={{ color: '#64748b', marginBottom: 28 }}>Sign in to manage your institution timetable.</p>

          {error && <div id="login-error" role="alert" aria-live="assertive" style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '11px 13px', borderRadius: 9, marginBottom: 18, fontSize: 14 }}>{error}</div>}

          <form onSubmit={submit}>
            <label htmlFor="login-email" style={{ display: 'block', color: '#334155', fontSize: 14, fontWeight: 650, marginBottom: 7 }}>Email address</label>
            <input id="login-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={loading} autoComplete="username" autoFocus aria-describedby={error ? 'login-error' : undefined} style={{ ...inputStyle, marginBottom: 18 }} />

            <label htmlFor="login-password" style={{ display: 'block', color: '#334155', fontSize: 14, fontWeight: 650, marginBottom: 7 }}>Password</label>
            <div style={{ position: 'relative', marginBottom: 22 }}>
              <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required disabled={loading} autoComplete="current-password" aria-describedby={error ? 'login-error' : undefined} style={{ ...inputStyle, paddingRight: 70 }} />
              <button type="button" aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)} style={{ position: 'absolute', right: 9, top: 8, padding: '5px 8px', border: 0, background: 'transparent', color: '#0f766e', cursor: 'pointer', fontSize: 13, fontWeight: 650 }}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, borderRadius: 9, border: 0, background: loading ? '#5eead4' : '#0f766e', color: 'white', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', boxShadow: '0 8px 18px rgba(15,118,110,.2)' }}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>

          {process.env.NODE_ENV === 'development' && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 13, lineHeight: 1.7 }}>
              Demo credentials are created by the local database seed script.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
