import os

base_dir = r"c:\Users\kisho\OneDrive\Desktop\TIMETABLEAI\smartschedule\web"

files = {
    "src/lib/api.ts": """const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('smartschedule_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('smartschedule_token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  setup: {
    status: () => request('/users/setup-status'),
  },
  colleges: {
    list: () => request('/colleges'),
    create: (data: unknown) => request('/colleges', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/colleges/${id}`),
    update: (id: string, data: unknown) => request(`/colleges/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  academicYears: {
    list: () => request('/academic-years'),
    create: (data: unknown) => request('/academic-years', { method: 'POST', body: JSON.stringify(data) }),
    semesters: (yearId: string) => request(`/academic-years/${yearId}/semesters`),
    createSemester: (yearId: string, data: unknown) => request(`/academic-years/${yearId}/semesters`, { method: 'POST', body: JSON.stringify(data) }),
  },
  departments: {
    list: () => request('/departments'),
    create: (data: unknown) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/departments/${id}`),
    update: (id: string, data: unknown) => request(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/departments/${id}`, { method: 'DELETE' }),
    programs: (id: string) => request(`/departments/${id}/programs`),
    createProgram: (id: string, data: unknown) => request(`/departments/${id}/programs`, { method: 'POST', body: JSON.stringify(data) }),
  },
  faculty: {
    list: (params?: Record<string, string>) => request(`/faculty?${new URLSearchParams(params).toString()}`),
    create: (data: unknown) => request('/faculty', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/faculty/${id}`),
    update: (id: string, data: unknown) => request(`/faculty/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/faculty/${id}`, { method: 'DELETE' }),
    timetable: (id: string) => request(`/faculty/${id}/timetable`),
    workload: (id: string) => request(`/faculty/${id}/workload`),
    subjects: (id: string) => request(`/faculty/${id}/subjects`),
    assignSubject: (id: string, data: unknown) => request(`/faculty/${id}/subjects`, { method: 'POST', body: JSON.stringify(data) }),
    availability: (id: string) => request(`/faculty/${id}/availability`),
    setAvailability: (id: string, data: unknown) => request(`/faculty/${id}/availability`, { method: 'POST', body: JSON.stringify(data) }),
  },
  subjects: {
    list: (params?: Record<string, string>) => request(`/subjects?${new URLSearchParams(params).toString()}`),
    create: (data: unknown) => request('/subjects', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/subjects/${id}`),
    update: (id: string, data: unknown) => request(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/subjects/${id}`, { method: 'DELETE' }),
    types: () => request('/subjects/types'),
  },
  rooms: {
    list: (params?: Record<string, string>) => request(`/rooms?${new URLSearchParams(params).toString()}`),
    create: (data: unknown) => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/rooms/${id}`),
    update: (id: string, data: unknown) => request(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/rooms/${id}`, { method: 'DELETE' }),
    buildings: () => request('/rooms/buildings'),
    types: () => request('/rooms/types'),
  },
  labs: {
    list: () => request('/laboratories'),
    create: (data: unknown) => request('/laboratories', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/laboratories/${id}`),
    update: (id: string, data: unknown) => request(`/laboratories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/laboratories/${id}`, { method: 'DELETE' }),
  },
  classes: {
    list: (params?: Record<string, string>) => request(`/classes?${new URLSearchParams(params).toString()}`),
    create: (data: unknown) => request('/classes', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/classes/${id}`),
    update: (id: string, data: unknown) => request(`/classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/classes/${id}`, { method: 'DELETE' }),
  },
  periods: {
    workingDays: () => request('/periods/working-days'),
    setWorkingDays: (data: unknown) => request('/periods/working-days', { method: 'POST', body: JSON.stringify(data) }),
    configurations: () => request('/periods/configurations'),
    createConfig: (data: unknown) => request('/periods/configurations', { method: 'POST', body: JSON.stringify(data) }),
    periods: (configId: string) => request(`/periods/configurations/${configId}/periods`),
    addPeriod: (configId: string, data: unknown) => request(`/periods/configurations/${configId}/periods`, { method: 'POST', body: JSON.stringify(data) }),
  },
  timetable: {
    validateData: (deptId: string, semId: string, yearId: string) => request(`/timetable/validate-data?department_id=${deptId}&semester_id=${semId}&academic_year_id=${yearId}`),
    generate: (data: unknown) => request('/timetable/generate', { method: 'POST', body: JSON.stringify(data) }),
    status: (jobId: string) => request(`/timetable/status/${jobId}`),
    classTimetable: (classId: string) => request(`/timetable/class/${classId}`),
    facultyTimetable: (facultyId: string) => request(`/timetable/faculty/${facultyId}`),
    validateMove: (data: unknown) => request('/timetable/validate-move', { method: 'POST', body: JSON.stringify(data) }),
    simulate: (data: unknown) => request('/timetable/simulate', { method: 'POST', body: JSON.stringify(data) }),
  },
  versions: {
    list: (params?: Record<string, string>) => request(`/versions?${new URLSearchParams(params).toString()}`),
    approveHod: (id: string, notes?: string) => request(`/versions/${id}/approve-hod`, { method: 'POST', body: JSON.stringify({ notes }) }),
    approvePrincipal: (id: string, notes?: string) => request(`/versions/${id}/approve-principal`, { method: 'POST', body: JSON.stringify({ notes }) }),
    validatePublish: (id: string) => request(`/versions/${id}/validate-publish`),
    publish: (id: string) => request(`/versions/${id}/publish`, { method: 'POST' }),
    lock: (id: string) => request(`/versions/${id}/lock`, { method: 'POST' }),
    compare: (aId: string, bId: string) => request(`/versions/${aId}/compare/${bId}`),
  },
  editor: {
    move: (data: unknown) => request('/timetable/editor/move', { method: 'POST', body: JSON.stringify(data) }),
    swap: (data: unknown) => request('/timetable/editor/swap', { method: 'POST', body: JSON.stringify(data) }),
    lock: (data: unknown) => request('/timetable/editor/lock', { method: 'POST', body: JSON.stringify(data) }),
    unlock: (data: unknown) => request('/timetable/editor/unlock', { method: 'POST', body: JSON.stringify(data) }),
  },
  reports: {
    class: (classId: string, format = 'excel') => `${API_BASE}/api/v1/reports/class/${classId}?format=${format}`,
    faculty: (facultyId: string, format = 'excel') => `${API_BASE}/api/v1/reports/faculty/${facultyId}?format=${format}`,
    workload: (format = 'excel') => `${API_BASE}/api/v1/reports/workload?format=${format}`,
  },
  analytics: {
    workload: (deptId?: string) => request(`/analytics/workload${deptId ? `?department_id=${deptId}` : ''}`),
    roomUtilization: () => request('/analytics/room-utilization'),
    qualityHistory: () => request('/analytics/quality-history'),
    conflicts: () => request('/analytics/conflicts'),
  },
  search: (q: string, type = 'all') => request(`/search?q=${encodeURIComponent(q)}&type=${type}`),
  notifications: {
    list: () => request('/notifications'),
    count: () => request('/notifications/count'),
    markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  },
  ai: {
    query: (question: string) => request('/ai/query', { method: 'POST', body: JSON.stringify({ question }) }),
  },
  import: {
    validate: (entityType: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      return fetch(`${API_BASE}/api/v1/import/validate?entity_type=${entityType}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(r => r.json());
    },
    confirm: (sessionToken: string) => request('/import/confirm', { method: 'POST', body: JSON.stringify({ session_token: sessionToken, confirmed: true }) }),
    templateUrl: (entityType: string) => `${API_BASE}/api/v1/import/template/${entityType}`,
  },
};""",

    "src/app/layout.tsx": """import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SmartSchedule | Intelligent College Timetable System',
  description: 'Production-ready college timetable management and intelligent scheduling system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </body>
    </html>
  );
}""",

    "src/app/page.tsx": """'use client';
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
  
  return <div className="loading-screen">Loading SmartSchedule...</div>;
}""",

    "src/app/(auth)/login/page.tsx": """'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Wait for AuthProvider to sync state and HomePage will redirect based on role
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout" style={{ minHeight: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem' }}>SmartSchedule</h1>
        <p style={{ fontSize: '1.25rem', opacity: 0.9 }}>Intelligent College Scheduling</p>
        <p style={{ fontSize: '1rem', opacity: 0.7, marginTop: '2rem', textAlign: 'center', maxWidth: '400px' }}>Trusted by academic institutions for conflict-free timetable management</p>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <form onSubmit={handleLogin} className="card" style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Login to your account</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} className="form-input" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>👁️</button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}""",

    "src/app/(dashboard)/layout.tsx": """'use client';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  
  if (!user) return null;
  
  const navItems = {
    super_admin: [
      { href: '/principal', label: 'Overview' },
      { href: '/departments', label: 'Departments' },
      { href: '/faculty', label: 'Faculty' },
      { href: '/subjects', label: 'Subjects' },
      { href: '/rooms', label: 'Rooms' },
      { href: '/laboratories', label: 'Labs' },
    ],
    hod: [
      { href: '/hod', label: 'Dashboard' },
    ],
    faculty: [
      { href: '/faculty', label: 'Dashboard' },
    ],
    student: [
      { href: '/student', label: 'Dashboard' },
    ]
  };

  const links = navItems[user.role] || [];

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div style={{ padding: '1.5rem', fontWeight: 700, fontSize: '1.25rem', borderBottom: '1px solid var(--color-border)' }}>SmartSchedule</div>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600 }}>{user.full_name}</div>
          <div className="badge badge-primary">{user.role}</div>
        </div>
        <nav style={{ padding: '1rem', flex: 1 }}>
          {links.map(link => (
            <Link key={link.href} href={link.href} className="nav-link">{link.label}</Link>
          ))}
        </nav>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={logout} className="btn btn-ghost" style={{ width: '100%' }}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="page-header">
          <div className="page-title">Dashboard</div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}""",

    "src/app/(dashboard)/principal/page.tsx": """'use client';
export default function PrincipalDashboard() {
  return (
    <div>
      <h1 className="page-title">Principal Dashboard</h1>
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-desc">Setup and connect to the API to view principal analytics.</div>
      </div>
    </div>
  );
}""",

    "src/app/(dashboard)/hod/page.tsx": """'use client';
export default function HodDashboard() {
  return (
    <div>
      <h1 className="page-title">HOD Dashboard</h1>
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-desc">Setup and connect to the API to view HOD analytics.</div>
      </div>
    </div>
  );
}""",

    "src/app/(dashboard)/faculty/page.tsx": """'use client';
export default function FacultyDashboard() {
  return (
    <div>
      <h1 className="page-title">Faculty Dashboard</h1>
      <div className="empty-state">
        <div className="empty-state-icon">🧑‍🏫</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-desc">Setup and connect to the API to view faculty timetable.</div>
      </div>
    </div>
  );
}""",

    "src/app/(dashboard)/student/page.tsx": """'use client';
export default function StudentDashboard() {
  return (
    <div>
      <h1 className="page-title">Student Dashboard</h1>
      <div className="empty-state">
        <div className="empty-state-icon">🎓</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-desc">Setup and connect to the API to view student timetable.</div>
      </div>
    </div>
  );
}""",
}

for path, content in files.items():
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Files generated.")
