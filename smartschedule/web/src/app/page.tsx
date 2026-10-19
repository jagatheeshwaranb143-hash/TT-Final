'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    const roleRoutes: Record<string, string> = {
      super_admin: '/principal',
      hod: '/hod',
      faculty: '/faculty',
      student: '/student',
    };
    router.replace(roleRoutes[user.role] || '/login');
  }, [user, isLoading, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      gap: '1.5rem',
    }}>
      {/* Logo mark */}
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 40px rgba(37,99,235,0.4)',
        animation: 'splashPulse 2s ease-in-out infinite',
        fontSize: '2rem',
        fontWeight: 800,
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '-2px',
      }}>
        SX
      </div>

      {/* App name */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#f8fafc',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '-0.03em',
        }}>
          SEC SchedX
        </div>
        <div style={{
          fontSize: '0.8rem',
          color: '#94a3b8',
          marginTop: '0.25rem',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Intelligent Timetable System
        </div>
      </div>

      {/* Spinner */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: '#2563eb',
        animation: 'splashSpin 0.8s linear infinite',
      }} />

      <style>{`
        @keyframes splashSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes splashPulse {
          0%, 100% { box-shadow: 0 0 40px rgba(37,99,235,0.4); transform: scale(1); }
          50% { box-shadow: 0 0 60px rgba(37,99,235,0.7); transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
