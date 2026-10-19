/**
 * SEC SchedX — Excel Timetable Export Utility
 * Uses xlsx (SheetJS) to generate .xlsx files from timetable data.
 */

export interface ExcelPeriod {
  number: number;
  label: string;
  time: string;
}

export interface ExcelClass {
  id: string;
  label: string;
}

export interface ExcelEntry {
  class_id: string;
  day: number;
  period: number;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  subject_type?: string;
}

export interface ExcelDayExportOptions {
  title: string;
  subtitle: string;
  dayName: string;
  classes: ExcelClass[];
  entries: ExcelEntry[];
  periods: ExcelPeriod[];
}

export interface ExcelAllDaysExportOptions {
  title: string;
  subtitle: string;
  days: { apiDay: number; label: string; short: string }[];
  classes: ExcelClass[];
  entries: ExcelEntry[];
  periods: ExcelPeriod[];
}

function buildRows(classes: ExcelClass[], entries: ExcelEntry[], periods: ExcelPeriod[]): string[][] {
  const headerRow: string[] = ['Class', ...periods.map((p) => `${p.label} ${p.time}`)];
  const dataRows = classes.map((cls) => {
    const row: string[] = [cls.label];
    for (const period of periods) {
      const slot = entries.find((e) => e.class_id === cls.id && e.period === period.number);
      if (slot) {
        const isLab = slot.subject_type === 'lab';
        const code = slot.subject_code || '';
        const name = slot.subject_name || '';
        const faculty = slot.faculty_name || 'TBA';
        row.push(`${code ? code + ' - ' : ''}${name}${isLab ? ' [Lab]' : ''} | ${faculty}`);
      } else {
        row.push('Free');
      }
    }
    return row;
  });
  return [headerRow, ...dataRows];
}

export async function exportMasterDayExcel(options: ExcelDayExportOptions): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const rows = buildRows(options.classes, options.entries, options.periods);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, ...options.periods.map(() => ({ wch: 26 }))];
  XLSX.utils.book_append_sheet(wb, ws, options.dayName.slice(0, 31));
  const filename = `${options.title} - ${options.dayName}.xlsx`.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, filename);
}

export async function exportMasterAllDaysExcel(options: ExcelAllDaysExportOptions): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const day of options.days) {
    const dayEntries = options.entries.filter((e) => e.day === day.apiDay);
    const rows = buildRows(options.classes, dayEntries, options.periods);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, ...options.periods.map(() => ({ wch: 26 }))];
    XLSX.utils.book_append_sheet(wb, ws, day.label.slice(0, 31));
  }
  const filename = `${options.title} - All Days.xlsx`.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, filename);
}

export interface ExcelClassExportOptions {
  className: string;
  departmentName?: string;
  periods: { number: number; label: string; start_time?: string; end_time?: string }[];
  entries: any[];
  workingDays?: number[];
}

export async function exportClassTimetableExcel(options: ExcelClassExportOptions): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const days = (options.workingDays && options.workingDays.length > 0) ? options.workingDays : [1, 2, 3, 4, 5];

  const headerRow: string[] = ['Day', ...options.periods.map(p => `${p.label}${p.start_time ? ` (${p.start_time}-${p.end_time})` : ''}`)];
  const rows: string[][] = [headerRow];

  for (const dayNum of days) {
    const dayIndex = dayNum - 1;
    const dayLabel = dayNames[dayIndex] || `Day ${dayNum}`;
    const row: string[] = [dayLabel];

    for (const period of options.periods) {
      const slot = options.entries.find((e: any) => {
        const eDay = typeof e.day === 'number' ? e.day : (e.day_of_week ? e.day_of_week - 1 : -1);
        const ePeriod = typeof e.period === 'number' ? e.period : e.period_number;
        return eDay === dayIndex && ePeriod === period.number;
      });

      if (slot) {
        const isLab = slot.subject_type === 'lab';
        const code = slot.subject_code || '';
        const name = slot.subject_name || '';
        const faculty = slot.faculty_name || slot.teacher_name || '';
        row.push(`${code ? code + ' - ' : ''}${name}${isLab ? ' [Lab]' : ''}${faculty ? ` | ${faculty}` : ''}`);
      } else {
        row.push('Free');
      }
    }
    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, ...options.periods.map(() => ({ wch: 28 }))];
  XLSX.utils.book_append_sheet(wb, ws, options.className.slice(0, 31));
  const filename = `${options.className} - Timetable.xlsx`.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, filename);
}

