'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, ArrowLeft, Check, FileImage, FileText, Palette, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTimetablePreferences, setTimetablePreferences } from '@/lib/preferences';
import { getBasicPreferences, getDefaultSemesterCycle } from '@/lib/preferences';
import { api } from '@/lib/api';

const templates = [
  { id: 'modern', name: 'Modern', description: 'Colored header with clean cards and generous spacing.' },
  { id: 'classic', name: 'Classic', description: 'Formal bordered layout suitable for official records.' },
  { id: 'minimal', name: 'Minimal', description: 'Simple monochrome layout optimized for economical printing.' },
] as const;

export default function PdfTemplatePage() {
  const [preferences, setPreferences] = useState(getTimetablePreferences);
  const save = async () => { try { await api.settings.save({ defaultSemesterCycle: getDefaultSemesterCycle(), basic: getBasicPreferences(), timetable: preferences }); setTimetablePreferences(preferences); toast.success('PDF template saved to the workspace'); } catch (error: any) { toast.error(error.message || 'Could not save PDF template'); } };
  const browseBackground = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { toast.error('Choose a PNG or JPG image'); return; }
    if (file.size > 1_500_000) { toast.error('Background image must be smaller than 1.5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPreferences(value => ({ ...value, pdfBackgroundImage: String(reader.result) }));
    reader.onerror = () => toast.error('Could not read that image');
    reader.readAsDataURL(file);
  };
  const previewDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].filter((_, index) => preferences.workingDays.includes(index + 1));
  const previewPeriods = Array.from({ length: Math.max(1, Math.min(preferences.periodsPerDay, 12)) }, (_, index) => index + 1);
  const previewColumns = preferences.pdfStructure?.columns || previewPeriods.flatMap(period => [
    { kind: 'period' as const, label: `P${period}` },
    ...(period === preferences.intervalAfterPeriod && preferences.intervalMinutes ? [{ kind: 'break' as const, label: 'BREAK' }] : []),
    ...(period === preferences.lunchAfterPeriod && preferences.lunchMinutes ? [{ kind: 'lunch' as const, label: 'LUNCH' }] : []),
  ]);
  const importTemplateFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5_000_000) { toast.error('Template file must be smaller than 5 MB'); return; }
    if (file.type === 'image/png' || file.type === 'image/jpeg') { browseBackground(file); return; }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (file.size > 1_500_000) { toast.error('PDF page background must be smaller than 1.5 MB'); return; }
      const reader = new FileReader();
      reader.onload = () => setPreferences(value => ({ ...value, pdfStructure: { ...(value.pdfStructure || { columns: previewColumns, workingDays: [], sourceName: file.name }), pdfDocument: String(reader.result) } }));
      reader.onerror = () => toast.error('Could not read that PDF');
      reader.readAsDataURL(file);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.docx')) { toast.error('Choose a DOCX, PDF, PNG, or JPG template'); return; }
    try {
      const structure = await api.settings.importTemplateStructure(file);
      setPreferences(value => ({ ...value, pdfStructure: structure }));
      toast.success('Timetable grid structure imported. Save the template to keep it.');
    } catch (error: any) { toast.error(error.message || 'Could not import timetable structure'); }
  };
  return <div className="settings-page template-designer">
    <Link href="/settings" className="back-link"><ArrowLeft size={17} /> Back to settings</Link>
    <header className="page-title"><div className="info-icon"><FileText size={25} /></div><div><h1>PDF template designer</h1><p>Set the timetable grid structure and visual style used in exported PDFs.</p></div></header>
    <div className="template-layout">
      <section className="settings-card">
        <div className="settings-heading"><Palette size={22} /><div><h2>Template style</h2><p>Select a layout and customize its branding.</p></div></div>
        <div className="template-options">{templates.map(template => <button type="button" className={preferences.pdfTemplate === template.id ? 'selected' : ''} onClick={() => setPreferences(value => ({ ...value, pdfTemplate: template.id }))} key={template.id}><span className={`template-thumbnail ${template.id}`}><i /><i /><i /><i /></span><span><strong>{template.name}</strong><small>{template.description}</small></span>{preferences.pdfTemplate === template.id && <Check size={18} />}</button>)}</div>
        <div className="template-fields"><label><span>Use for class timetable PDFs</span><select className="form-input" value={preferences.timetablePdfTemplate} onChange={event => setPreferences(value => ({ ...value, timetablePdfTemplate: event.target.value as typeof value.pdfTemplate }))}><option value="modern">Modern</option><option value="classic">Classic</option><option value="minimal">Minimal</option></select></label><label><span>Use for master timetable PDFs</span><select className="form-input" value={preferences.masterPdfTemplate} onChange={event => setPreferences(value => ({ ...value, masterPdfTemplate: event.target.value as typeof value.pdfTemplate }))}><option value="modern">Modern</option><option value="classic">Classic</option><option value="minimal">Minimal</option></select></label></div>
        <div className="template-fields"><label><span>Accent color</span><span className="color-field"><input type="color" value={preferences.pdfAccent} onChange={event => setPreferences(value => ({ ...value, pdfAccent: event.target.value }))} /><input className="form-input" value={preferences.pdfAccent} pattern="#[0-9a-fA-F]{6}" onChange={event => setPreferences(value => ({ ...value, pdfAccent: event.target.value }))} /></span></label><label><span>Footer text</span><input className="form-input" maxLength={100} value={preferences.pdfFooter} onChange={event => setPreferences(value => ({ ...value, pdfFooter: event.target.value }))} /></label></div>
        <div id="template-import" className="background-template-field"><div><FileText size={19} /><span><strong>Import timetable grid or page template</strong><small>DOCX reads the DAY / PERIOD grid and break columns. PDF, PNG, and JPG are used as page backgrounds; timetable entries remain editable and are added on export. This imports layout only; CSV/XLSX college records are not imported here.</small></span></div><div className="background-actions"><label className="browse-button"><Upload size={16} /> Import template<input type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,image/png,image/jpeg" onChange={event => { importTemplateFile(event.target.files?.[0]); event.target.value = ''; }} /></label>{(preferences.pdfStructure || preferences.pdfBackgroundImage) && <button type="button" className="remove-background" onClick={() => setPreferences(value => ({ ...value, pdfStructure: null, pdfBackgroundImage: '' }))}><Trash2 size={15} /> Remove template</button>}</div>{preferences.pdfStructure && <small className="template-import-status">Imported {preferences.pdfStructure.columns.length} grid columns from {preferences.pdfStructure.sourceName}</small>}</div>
        <div className="background-template-field"><div><FileImage size={19} /><span><strong>Upload a page background</strong><small>Use a PNG or JPG for a logo, border, or header frame. The timetable grid and entries are added separately and can grow across pages.</small></span></div><div className="background-actions"><label className="browse-button"><Upload size={16} /> Upload image<input type="file" accept="image/png,image/jpeg" onChange={event => { browseBackground(event.target.files?.[0]); event.target.value = ''; }} /></label>{preferences.pdfBackgroundImage && <button type="button" className="remove-background" onClick={() => setPreferences(value => ({ ...value, pdfBackgroundImage: '' }))}><Trash2 size={15} /> Remove</button>}</div>{preferences.pdfBackgroundImage && <label className="opacity-field"><span>Background visibility</span><input type="range" min="5" max="100" value={Math.round(preferences.pdfBackgroundOpacity * 100)} onChange={event => setPreferences(value => ({ ...value, pdfBackgroundOpacity: Number(event.target.value) / 100 }))} /><output>{Math.round(preferences.pdfBackgroundOpacity * 100)}%</output></label>}</div>
        <fieldset className="pdf-position-field"><legend>Timetable position on page</legend><div>{([
          { value: 'top', label: 'Top', icon: AlignVerticalJustifyStart },
          { value: 'middle', label: 'Middle', icon: AlignVerticalJustifyCenter },
          { value: 'bottom', label: 'Bottom', icon: AlignVerticalJustifyEnd },
        ] as const).map(({ value, label, icon: Icon }) => <button type="button" key={value} className={preferences.pdfContentPosition === value ? 'active' : ''} aria-pressed={preferences.pdfContentPosition === value} onClick={() => setPreferences(current => ({ ...current, pdfContentPosition: value }))}><Icon size={17} />{label}{preferences.pdfContentPosition === value && <Check size={14} />}</button>)}</div></fieldset>
        <button type="button" className="btn btn-primary" onClick={save}>Save PDF template</button>
      </section>
      <section className="pdf-preview-panel"><span>Live timetable structure · {previewDays.length} days × {previewPeriods.length} periods{preferences.pdfStructure ? ` · ${preferences.pdfStructure.sourceName}` : ''}</span><div className={`pdf-sheet ${preferences.pdfTemplate} content-${preferences.pdfContentPosition}`}>{preferences.pdfStructure?.pdfDocument ? <embed className="pdf-background pdf-background-document" src={preferences.pdfStructure.pdfDocument} type="application/pdf" /> : preferences.pdfBackgroundImage && <img className="pdf-background" src={preferences.pdfBackgroundImage} alt="Selected PDF page background" style={{ opacity: preferences.pdfBackgroundOpacity }} />}<div className="pdf-preview-content"><header style={{ background: preferences.pdfTemplate === 'minimal' ? 'transparent' : preferences.pdfAccent }}><strong>COLLEGE NAME / LOGO</strong><h2>{preferences.pdfTitle}</h2><small>Department · Academic year · Semester</small></header><div className="pdf-structure-scroll"><table className="pdf-structure-table"><thead><tr><th>DAY / PERIOD</th>{previewColumns.map((column, index) => <th className={column.kind !== 'period' ? 'pdf-break-column' : ''} key={`${column.kind}-${index}`}>{column.label}</th>)}</tr></thead><tbody>{previewDays.map(day => <tr key={day}><th>{day.slice(0, 3).toUpperCase()}</th>{previewColumns.map((column, index) => <td className={column.kind !== 'period' ? 'pdf-break-column' : ''} key={`${column.kind}-${index}`}>{column.kind === 'period' ? <><strong>Subject</strong><small>Faculty</small></> : column.label}</td>)}</tr>)}</tbody></table></div><p className="pdf-structure-note">The timetable grid expands to configured days and periods; longer content continues onto additional pages.</p><footer>{preferences.pdfFooter}</footer></div></div></section>
    </div>
  </div>;
}
