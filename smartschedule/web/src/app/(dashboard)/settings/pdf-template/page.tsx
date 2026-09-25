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
  return <div className="settings-page template-designer">
    <Link href="/settings" className="back-link"><ArrowLeft size={17} /> Back to settings</Link>
    <header className="page-title"><div className="info-icon"><FileText size={25} /></div><div><h1>PDF template designer</h1><p>Design the template used whenever a timetable is exported.</p></div></header>
    <div className="template-layout">
      <section className="settings-card">
        <div className="settings-heading"><Palette size={22} /><div><h2>Template style</h2><p>Select a layout and customize its branding.</p></div></div>
        <div className="template-options">{templates.map(template => <button type="button" className={preferences.pdfTemplate === template.id ? 'selected' : ''} onClick={() => setPreferences(value => ({ ...value, pdfTemplate: template.id }))} key={template.id}><span className={`template-thumbnail ${template.id}`}><i /><i /><i /><i /></span><span><strong>{template.name}</strong><small>{template.description}</small></span>{preferences.pdfTemplate === template.id && <Check size={18} />}</button>)}</div>
        <div className="template-fields"><label><span>Accent color</span><span className="color-field"><input type="color" value={preferences.pdfAccent} onChange={event => setPreferences(value => ({ ...value, pdfAccent: event.target.value }))} /><input className="form-input" value={preferences.pdfAccent} pattern="#[0-9a-fA-F]{6}" onChange={event => setPreferences(value => ({ ...value, pdfAccent: event.target.value }))} /></span></label><label><span>Footer text</span><input className="form-input" maxLength={100} value={preferences.pdfFooter} onChange={event => setPreferences(value => ({ ...value, pdfFooter: event.target.value }))} /></label></div>
        <div className="background-template-field"><div><FileImage size={19} /><span><strong>Background template</strong><small>Browse a PNG or JPG image (maximum 1.5 MB).</small></span></div><div className="background-actions"><label className="browse-button"><Upload size={16} /> Browse image<input type="file" accept="image/png,image/jpeg" onChange={event => { browseBackground(event.target.files?.[0]); event.target.value = ''; }} /></label>{preferences.pdfBackgroundImage && <button type="button" className="remove-background" onClick={() => setPreferences(value => ({ ...value, pdfBackgroundImage: '' }))}><Trash2 size={15} /> Remove</button>}</div>{preferences.pdfBackgroundImage && <label className="opacity-field"><span>Background visibility</span><input type="range" min="5" max="100" value={Math.round(preferences.pdfBackgroundOpacity * 100)} onChange={event => setPreferences(value => ({ ...value, pdfBackgroundOpacity: Number(event.target.value) / 100 }))} /><output>{Math.round(preferences.pdfBackgroundOpacity * 100)}%</output></label>}</div>
        <fieldset className="pdf-position-field"><legend>Timetable position on page</legend><div>{([
          { value: 'top', label: 'Top', icon: AlignVerticalJustifyStart },
          { value: 'middle', label: 'Middle', icon: AlignVerticalJustifyCenter },
          { value: 'bottom', label: 'Bottom', icon: AlignVerticalJustifyEnd },
        ] as const).map(({ value, label, icon: Icon }) => <button type="button" key={value} className={preferences.pdfContentPosition === value ? 'active' : ''} aria-pressed={preferences.pdfContentPosition === value} onClick={() => setPreferences(current => ({ ...current, pdfContentPosition: value }))}><Icon size={17} />{label}{preferences.pdfContentPosition === value && <Check size={14} />}</button>)}</div></fieldset>
        <button type="button" className="btn btn-primary" onClick={save}>Save PDF template</button>
      </section>
      <section className="pdf-preview-panel"><span>Live preview</span><div className={`pdf-sheet ${preferences.pdfTemplate} content-${preferences.pdfContentPosition}`}>{preferences.pdfBackgroundImage && <img className="pdf-background" src={preferences.pdfBackgroundImage} alt="Selected PDF background template" style={{ opacity: preferences.pdfBackgroundOpacity }} />}<div className="pdf-preview-content"><header style={{ background: preferences.pdfTemplate === 'minimal' ? 'transparent' : preferences.pdfAccent }}><strong>SEC SCHEDX COLLEGE</strong><h2>{preferences.pdfTitle}</h2><small>Department — Year 2, Semester 3</small></header><table><thead><tr><th>Period</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th></tr></thead><tbody>{[1,2,3].map(period => <tr key={period}><th>P{period}</th><td>Subject<br /><small>Faculty</small></td><td>Subject<br /><small>Faculty</small></td><td>Subject<br /><small>Faculty</small></td></tr>)}</tbody></table><footer>{preferences.pdfFooter}</footer></div></div></section>
    </div>
  </div>;
}
