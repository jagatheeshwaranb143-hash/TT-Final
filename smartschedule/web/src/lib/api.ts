// The local backend binds to IPv4 explicitly. Using "localhost" can resolve to
// IPv6 (::1) on Windows and produces a browser-level "Failed to fetch" error.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

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
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot connect to the timetable server. Check that the backend is running on port 8000.');
  }
  if (response.status === 401) {
    localStorage.removeItem('smartschedule_token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    const detail = Array.isArray(error.detail)
      ? error.detail.map((item: any) => `${Array.isArray(item.loc) ? item.loc.slice(1).join('.') : 'Request'}: ${item.msg || 'Invalid value'}`).join('; ')
      : error.detail;
    throw new Error(detail || error.message || `Request failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  settings: {
    get: () => request('/settings'),
    save: (data: unknown) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    importTemplateStructure: async (file: File) => {
      const token = getToken();
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`${API_BASE}/api/v1/settings/template-structure`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.detail || 'Could not import timetable structure'); }
      return response.json();
    },
  },
  setup: {
    status: () => request('/users/setup-status'),
  },
  departments: {
    list: () => request('/departments'),
    create: (data: unknown) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/departments/${id}`),
    update: (id: string, data: unknown) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/departments/${id}`, { method: 'DELETE' }),
    programs: (id: string) => request(`/departments/${id}/programs`),
    createProgram: (id: string, data: unknown) => request(`/departments/${id}/programs`, { method: 'POST', body: JSON.stringify(data) }),
  },
  faculty: {
    list: (params?: Record<string, string>) => request(`/faculty?${new URLSearchParams(params).toString()}`),
    create: (data: unknown) => request('/faculty', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/faculty/${id}`),
    update: (id: string, data: unknown) => request(`/faculty/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/faculty/${id}`, { method: 'DELETE' }),
    timetable: (id: string) => request(`/faculty/${id}/timetable`),
    workload: (id: string) => request(`/faculty/${id}/workload`),
    subjects: (id: string) => request(`/faculty/${id}/subjects`),
    assignSubject: (id: string, data: unknown) => request(`/faculty/${id}/subjects`, { method: 'PUT', body: JSON.stringify(data) }),
    availability: (id: string) => request(`/faculty/${id}/availability`),
    setAvailability: (id: string, data: unknown) => request(`/faculty/${id}/availability`, { method: 'POST', body: JSON.stringify(data) }),
  },
  subjects: {
    list: (params?: Record<string, string>) => request(`/subjects?${new URLSearchParams(params).toString()}`),
    create: (data: unknown) => request('/subjects', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/subjects/${id}`),
    update: (id: string, data: unknown) => request(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/subjects/${id}`, { method: 'DELETE' }),
    types: () => request('/subjects/types'),
  },
  classes: {
    list: (params?: Record<string, string>) => request(`/classes?${new URLSearchParams(params).toString()}`),
    create: (data: unknown) => request('/classes', { method: 'POST', body: JSON.stringify(data) }),
    configure: (data: unknown) => request('/classes/setup', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/classes/${id}`),
    update: (id: string, data: unknown) => request(`/classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/classes/${id}`, { method: 'DELETE' }),
    assignSubjects: (id: string, data: unknown) => request(`/classes/${id}/subjects`, { method: 'POST', body: JSON.stringify(data) }),
  },
  timetable: {
    validateData: (deptId: string, semId: string, yearId: string) => request(`/timetable/validate-data?department_id=${deptId}&semester_id=${semId}&academic_year_id=${yearId}`),
    generate: (data: unknown) => request('/timetable/generate', { method: 'POST', body: JSON.stringify(data) }),
    master: (departmentId?: string) => request(`/timetable/master${departmentId ? `?department_id=${departmentId}` : ''}`),
    status: (jobId: string) => request(`/timetable/status/${jobId}`),
    classTimetable: (classId: string) => request(`/timetable/class/${classId}`),
    editEntry: (entryId: string, data: unknown) => request(`/timetable/entry/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
    createEntry: (data: unknown) => request('/timetable/entry', { method: 'POST', body: JSON.stringify(data) }),
    deleteEntry: (entryId: string) => request(`/timetable/entry/${entryId}`, { method: 'DELETE' }),
    clearClass: (classId: string) => request(`/timetable/class/${classId}/entries`, { method: 'DELETE' }),
    facultyTimetable: (facultyId: string, semesterCycle?: 'odd' | 'even') => request(`/timetable/faculty/${facultyId}${semesterCycle ? `?semester_cycle=${semesterCycle}` : ''}`),
    unassigned: () => request('/timetable/unassigned'),
    validateMove: (data: unknown) => request('/timetable/validate-move', { method: 'POST', body: JSON.stringify(data) }),
    simulate: (data: unknown) => request('/timetable/simulate', { method: 'POST', body: JSON.stringify(data) }),
  },
  editor: {
    move: (data: unknown) => request('/timetable/editor/move', { method: 'POST', body: JSON.stringify(data) }),
    swap: (data: unknown) => request('/timetable/editor/swap', { method: 'POST', body: JSON.stringify(data) }),
    lock: (id: string) => request(`/timetable/editor/lock/${id}`, { method: 'POST' }),
    unlock: (id: string) => request(`/timetable/editor/unlock/${id}`, { method: 'POST' }),
  },
  dashboard: {
    getPrincipalStats: () => request('/analytics/principal-stats'),
    getHodStats: () => request('/analytics/workload-stats'),
  },
  analytics: {
    workload: (deptId?: string) => request(`/analytics/workload-stats${deptId ? `?department_id=${deptId}` : ''}`),
    roomUtilization: () => request('/analytics/room-utilization'),
    qualityHistory: () => request('/analytics/quality-trends'),
    conflicts: () => request('/analytics/conflict-trends'),
  },
  search: (q: string, type = 'all') => request(`/search?q=${encodeURIComponent(q)}&type=${type}`),
  ai: {
    query: (question: string) => request('/ai/query', { method: 'POST', body: JSON.stringify({ question }) }),
  },
  deptSetup: {
    departmentsSummary: () => request('/dept-setup/departments-summary'),
    get: (deptId: string, yearLevel: number, semesterId?: string) =>
      request(`/dept-setup/${deptId}/${yearLevel}${semesterId ? `?semester_id=${semesterId}` : ''}`),
    save: (data: unknown) => request('/dept-setup/save', { method: 'POST', body: JSON.stringify(data) }),
    generate: (data: unknown) => request('/dept-setup/generate', { method: 'POST', body: JSON.stringify(data) }),
  },
};
