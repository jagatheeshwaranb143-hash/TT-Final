import { getTimetablePreferences } from './preferences';

interface ExportOptions {
  title: string;
  subtitle?: string;
  entries: any[];
  periods: Array<{ number: number; label: string; start_time?: string; end_time?: string }>;
}

interface MasterDayExportOptions {
  title: string;
  subtitle?: string;
  dayName: string;
  classes: Array<{ id: string; label: string }>;
  entries: any[];
  periods: Array<{ number: number; label: string; start_time?: string; end_time?: string; time?: string }>;
}

interface MasterAllDaysExportOptions extends Omit<MasterDayExportOptions, 'dayName'> {
  days: Array<{ apiDay: number; label: string }>;
  includeBreaks?: boolean;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function exportTimetablePdf({ title, subtitle, entries, periods }: ExportOptions) {
  const preferences = getTimetablePreferences();
  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) throw new Error('Allow pop-ups to export the timetable as PDF');
  const allDays = [
    { number: 1, name: 'Monday' }, { number: 2, name: 'Tuesday' },
    { number: 3, name: 'Wednesday' }, { number: 4, name: 'Thursday' },
    { number: 5, name: 'Friday' }, { number: 6, name: 'Saturday' },
  ];
  const days = allDays.filter(day => preferences.workingDays.includes(day.number));
  const rows = periods.map(period => `<tr><th>${escapeHtml(period.label)}<small>${escapeHtml(period.start_time || '')}${period.end_time ? ` – ${escapeHtml(period.end_time)}` : ''}</small></th>${days.map(day => {
    const slotEntries = entries.filter(item => (item.day_of_week ?? item.day + 1) === day.number && (item.period_number ?? item.period) === period.number);
    return `<td>${slotEntries.map(entry => `<div class="slot-entry"><strong>${escapeHtml(entry.subject_name || entry.subject_code || 'Subject')}</strong><span>${escapeHtml(entry.teacher_name || entry.faculty_name || '')}</span><span>${escapeHtml(entry.class_label || entry.room_name || '')}</span></div>`).join('')}</td>`;
  }).join('')}</tr>`).join('');
  const accent = /^#[0-9a-f]{6}$/i.test(preferences.pdfAccent) ? preferences.pdfAccent : '#0f766e';
  const background = preferences.pdfBackgroundImage ? `<img class="page-background" src="${preferences.pdfBackgroundImage}" alt="" />` : '';
  const templateCss = preferences.pdfTemplate === 'classic' ? `th,td{border:2px solid #334155}thead th{background:${accent}}h1{font-family:Georgia,serif}` : preferences.pdfTemplate === 'minimal' ? `th,td{border:0;border-bottom:1px solid #cbd5e1}thead th{background:white;color:#0f172a;border-bottom:2px solid ${accent}}` : `table{border-radius:8px;overflow:hidden}thead th{background:${accent}}`;
  const position = ['top', 'middle', 'bottom'].includes(preferences.pdfContentPosition) ? preferences.pdfContentPosition : 'middle';
  const justifyContent = position === 'top' ? 'flex-start' : position === 'bottom' ? 'flex-end' : 'center';
  const opacity = Math.max(.05, Math.min(1, preferences.pdfBackgroundOpacity));
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}html,body{min-height:190mm}body{position:relative;font-family:Arial,sans-serif;color:#0f172a;margin:0}.page-background{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:${opacity};z-index:-1}.page-content{min-height:190mm;display:flex;flex-direction:column;justify-content:${justifyContent}}h1{text-align:center;margin:0 0 5px;font-size:22px}p{text-align:center;color:#475569;margin:0 0 16px}table{width:100%;border-collapse:collapse;table-layout:fixed;background:rgba(255,255,255,.88)}th,td{border:1px solid #94a3b8;padding:8px;text-align:center;height:72px;font-size:11px}thead th{background:${accent};color:white;height:auto}tbody th{background:rgba(241,245,249,.92);width:12%}strong,span,small{display:block}span{margin-top:4px;color:#475569;font-size:10px}small{margin-top:3px;font-weight:normal}footer{text-align:center;margin-top:10px;color:#64748b;font-size:9px}${templateCss}</style></head><body>${background}<main class="page-content"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')}</p><table><thead><tr><th>Period</th>${days.map(day => `<th>${day.name}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><footer>${escapeHtml(preferences.pdfFooter)}</footer></main><script>window.onload=()=>{window.print()}<\/script></body></html>`);
  popup.document.close();
}

export function exportMasterDayPdf({ title, subtitle, dayName, classes, entries, periods }: MasterDayExportOptions) {
  const preferences = getTimetablePreferences();
  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) throw new Error('Allow pop-ups to export the timetable as PDF');
  const accent = /^#[0-9a-f]{6}$/i.test(preferences.pdfAccent) ? preferences.pdfAccent : '#315fd6';
  const rows = classes.map(classItem => `<tr><th>${escapeHtml(classItem.label)}</th>${periods.map(period => {
    const slotEntries = entries.filter(item => item.class_id === classItem.id && (item.period ?? item.period_number) === period.number);
    return `<td>${slotEntries.length ? slotEntries.map(entry => `<div class="slot"><strong>${escapeHtml(entry.subject_code || entry.subject_name || 'Subject')}</strong><span>${escapeHtml(entry.subject_name || '')}</span><small>${escapeHtml(entry.faculty_name || entry.teacher_name || 'Faculty not assigned')}</small></div>`).join('') : '<span class="free">Free</span>'}</td>`;
  }).join('')}</tr>`).join('');
  const background = preferences.pdfBackgroundImage ? `<img class="page-background" src="${preferences.pdfBackgroundImage}" alt="" />` : '';
  const opacity = Math.max(.05, Math.min(1, preferences.pdfBackgroundOpacity));
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)} - ${escapeHtml(dayName)}</title><style>@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{position:relative;margin:0;font-family:Arial,sans-serif;color:#0f172a}.page-background{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:${opacity};z-index:-1}h1{text-align:center;margin:0 0 4px;font-size:21px}p{text-align:center;margin:0 0 13px;color:#475569}table{width:100%;border-collapse:collapse;table-layout:fixed;background:rgba(255,255,255,.92)}th,td{border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:9px}thead th{height:40px;color:white;background:${accent}}thead th:first-child{width:15%}tbody th{padding:8px;text-align:left;background:#f1f5f9}.slot{min-height:48px;padding:5px;border:1px solid #bfdbfe;border-radius:5px;color:#1e3a8a;background:#eff6ff}strong,span,small{display:block}.slot span{margin-top:2px}.slot small{margin-top:5px;opacity:.78}.free{color:#94a3b8}footer{text-align:center;margin-top:8px;color:#64748b;font-size:8px}</style></head><body>${background}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')} · ${escapeHtml(dayName)}</p><table><thead><tr><th>Class</th>${periods.map(period => `<th>${escapeHtml(period.label)}<small>${escapeHtml(period.time || `${period.start_time || ''}-${period.end_time || ''}`)}</small></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><footer>${escapeHtml(preferences.pdfFooter)}</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}

export function exportMasterAllDaysPdf({ title, subtitle, days, classes, entries, periods, includeBreaks = false }: MasterAllDaysExportOptions) {
  const preferences = getTimetablePreferences();
  const popup = window.open('', '_blank', 'width=1000,height=900');
  if (!popup) throw new Error('Allow pop-ups to export the timetable as PDF');
  const accent = /^#[0-9a-f]{6}$/i.test(preferences.pdfAccent) ? preferences.pdfAccent : '#315fd6';
  const breakAfter: Record<number, string> = { 2: 'Interval', 4: 'Lunch', 6: 'Interval' };
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
    return `<section class="day-page"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')} · ${day.label}</p><table><thead><tr><th>Period</th>${classes.map(item => `<th>${escapeHtml(item.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><footer>${escapeHtml(preferences.pdfFooter)}</footer></section>`;
  }).join('');
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)} - All Days</title><style>@page{size:A4 portrait;margin:9mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#0f172a}.day-page{min-height:275mm;page-break-after:always}.day-page:last-child{page-break-after:auto}h1{text-align:center;margin:0 0 4px;font-size:19px}p{text-align:center;margin:0 0 12px;color:#475569}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:8px}thead th{color:white;background:${accent}}thead th:first-child{width:12%}tbody th{background:#f1f5f9}.slot{padding:5px;border:1px solid #bfdbfe;border-radius:5px;color:#1e3a8a;background:#eff6ff}strong,span,small{display:block}.slot span,.slot small{margin-top:2px}.free{color:#94a3b8}.break-row th,.break-row td{height:25px;color:#7c3aed;background:#f5f3ff;font-weight:700;text-transform:uppercase;letter-spacing:.05em}footer{text-align:center;margin-top:8px;color:#64748b;font-size:8px}</style></head><body>${pages}<script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}
