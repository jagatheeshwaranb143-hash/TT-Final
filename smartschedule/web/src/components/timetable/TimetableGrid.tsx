import React, { useState } from 'react';

interface Period {
  number: number;
  label: string;
  start_time: string;
  end_time: string;
}

interface TimetableGridProps {
  entries: any[];
  periods: Period[];
  workingDays: number[];
  isEditable?: boolean;
  compact?: boolean;
  orientation?: 'horizontal' | 'vertical';
  onEntryMove?: (entryId: string, newDay: number, newPeriod: number) => Promise<boolean>;
  onEntryDelete?: (entry: any) => void;
  onCellSelect?: (day: number, period: number, entry?: any) => void;
}

export default function TimetableGrid({ entries, periods, workingDays, isEditable, compact = false, orientation = 'horizontal', onEntryMove, onEntryDelete, onCellSelect }: TimetableGridProps) {
  const [draggedEntry, setDraggedEntry] = useState<string | null>(null);

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || `Day ${day}`;
  };

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    setDraggedEntry(entryId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entryId);
  };

  const handleDragEnd = () => {
    setDraggedEntry(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, day: number, periodNumber: number) => {
    e.preventDefault();
    const entryId = e.dataTransfer.getData('text/plain');
    if (entryId && onEntryMove) {
      await onEntryMove(entryId, day, periodNumber);
    }
    setDraggedEntry(null);
  };

  // Shared: render a single slot card
  const renderSlotCard = (entry: any, day: number, periodNumber: number, idx: number) => {
    const isLab = entry.subject_type === 'lab';
    return (
      <div
        key={entry.id || idx}
        draggable={isEditable}
        role="group"
        aria-label={`${entry.subject_name || 'Subject'}, taught by ${entry.teacher_name || entry.faculty_name || 'Faculty not assigned'}`}
        onDragStart={(e) => handleDragStart(e, entry.id)}
        onDragEnd={handleDragEnd}
        onClick={(event) => { event.stopPropagation(); if (isEditable && onCellSelect) onCellSelect(day, periodNumber, entry); }}
        className={`timetable-slot-card ${isLab ? 'lab' : ''}`}
        style={{
          padding: compact ? '7px 5px' : 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          cursor: isEditable ? 'grab' : 'default',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.3)',
          opacity: draggedEntry === entry.id ? 0.5 : 1,
          transform: draggedEntry === entry.id ? 'scale(0.95)' : 'none',
          transition: 'transform var(--transition-fast), opacity var(--transition-fast), box-shadow var(--transition-fast)',
          position: 'relative',
          overflow: 'hidden',
          minWidth: 0,
        }}
        onMouseOver={(e) => { if (isEditable) e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.4)'; }}
        onMouseOut={(e) => { if (isEditable) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.3)'; }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.1)', opacity: 0.5, zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          {isEditable && onEntryDelete && (
            <button className="timetable-remove" type="button" aria-label={`Remove ${entry.subject_name || 'subject'} from this period`} title="Remove this subject"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onEntryDelete(entry); }}
              style={{ position: 'absolute', top: '-8px', right: '-8px', width: 24, height: 24, border: 0, background: 'transparent', color: 'currentColor', fontWeight: 800, cursor: 'pointer', lineHeight: 1, zIndex: 3 }}>
              &times;
            </button>
          )}
          <div style={{ fontWeight: 700, fontSize: compact ? '0.7rem' : 'var(--font-size-sm)', marginBottom: 'var(--space-1)', paddingRight: isEditable ? 10 : 0, textShadow: '0 1px 2px rgba(0,0,0,0.2)', overflowWrap: 'anywhere' }}>
            {entry.subject_name || 'Subject'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 3 : 0, opacity: 0.95, textShadow: '0 1px 1px rgba(0,0,0,0.2)', fontSize: compact ? '0.62rem' : '0.7rem', minWidth: 0 }}>
            <span className="timetable-slot-meta" style={{ padding: '2px 6px', borderRadius: '4px' }}>{entry.teacher_name || entry.faculty_name || 'Faculty not assigned'}</span>
          </div>
        </div>
      </div>
    );
  };

  // Shared: render a grid cell (the slot area)
  const renderCell = (day: number, periodNumber: number) => {
    const cellEntries = entries.filter(e => e.day_of_week === day && e.period_number === periodNumber);
    return (
      <div
        role="gridcell"
        aria-label={`${getDayName(day)}, Period ${periodNumber}${cellEntries.length ? `: ${cellEntries.map(item => item.subject_name || 'Subject').join(', ')}` : ': Empty'}`}
        tabIndex={isEditable && onCellSelect ? 0 : -1}
        key={`cell-${day}-${periodNumber}`}
        onDragOver={isEditable ? handleDragOver : undefined}
        onDrop={isEditable ? (e) => handleDrop(e, day, periodNumber) : undefined}
        onClick={isEditable && onCellSelect ? () => onCellSelect(day, periodNumber, cellEntries[0]) : undefined}
        onKeyDown={isEditable && onCellSelect ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCellSelect(day, periodNumber, cellEntries[0]);
          }
        } : undefined}
        style={{
          background: 'var(--color-surface)',
          padding: compact ? '4px' : 'var(--space-2)',
          minHeight: compact ? '82px' : '110px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          transition: 'background var(--transition-fast)',
          cursor: isEditable && onCellSelect ? 'pointer' : 'default',
          outline: isEditable && onCellSelect && cellEntries.length === 0 ? '1px dashed #99f6e4' : 'none',
          outlineOffset: '-5px',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'var(--color-surface)'; }}
      >
        {cellEntries.map((entry, idx) => renderSlotCard(entry, day, periodNumber, idx))}
        {cellEntries.length === 0 && <span className="timetable-free" aria-hidden="true">Free</span>}
      </div>
    );
  };

  const periodHeaderCell = (period: Period) => (
    <div role="columnheader" key={`ph-${period.number}`} style={{
      background: 'var(--color-surface)',
      padding: compact ? '10px 4px' : 'var(--space-4) var(--space-3)',
      textAlign: 'center',
      fontWeight: 600,
      color: 'var(--color-text)',
      fontSize: compact ? '0.7rem' : 'var(--font-size-sm)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    }}>
      <span>{period.label}</span>
      {!compact && <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>{period.start_time}–{period.end_time}</span>}
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '30px', height: '3px', background: 'var(--color-primary)', borderRadius: '3px 3px 0 0' }} />
    </div>
  );

  const dayHeaderCell = (day: number) => (
    <div role="columnheader" key={`dh-${day}`} style={{
      background: 'var(--color-surface)',
      padding: compact ? '10px 4px' : 'var(--space-4) var(--space-3)',
      textAlign: 'center',
      fontWeight: 600,
      color: 'var(--color-text)',
      fontSize: compact ? '0.7rem' : 'var(--font-size-sm)',
      position: 'relative',
    }}>
      {getDayName(day)}
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '30px', height: '3px', background: 'var(--color-primary)', borderRadius: '3px 3px 0 0' }} />
    </div>
  );

  // ── HORIZONTAL layout: rows = periods, columns = days ──────────────────────
  if (orientation !== 'vertical') {
    return (
      <div role="grid" aria-label="Weekly timetable (horizontal)" className="accessible-timetable master-themed-grid" style={{
        display: 'grid',
        gridTemplateColumns: compact
          ? `56px repeat(${workingDays.length}, minmax(0, 1fr))`
          : `80px repeat(${workingDays.length}, minmax(180px, 1fr))`,
        gap: '1px',
        background: 'var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}>
        {/* Corner */}
        <div role="columnheader" style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xs)' }}>Time</div>

        {/* Day headers */}
        {workingDays.map(day => dayHeaderCell(day))}

        {/* Rows: one per period */}
        {periods.map(period => (
          <React.Fragment key={`row-${period.number}`}>
            {/* Time column */}
            <div role="rowheader" style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>{period.label}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8, marginTop: '2px' }}>{period.start_time}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.5, lineHeight: 1 }}>|</div>
              <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>{period.end_time}</div>
            </div>
            {workingDays.map(day => renderCell(day, period.number))}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // ── VERTICAL layout: rows = days, columns = periods ────────────────────────
  return (
    <div role="grid" aria-label="Weekly timetable (vertical)" className="accessible-timetable master-themed-grid" style={{
      display: 'grid',
      gridTemplateColumns: compact
        ? `56px repeat(${periods.length}, minmax(0, 1fr))`
        : `96px repeat(${periods.length}, minmax(140px, 1fr))`,
      gap: '1px',
      background: 'var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      border: '1px solid var(--color-border)',
    }}>
      {/* Corner */}
      <div role="columnheader" style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xs)' }}>Day</div>

      {/* Period headers */}
      {periods.map(period => periodHeaderCell(period))}

      {/* Rows: one per day */}
      {workingDays.map(day => (
        <React.Fragment key={`vrow-${day}`}>
          {/* Day label column */}
          <div role="rowheader" style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', color: 'var(--color-text)', fontWeight: 700, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', fontSize: compact ? '0.7rem' : 'var(--font-size-sm)' }}>
            {getDayName(day)}
          </div>
          {periods.map(period => renderCell(day, period.number))}
        </React.Fragment>
      ))}
    </div>
  );
}
