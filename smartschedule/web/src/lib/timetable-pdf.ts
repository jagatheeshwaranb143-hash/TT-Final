interface ExportOptions {
  title: string;
  subtitle?: string;
  entries: any[];
  periods: Array<{ number: number; label: string; start_time?: string; end_time?: string }>;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function exportTimetablePdf({ title, subtitle, entries, periods }: ExportOptions) {
  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) throw new Error('Allow pop-ups to export the timetable as PDF');
  const days = [
    { number: 1, name: 'Monday' }, { number: 2, name: 'Tuesday' },
    { number: 3, name: 'Wednesday' }, { number: 4, name: 'Thursday' },
    { number: 5, name: 'Friday' },
  ];
  const rows = periods.map(period => `<tr><th>${escapeHtml(period.label)}<small>${escapeHtml(period.start_time || '')}${period.end_time ? ` – ${escapeHtml(period.end_time)}` : ''}</small></th>${days.map(day => {
    const entry = entries.find(item => (item.day_of_week ?? item.day + 1) === day.number && (item.period_number ?? item.period) === period.number);
    return `<td>${entry ? `<strong>${escapeHtml(entry.subject_name || entry.subject_code || 'Subject')}</strong><span>${escapeHtml(entry.teacher_name || entry.faculty_name || '')}</span><span>${escapeHtml(entry.class_label || entry.room_name || '')}</span>` : ''}</td>`;
  }).join('')}</tr>`).join('');
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;margin:0}h1{text-align:center;margin:0 0 5px;font-size:22px}p{text-align:center;color:#475569;margin:0 0 16px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #94a3b8;padding:8px;text-align:center;height:72px;font-size:11px}thead th{background:#0f766e;color:white;height:auto}tbody th{background:#f1f5f9;width:12%}strong,span,small{display:block}span{margin-top:4px;color:#475569;font-size:10px}small{margin-top:3px;font-weight:normal}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')}</p><table><thead><tr><th>Period</th>${days.map(day => `<th>${day.name}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print()}<\/script></body></html>`);
  popup.document.close();
}
