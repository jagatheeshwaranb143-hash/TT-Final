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
    throw new Error(error.detail || error.message || `Request failed with status ${response.status}`);
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
    assignSubjects: (id: string, data: unknown) => request(`/classes/${id}/subjects`, { method: 'POST', body: JSON.stringify(data) }),
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
    master: (departmentId?: string) => request(`/timetable/master${departmentId ? `?department_id=${departmentId}` : ''}`),
    status: (jobId: string) => request(`/timetable/status/${jobId}`),
    classTimetable: (classId: string) => request(`/timetable/class/${classId}`),
    editEntry: (entryId: string, data: unknown) => request(`/timetable/entry/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
    createEntry: (data: unknown) => request('/timetable/entry', { method: 'POST', body: JSON.stringify(data) }),
    deleteEntry: (entryId: string) => request(`/timetable/entry/${entryId}`, { method: 'DELETE' }),
    facultyTimetable: (facultyId: string, semesterCycle?: 'odd' | 'even') => request(`/timetable/faculty/${facultyId}${semesterCycle ? `?semester_cycle=${semesterCycle}` : ''}`),
    unassigned: () => request('/timetable/unassigned'),
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
  deptSetup: {
    departmentsSummary: () => request('/dept-setup/departments-summary'),
    get: (deptId: string, yearLevel: number, semesterId?: string) =>
      request(`/dept-setup/${deptId}/${yearLevel}${semesterId ? `?semester_id=${semesterId}` : ''}`),
    save: (data: unknown) => request('/dept-setup/save', { method: 'POST', body: JSON.stringify(data) }),
    generate: (data: unknown) => request('/dept-setup/generate', { method: 'POST', body: JSON.stringify(data) }),
  },
};
