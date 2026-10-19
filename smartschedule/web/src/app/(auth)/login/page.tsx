'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LoaderCircle, Lock, Mail, Sparkles } from 'lucide-react';
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

  return (
    <main className="login-shell">
      {/* Left brand panel */}
      <section className="login-brand">
        <div className="login-brand-logo">
          <div className="brand-mark login-brand-mark"><Sparkles size={22} /></div>
          <span className="login-brand-name">SEC SchedX</span>
        </div>
        <p className="login-brand-tag">Academic scheduling system</p>
        <p className="login-brand-sub">AI &amp; DS · Sudharsan Engineering College</p>
        <h1 className="login-brand-headline">Build reliable timetables<br />without scheduling conflicts.</h1>
        <p className="login-brand-body">Manage departments, faculty, subjects, and classes in one focused workspace powered by constraint optimization.</p>
        <div className="login-feature-pills">
          {['Conflict checks', 'Faculty schedules', 'Automatic generation', 'PDF export'].map(item => (
            <span key={item} className="login-pill">{item}</span>
          ))}
        </div>
      </section>

      {/* Right sign-in panel */}
      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-card-title">Welcome back</h2>
            <p className="login-card-sub">Sign in to manage your institution timetable.</p>
          </div>

          {error && (
            <div id="login-error" role="alert" aria-live="assertive" className="alert alert-error login-alert">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="login-email" className="form-label login-label">
                <Mail size={14} aria-hidden="true" /> Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="form-input login-input"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                disabled={loading}
                autoComplete="username"
                autoFocus
                aria-describedby={error ? 'login-error' : undefined}
                placeholder="you@sec.edu"
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password" className="form-label login-label">
                <Lock size={14} aria-hidden="true" /> Password
              </label>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input login-input"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  aria-describedby={error ? 'login-error' : undefined}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(value => !value)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <><LoaderCircle size={16} className="login-spinner" aria-hidden="true" /> Signing in&hellip;</>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {process.env.NODE_ENV === 'development' && (
            <p className="login-dev-hint">
              Demo credentials are created by the local database seed script.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
