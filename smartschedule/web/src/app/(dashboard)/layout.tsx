'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: 'H' },
  { href: '/departments', label: 'Departments', icon: 'D' },
  { href: '/faculty', label: 'Faculty', icon: 'F' },
  { href: '/subjects', label: 'Subjects', icon: 'S' },
  { href: '/classes', label: 'Classes', icon: 'C' },
  { href: '/timetable/generate', label: 'Generate Timetable', icon: 'G' },
  { href: '/timetable', label: 'View Timetable', icon: 'T' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="loading-screen">Loading SmartSchedule...</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-family)' }}>
      <aside style={{ width: sidebarOpen ? 260 : 76, background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)', color: 'white', transition: 'width .2s ease', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', boxShadow: '4px 0 24px rgba(15,23,42,.08)', zIndex: 10 }}>
        <div style={{ padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(148,163,184,.14)' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', fontWeight: 800, boxShadow: '0 6px 16px rgba(37,99,235,.3)', flexShrink: 0 }}>S</div>
          {sidebarOpen && <strong style={{ fontSize: 16, letterSpacing: '-.01em' }}>SmartSchedule</strong>}
        </div>
        <nav style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map(link => {
            const active = link.href === '/dashboard' ? ['/dashboard', '/principal'].includes(pathname) : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 9, background: active ? 'rgba(59,130,246,.16)' : 'transparent', color: active ? '#f8fafc' : '#a8b3c5', textDecoration: 'none', fontSize: 14, fontWeight: active ? 600 : 500, border: active ? '1px solid rgba(96,165,250,.16)' : '1px solid transparent', transition: 'all .15s ease' }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 700, fontSize: 11, background: active ? '#2563eb' : 'rgba(148,163,184,.1)', color: active ? '#fff' : '#94a3b8', flexShrink: 0 }}>{link.icon}</span>
                {sidebarOpen && link.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: 16, borderTop: '1px solid rgba(148,163,184,.14)' }}>
          {sidebarOpen && <><div style={{ fontSize: 14, fontWeight: 600 }}>{user.full_name}</div><div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10, textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</div></>}
          <button onClick={logout} style={{ width: '100%', padding: '9px 10px', color: '#cbd5e1', background: 'rgba(148,163,184,.1)', border: '1px solid rgba(148,163,184,.12)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Sign out</button>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)' }}>
        <header style={{ height: 68, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', position: 'sticky', top: 0, zIndex: 5 }}>
          <button onClick={() => setSidebarOpen(value => !value)} aria-label="Toggle navigation" style={{ width: 36, height: 36, border: '1px solid var(--color-border)', borderRadius: 9, background: '#fff', color: '#475569', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>☰</button>
          <span style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>{pathname.split('/').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join(' / ') || 'Dashboard'}</span>
        </header>
        {children}
      </main>
    </div>
  );
}
