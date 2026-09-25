const apiBase = process.env.API_URL || 'http://127.0.0.1:8000/api/v1';
const webBase = process.env.WEB_URL || 'http://localhost:3000';
let token = '';
let originalSettings;
const departmentIds = [];

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}
const post = value => ({ method: 'POST', body: JSON.stringify(value) });

try {
  token = (await request('/auth/login', post({ email: 'admin@smartschedule.dev', password: 'admin123' }))).access_token;
  originalSettings = await request('/settings');
  const suffix = Date.now().toString().slice(-7);
  const home = await request('/departments', post({ name: `E2E Home ${suffix}`, code: `H${suffix}` }));
  const shared = await request('/departments', post({ name: `E2E Shared ${suffix}`, code: `S${suffix}` }));
  departmentIds.push(home.id, shared.id);

  const basil = await request('/faculty', post({ name: `Basil ${suffix}`, department_id: home.id, can_teach_all_classes: true }));
  const createClassAssignment = async (department, code) => {
    const subject = await request('/subjects', post({ name: `${code} Scheduling`, code: `${code}${suffix}`, department_id: department.id, year: 1, semester: 1, type: 'theory', periods_per_week: 2, lab_block_size: 1 }));
    const classItem = await request('/classes', post({ department_id: department.id, year: 1, semester: 1, section: code }));
    await request(`/classes/${classItem.id}/subjects`, post([{ subject_id: subject.id, faculty_id: basil.id }]));
    return classItem;
  };
  const homeClass = await createClassAssignment(home, 'HOME');
  const sharedClass = await createClassAssignment(shared, 'SHARED');

  await request('/settings', { method: 'PUT', body: JSON.stringify({ ...originalSettings, timetable: { ...originalSettings.timetable, workingDays: [1, 2], periodsPerDay: 4 } }) });
  await request('/timetable/generate', post({ department_id: home.id, semester: 1, reference_semesters: [] }));
  await request('/timetable/generate', post({ department_id: shared.id, semester: 1, reference_semesters: [] }));
  const [homeEntries, sharedEntries] = await Promise.all([request(`/timetable/class/${homeClass.id}`), request(`/timetable/class/${sharedClass.id}`)]);
  const homeSlots = new Set(homeEntries.map(entry => `${entry.day}:${entry.period}`));
  if (sharedEntries.some(entry => homeSlots.has(`${entry.day}:${entry.period}`))) throw new Error('Basil was double-booked across departments');

  const editTarget = sharedEntries[0];
  const occupied = new Set([...homeEntries, ...sharedEntries.slice(1)].map(entry => `${entry.day}:${entry.period}`));
  const candidate = [0, 1].flatMap(day => [1, 2, 3, 4].map(period => ({ day, period }))).find(slot => !occupied.has(`${slot.day}:${slot.period}`));
  if (!candidate) throw new Error('No safe slot available for the manual-edit test');
  await request(`/timetable/entry/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(candidate) });

  const workflowResponse = await fetch(`${apiBase}/workflow/versions`, { headers: { Authorization: `Bearer ${token}` } });
  if (workflowResponse.status !== 404) throw new Error(`Removed workflow API returned ${workflowResponse.status}, expected 404`);
  const pages = await Promise.all(['/settings', '/settings/pdf-template', '/timetable'].map(path => fetch(`${webBase}${path}`)));
  if (!pages.every(response => response.ok)) throw new Error('One or more active web routes failed');
  console.log('E2E passed: cross-department Basil scheduling, safe manual edit, Settings pages, and disabled workflow API');
} finally {
  if (token && originalSettings) await request('/settings', { method: 'PUT', body: JSON.stringify(originalSettings) }).catch(() => {});
  for (const id of departmentIds.reverse()) await request(`/departments/${id}`, { method: 'DELETE' }).catch(() => {});
}
