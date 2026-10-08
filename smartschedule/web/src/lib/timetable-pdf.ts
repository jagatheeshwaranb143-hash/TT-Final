import { getBasicPreferences, getTimetablePreferences } from './preferences';

interface ExportOptions {
  title: string;
  subtitle?: string;
  entries: any[];
  periods: Array<{ number: number; label: string; start_time?: string; end_time?: string }>;
  templateDetails?: { subjects: any[]; departmentName: string };
  includeBreaks?: boolean;
  facultyDetails?: { name: string; departmentName: string; semesterCycle: string; subjects: any[] };
}

interface MasterDayExportOptions {
  title: string;
  subtitle?: string;
  dayName: string;
  classes: Array<{ id: string; label: string }>;
  entries: any[];
  periods: Array<{ number: number; label: string; start_time?: string; end_time?: string; time?: string }>;
  includeBreaks?: boolean;
}

interface MasterAllDaysExportOptions extends Omit<MasterDayExportOptions, 'dayName'> {
  days: Array<{ apiDay: number; label: string }>;
  includeBreaks?: boolean;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function exportTimetablePdf({ title, subtitle, entries, periods, templateDetails, includeBreaks = false, facultyDetails }: ExportOptions) {
  const preferences = getTimetablePreferences();
  preferences.pdfTemplate = preferences.timetablePdfTemplate;
  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) throw new Error('Allow pop-ups to export the timetable as PDF');
  const allDays = [
    { number: 1, name: 'Monday' }, { number: 2, name: 'Tuesday' },
    { number: 3, name: 'Wednesday' }, { number: 4, name: 'Thursday' },
    { number: 5, name: 'Friday' }, { number: 6, name: 'Saturday' },
  ];
  const days = allDays.filter(day => preferences.workingDays.includes(day.number));
  const savedColumns = preferences.pdfStructure?.columns?.length ? preferences.pdfStructure.columns : periods.flatMap(period => [
    { kind: 'period' as const, label: period.label },
    ...(period.number === preferences.intervalAfterPeriod && preferences.intervalMinutes > 0 ? [{ kind: 'break' as const, label: 'BREAK' }] : []),
    ...(period.number === preferences.lunchAfterPeriod && preferences.lunchMinutes > 0 ? [{ kind: 'lunch' as const, label: 'LUNCH' }] : []),
  ]);
  const configuredColumns = includeBreaks ? savedColumns : savedColumns.filter(column => column.kind === 'period');
  const structureColumns = configuredColumns.flatMap((column, index) => {
    const number = Number(column.label.match(/\d+/)?.[0]);
    if (column.kind !== 'period' || number !== 6) return [column];
    const next = configuredColumns[index + 1];
    return includeBreaks && next?.kind === 'break' ? [column] : includeBreaks ? [column, { kind: 'break' as const, label: 'BREAK' }] : [column];
  });
  let cursor = Number(preferences.dayStart.slice(0, 2)) * 60 + Number(preferences.dayStart.slice(3, 5));
  const periodTimes = new Map<number, string>();
  const formatTime = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  periods.forEach((period, index) => {
    const start = cursor;
    const end = start + preferences.periodMinutes;
    periodTimes.set(period.number, `${formatTime(start)}-${formatTime(end)}`);
    cursor = end;
    if (index + 1 === preferences.intervalAfterPeriod) cursor += preferences.intervalMinutes;
    if (index + 1 === preferences.lunchAfterPeriod) cursor += preferences.lunchMinutes;
  });
  const timeRow = `<tr class="time-row"><th>TIME</th>${structureColumns.map(column => {
    const number = Number(column.label.match(/\d+/)?.[0]) || structureColumns.filter(item => item.kind === 'period').indexOf(column) + 1;
    return `<th class="${column.kind !== 'period' ? 'break-cell' : ''}">${column.kind === 'period' ? periodTimes.get(number) || '' : ''}</th>`;
  }).join('')}</tr>`;
  const rows = days.map(day => `<tr><th>${day.name.slice(0, 3).toUpperCase()}</th>${structureColumns.map(column => {
    if (column.kind !== 'period') return `<td class="break-cell">${column.label}</td>`;
    const periodNumber = Number(column.label.match(/\d+/)?.[0]) || structureColumns.filter(item => item.kind === 'period').indexOf(column) + 1;
    const slotEntries = entries.filter(item => (item.day_of_week ?? item.day + 1) === day.number && (item.period_number ?? item.period) === periodNumber);
    return `<td>${slotEntries.map(entry => `<div class="slot-entry"><strong>${escapeHtml(entry.subject_name || 'Subject')}</strong><span>${escapeHtml(entry.teacher_name || entry.faculty_name || 'Faculty not assigned')}</span></div>`).join('')}</td>`;
  }).join('')}</tr>`).join('');
  const subjectTable = templateDetails ? `<table class="subject-detail-table"><thead><tr><th>S.NO</th><th>SUB-CODE</th><th>SUBJECT</th><th>CREDIT</th><th>FACULTY NAME</th><th>DESIGNATION &amp; DEPT.</th><th>NO. HRS/WEEK</th></tr></thead><tbody>${(['theory', 'lab'] as const).map(kind => {
    const subjects = templateDetails.subjects.filter(subject => (subject.subject_type === 'lab' ? 'lab' : 'theory') === kind);
    return `<tr class="subject-group"><th colspan="7">${kind === 'lab' ? 'PRACTICALS' : 'THEORY'}</th></tr>${subjects.map((subject, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(subject.subject_code)}</td><td>${escapeHtml(subject.subject_name)}</td><td>${escapeHtml(subject.credits ?? '-')}</td><td>${escapeHtml(subject.faculty_name || 'Not assigned')}</td><td>${escapeHtml(subject.faculty_department || templateDetails.departmentName || '-')}</td><td>${escapeHtml(subject.periods_per_week)}</td></tr>`).join('')}`;
  }).join('')}</tbody></table><table class="coordinator-table"><tbody><tr><th>${escapeHtml(preferences.pdfStructure?.coordinatorLabels?.[0] || 'CLASS COORDINATOR')}</th><td>${escapeHtml(preferences.pdfStructure?.signatories?.classCoordinator || '')}</td><th>${escapeHtml(preferences.pdfStructure?.coordinatorLabels?.[1] || 'FACULTY ADVISOR')}</th><td>${escapeHtml(preferences.pdfStructure?.signatories?.facultyAdvisor || '')}</td></tr></tbody></table><table class="approval-table"><thead><tr>${(['timetableIncharge', 'overallTtCoordinator', 'hod', 'vicePrincipal', 'principal'] as const).map((key, index) => `<th>${escapeHtml(preferences.pdfStructure?.approvalLabels?.[index] || ['DEPT. TT COORDINATOR', 'OVERALL TT COORDINATOR', 'HOD', 'VICE-PRINCIPAL', 'PRINCIPAL'][index])}</th>`).join('')}</tr></thead><tbody><tr>${(['timetableIncharge', 'overallTtCoordinator', 'hod', 'vicePrincipal', 'principal'] as const).map(key => `<td>${escapeHtml(preferences.pdfStructure?.signatories?.[key] || (key === 'vicePrincipal' ? 'Dr.P.SUJATHA' : key === 'principal' ? getBasicPreferences().principalName || 'Dr.M.ARULKUMARAN' : ''))}</td>`).join('')}</tr></tbody></table>` : '';
  const facultyHeader = facultyDetails ? `<section class="faculty-details"><strong>Faculty:</strong> ${escapeHtml(facultyDetails.name)} &nbsp; <strong>Department:</strong> ${escapeHtml(facultyDetails.departmentName)} &nbsp; <strong>Semester:</strong> ${escapeHtml(facultyDetails.semesterCycle)}<br/><strong>Assigned subjects:</strong> ${facultyDetails.subjects.map(subject => `${escapeHtml(subject.code)} (${escapeHtml(subject.name)})`).join(', ') || 'None'}</section>` : '';
  const accent = /^#[0-9a-f]{6}$/i.test(preferences.pdfAccent) ? preferences.pdfAccent : '#0f766e';
  const background = preferences.pdfStructure?.pdfDocument
    ? `<embed class="page-background pdf-document-background" src="${preferences.pdfStructure.pdfDocument}" type="application/pdf" />`
    : preferences.pdfBackgroundImage ? `<img class="page-background" src="${preferences.pdfBackgroundImage}" alt="" />` : '';
  const templateCss = (preferences.pdfTemplate === 'classic' ? `th,td{border:2px solid #334155}thead th{background:${accent}}h1{font-family:Georgia,serif}` : preferences.pdfTemplate === 'minimal' ? `th,td{border:0;border-bottom:1px solid #cbd5e1}thead th{background:white;color:#0f172a;border-bottom:2px solid ${accent}}` : `table{border-radius:8px;overflow:hidden}thead th{background:${accent}}`) + `table{break-inside:auto}tr{break-inside:avoid;page-break-inside:avoid}th,td{overflow-wrap:anywhere;min-width:0}`;
  const position = ['top', 'middle', 'bottom'].includes(preferences.pdfContentPosition) ? preferences.pdfContentPosition : 'middle';
  const justifyContent = position === 'top' ? 'flex-start' : position === 'bottom' ? 'flex-end' : 'center';
  const opacity = Math.max(.05, Math.min(1, preferences.pdfBackgroundOpacity));
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}html,body{min-height:190mm}body{position:relative;font-family:Arial,sans-serif;color:#0f172a;margin:0}.page-background{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:${opacity};z-index:-1}.page-content{min-height:190mm;display:flex;flex-direction:column;justify-content:${justifyContent}}h1{text-align:center;margin:0 0 5px;font-size:22px}p{text-align:center;white-space:pre-line;color:#475569;margin:0 0 16px}.faculty-details{margin:0 0 10px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px;line-height:1.8;font-size:10px}.faculty-details strong{display:inline}table{width:100%;border-collapse:collapse;table-layout:fixed;background:rgba(255,255,255,.9);break-inside:auto}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #64748b;padding:7px 4px;text-align:center;min-height:48px;vertical-align:middle;font-size:9px;overflow-wrap:anywhere}thead th{background:${accent};color:white;height:auto}tbody th{background:rgba(241,245,249,.96);width:8%}.slot-entry{break-inside:avoid;margin:2px 0;padding:4px;background:#fff;border-radius:4px}strong,span,small{display:block}span{margin-top:3px;color:#475569;font-size:9px}small{margin-top:3px;font-weight:normal}.break-cell{width:3%;padding:3px 1px;color:#475569;background:#e2e8f0;font-size:7px;font-weight:bold;writing-mode:vertical-rl}.pdf-signatories{display:flex;justify-content:space-between;gap:18px;margin-top:30px;break-inside:avoid}.pdf-signatories div{min-width:25%;padding-top:24px;border-top:1px solid #64748b;text-align:center}.pdf-signatories strong,.pdf-signatories span{display:block}.pdf-signatories span{margin-top:4px}footer{text-align:center;margin-top:10px;color:#64748b;font-size:9px}.subject-detail-table,.coordinator-table,.approval-table{margin-top:12px;break-inside:auto}.subject-detail-table th,.subject-detail-table td,.coordinator-table th,.coordinator-table td,.approval-table th,.approval-table td{font-size:8px;padding:5px}.subject-group th{background:#e2e8f0;color:#0f172a;text-align:left}.coordinator-table th,.approval-table th{background:#eaf0f7}${templateCss}</style></head><body>${background}<main class="page-content"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')}</p>${facultyHeader}<table><thead><tr><th>DAY</th>${structureColumns.map(column => `<th class="${column.kind !== 'period' ? 'break-cell' : ''}">${escapeHtml(column.label)}</th>`).join('')}</tr>${timeRow}</thead><tbody>${rows}</tbody></table>${subjectTable}<footer>${escapeHtml(preferences.pdfFooter)}</footer></main><script>window.onload=()=>{window.print()}<\/script></body></html>`);
  popup.document.close();
}
export function exportMasterDayPdf({ title, subtitle, dayName, classes, entries, periods, includeBreaks = false }: MasterDayExportOptions) {
  const preferences = getTimetablePreferences();
  preferences.pdfTemplate = preferences.masterPdfTemplate;
  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) throw new Error('Allow pop-ups to export the timetable as PDF');
  const accent = /^#[0-9a-f]{6}$/i.test(preferences.pdfAccent) ? preferences.pdfAccent : '#315fd6';
  const breakAfter: Record<number, string> = {};
  if (preferences.intervalAfterPeriod > 0) breakAfter[preferences.intervalAfterPeriod] = 'Interval';
  if (preferences.lunchAfterPeriod > 0) breakAfter[preferences.lunchAfterPeriod] = 'Lunch';
  if (periods.length >= 7 && !breakAfter[6]) breakAfter[6] = 'Break';
  const rows = classes.map(classItem => `<tr><th>${escapeHtml(classItem.label)}</th>${periods.map(period => {
    const slotEntries = entries.filter(item => item.class_id === classItem.id && (item.period ?? item.period_number) === period.number);
    const periodCell = `<td>${slotEntries.length ? slotEntries.map(entry => `<div class="slot"><strong>${escapeHtml(entry.subject_code || entry.subject_name || 'Subject')}</strong><span>${escapeHtml(entry.subject_name || '')}</span><small>${escapeHtml(entry.faculty_name || entry.teacher_name || 'Faculty not assigned')}</small></div>`).join('') : '<span class="free">Free</span>'}</td>`;
    const breakCell = includeBreaks && breakAfter[period.number] && period.number < periods.length ? `<td class="break-cell">${escapeHtml(breakAfter[period.number])}</td>` : '';
    return periodCell + breakCell;
  }).join('')}</tr>`).join('');
  const periodHeaders = periods.map(period => `<th>${escapeHtml(period.label)}<small>${escapeHtml(period.time || `${period.start_time || ''}-${period.end_time || ''}`)}</small></th>${includeBreaks && breakAfter[period.number] && period.number < periods.length ? `<th class="break-cell">${escapeHtml(breakAfter[period.number])}</th>` : ''}`).join('');
  const background = preferences.pdfBackgroundImage ? `<img class="page-background" src="${preferences.pdfBackgroundImage}" alt="" />` : '';
  const opacity = Math.max(.05, Math.min(1, preferences.pdfBackgroundOpacity));
 popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)} - ${escapeHtml(dayName)}</title><style>@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{position:relative;margin:0;font-family:Arial,sans-serif;color:#0f172a}.page-background{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:${opacity};z-index:-1}h1{text-align:center;margin:0 0 4px;font-size:21px}p{text-align:center;margin:0 0 13px;color:#475569}table{width:100%;border-collapse:collapse;table-layout:fixed;background:rgba(255,255,255,.92)}th,td{border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px}thead th{height:40px;color:white;background:${accent}}thead th:first-child{width:15%}tbody th{padding:8px;text-align:left;background:#f1f5f9}.slot{min-height:48px;padding:5px;border:1px solid #bfdbfe;border-radius:5px;color:#1e3a8a;background:#eff6ff}.break-cell{width:3%;padding:2px;color:#475569;background:#e2e8f0;font-size:7px;writing-mode:vertical-rl}strong,span,small{display:block}.slot span{margin-top:2px}.slot small{margin-top:5px;opacity:.78}.free{color:#94a3b8}footer{text-align:center;margin-top:8px;color:#64748b;font-size:8px}</style></head><body>${background}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')} Â· ${escapeHtml(dayName)}</p><table><thead><tr><th>Class</th>${periodHeaders}</tr></thead><tbody>${rows}</tbody></table>${preferences.pdfStructure?.signatories ? `<section class="pdf-signatories"><div><strong>Timetable In-charge</strong><span>${escapeHtml(preferences.pdfStructure.signatories.timetableIncharge)}</span></div><div><strong>Vice Principal</strong><span>${escapeHtml(preferences.pdfStructure.signatories.vicePrincipal)}</span></div><div><strong>Principal</strong><span>${escapeHtml(preferences.pdfStructure.signatories.principal)}</span></div></section>` : ''}<footer>${escapeHtml(preferences.pdfFooter)}</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}
export function exportMasterAllDaysPdf({ title, subtitle, days, classes, entries, periods, includeBreaks = false }: MasterAllDaysExportOptions) {
  const preferences = getTimetablePreferences();
  preferences.pdfTemplate = preferences.masterPdfTemplate;
  const popup = window.open('', '_blank', 'width=1000,height=900');
  if (!popup) throw new Error('Allow pop-ups to export the timetable as PDF');
  const accent = /^#[0-9a-f]{6}$/i.test(preferences.pdfAccent) ? preferences.pdfAccent : '#315fd6';
  const breakAfter: Record<number, string> = {};
  if (preferences.intervalAfterPeriod > 0) breakAfter[preferences.intervalAfterPeriod] = 'Interval';
  if (preferences.lunchAfterPeriod > 0) breakAfter[preferences.lunchAfterPeriod] = 'Lunch';
  if (periods.length >= 7 && !breakAfter[6]) breakAfter[6] = 'Break';
  const pages = days.map(day => {
    const rows = periods.map(period => {
      const periodRow = `<tr><th><strong>${escapeHtml(period.label)}</strong><small>${escapeHtml(period.time || '')}</small></th>${classes.map(classItem => {
        const slotEntries = entries.filter(item => item.day === day.apiDay && item.class_id === classItem.id && (item.period ?? item.period_number) === period.number);
        return `<td>${slotEntries.length ? slotEntries.map(entry => `<div class="slot"><strong>${escapeHtml(entry.subject_code || entry.subject_name || 'Subject')}</strong><span>${escapeHtml(entry.subject_name || '')}</span><small>${escapeHtml(entry.faculty_name || entry.teacher_name || 'Faculty not assigned')}</small></div>`).join('') : '<span class="free">Free</span>'}</td>`;
      }).join('')}</tr>`;
      const breakRow = includeBreaks && breakAfter[period.number] && period.number < periods.length
        ? `<tr class="break-row"><th>${breakAfter[period.number]}</th><td colspan="${classes.length}">${breakAfter[period.number]}</td></tr>` : '';
      return periodRow + breakRow;
    }).join('');
    return `<section class="day-page"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')} Â· ${day.label}</p><table><thead><tr><th>Period</th>${classes.map(item => `<th>${escapeHtml(item.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>${preferences.pdfStructure?.signatories ? `<section class="pdf-signatories"><div><strong>Timetable In-charge</strong><span>${escapeHtml(preferences.pdfStructure.signatories.timetableIncharge)}</span></div><div><strong>Vice Principal</strong><span>${escapeHtml(preferences.pdfStructure.signatories.vicePrincipal)}</span></div><div><strong>Principal</strong><span>${escapeHtml(preferences.pdfStructure.signatories.principal)}</span></div></section>` : ''}<footer>${escapeHtml(preferences.pdfFooter)}</footer></section>`;
  }).join('');
  const background = preferences.pdfBackgroundImage ? `<img class="page-background" src="${preferences.pdfBackgroundImage}" alt="" />` : '';
  const opacity = Math.max(.05, Math.min(1, preferences.pdfBackgroundOpacity));
  const templateCss = preferences.pdfTemplate === 'classic' ? `th,td{border:2px solid #334155}h1{font-family:Georgia,serif}` : preferences.pdfTemplate === 'minimal' ? `th,td{border:0;border-bottom:1px solid #cbd5e1}thead th{background:white;color:#0f172a;border-bottom:2px solid ${accent}}` : `.slot{border-radius:7px}`;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)} - All Days</title><style>@page{size:A4 portrait;margin:9mm}*{box-sizing:border-box}body{position:relative;margin:0;font-family:Arial,sans-serif;color:#0f172a}.page-background{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:${opacity};z-index:-1}.day-page{min-height:275mm;page-break-after:always}.day-page:last-child{page-break-after:auto}h1{text-align:center;margin:0 0 4px;font-size:19px}p{text-align:center;margin:0 0 12px;color:#475569}table{width:100%;border-collapse:collapse;table-layout:fixed;background:rgba(255,255,255,.9)}th,td{border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:8px}thead th{color:white;background:${accent}}thead th:first-child{width:12%}tbody th{background:#f1f5f9}.slot{padding:5px;border:1px solid #bfdbfe;border-radius:5px;color:#1e3a8a;background:#eff6ff}strong,span,small{display:block}.slot span,.slot small{margin-top:2px}.free{color:#94a3b8}.break-row th,.break-row td{height:25px;color:#7c3aed;background:#f5f3ff;font-weight:700;text-transform:uppercase;letter-spacing:.05em}footer{text-align:center;margin-top:8px;color:#64748b;font-size:8px}.subject-detail-table,.coordinator-table,.approval-table{margin-top:12px;break-inside:auto}.subject-detail-table th,.subject-detail-table td,.coordinator-table th,.coordinator-table td,.approval-table th,.approval-table td{font-size:8px;padding:5px}.subject-group th{background:#e2e8f0;color:#0f172a;text-align:left}.coordinator-table th,.approval-table th{background:#eaf0f7}${templateCss}</style></head><body>${background}${pages}<script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}
