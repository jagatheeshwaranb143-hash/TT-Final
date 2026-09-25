'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen, Building2, CalendarDays, ChevronLeft, GraduationCap,
  Info, Settings,
  LayoutDashboard, LoaderCircle, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Sparkles, Table2, Users, WandSparkles, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['super_admin', 'hod', 'faculty', 'student'] },
  { href: '/departments', label: 'Departments', icon: Building2, roles: ['super_admin', 'hod'] },
  { href: '/faculty', label: 'Faculty', icon: Users, roles: ['super_admin', 'hod', 'faculty'] },
  { href: '/subjects', label: 'Subjects', icon: BookOpen, roles: ['super_admin', 'hod'] },
  { href: '/classes', label: 'Classes', icon: GraduationCap, roles: ['super_admin', 'hod'] },
  { href: '/timetable/generate', label: 'Generate', icon: WandSparkles, roles: ['super_admin', 'hod'] },
  { href: '/timetable', label: 'Timetable', icon: CalendarDays, roles: ['super_admin', 'hod', 'faculty', 'student'] },
  { href: '/timetable/master', label: 'Master', icon: Table2, roles: ['super_admin', 'hod'] },
  { href: '/about', label: 'About', icon: Info, roles: ['super_admin', 'hod', 'faculty', 'student'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'hod', 'faculty', 'student'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading || user) return;
    const fallback = window.setTimeout(() => window.location.replace('/login'), 5000);
    return () => window.clearTimeout(fallback);
  }, [isLoading, user]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (isLoading || !user) {
    return (
      <div className="app-loading" role="status" aria-live="polite" aria-atomic="true">
        <LoaderCircle className="session-spinner" size={28} aria-hidden="true" />
        <div className="loading-copy">
          <strong>Checking your session</strong>
          <span>You will be redirected to sign in if needed.</span>
        </div>
      </div>
    );
  }

  const visibleLinks = links.filter(link => link.roles.includes(user.role));
  const activeHref = visibleLinks
    .filter(link => link.href === '/dashboard'
      ? ['/dashboard', '/principal', '/hod', '/student'].includes(pathname)
      : pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
  const crumbs = pathname.split('/').filter(Boolean);

  const sidebar = (
    <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-mark"><Sparkles size={19} /></div>
        {!collapsed && <div><strong>SEC SchedX</strong><span>Academic scheduling system</span><small>AI &amp; DS · Sudharsan Engineering College</small></div>}
        <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {!collapsed && <p className="nav-eyebrow">Workspace</p>}
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <Link className={`sidebar-link ${active ? 'active' : ''}`} key={href} href={href} title={collapsed ? label : undefined} aria-label={label} aria-current={active ? 'page' : undefined} onClick={() => setMobileOpen(false)}>
              <Icon size={19} strokeWidth={1.9} />
              {!collapsed && <span>{label}</span>}
              {active && <i aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-account">
        <div className="account-avatar">{user.full_name.slice(0, 1).toUpperCase()}</div>
        {!collapsed && <div className="account-copy"><strong>{user.full_name}</strong><span>{user.role.replace('_', ' ')}</span></div>}
        <button className="icon-button dark" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
      </div>
    </aside>
  );

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {sidebar}
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
      <div className="app-main">
        <header className="app-header">
          <button className="icon-button desktop-toggle" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button className="icon-button mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/dashboard"><ChevronLeft size={15} /> Workspace</Link>
            {crumbs.map(part => <span key={part}>/ {part.replaceAll('-', ' ')}</span>)}
          </div>
          <div className="header-status" role="status" aria-label="System status: online"><span aria-hidden="true" /> System online</div>
        </header>
        <main className="app-content" id="main-content">{children}</main>
      </div>
    </div>
  );
}
