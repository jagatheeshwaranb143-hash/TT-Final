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
  onEntryMove?: (entryId: string, newDay: number, newPeriod: number) => Promise<boolean>;
  onEntryDelete?: (entry: any) => void;
  onCellSelect?: (day: number, period: number, entry?: any) => void;
}

export default function TimetableGrid({ entries, periods, workingDays, isEditable, compact = false, onEntryMove, onEntryDelete, onCellSelect }: TimetableGridProps) {
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

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact
        ? `56px repeat(${workingDays.length}, minmax(0, 1fr))`
        : `80px repeat(${workingDays.length}, minmax(180px, 1fr))`,
      gap: '1px',
      background: 'var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      border: '1px solid var(--color-border)'
    }}>
      {/* Header Row */}
      <div style={{ 
        background: 'var(--color-surface)', 
        padding: 'var(--space-3)', 
        fontWeight: 600, 
        color: 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--font-size-xs)',
        textTransform: 'none',
        letterSpacing: 0
      }}>Time</div>
      
      {workingDays.map(day => (
        <div key={`header-${day}`} style={{
          background: 'var(--color-surface)',
          padding: compact ? '10px 4px' : 'var(--space-4) var(--space-3)',
          textAlign: 'center',
          fontWeight: 600,
          color: 'var(--color-text)',
          fontSize: compact ? '0.7rem' : 'var(--font-size-sm)',
          textTransform: 'none',
          letterSpacing: 0,
          position: 'relative'
        }}>
          {getDayName(day)}
          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '30px', height: '3px', background: 'var(--color-primary)', borderRadius: '3px 3px 0 0' }}></div>
        </div>
      ))}

      {/* Grid Rows */}
      {periods.map(period => (
        <React.Fragment key={`row-${period.number}`}>
          {/* Time column */}
          <div style={{
            background: 'var(--color-surface)',
            padding: 'var(--space-3)',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>{period.label}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8, marginTop: '2px' }}>{period.start_time}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.5, lineHeight: 1 }}>|</div>
            <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>{period.end_time}</div>
          </div>

          {/* Day columns for this period */}
          {workingDays.map(day => {
            const cellEntries = entries.filter(e => e.day_of_week === day && e.period_number === period.number);
            return (
              <div
                key={`cell-${day}-${period.number}`}
                onDragOver={isEditable ? handleDragOver : undefined}
                onDrop={isEditable ? (e) => handleDrop(e, day, period.number) : undefined}
                onClick={isEditable && onCellSelect ? () => onCellSelect(day, period.number, cellEntries[0]) : undefined}
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
                  outlineOffset: '-5px'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--color-surface)' }}
              >
                {cellEntries.map((entry, idx) => {
                  const subjectColorHue = ((entry.subject_name?.length || 0) * 45) % 360;
                  return (
                    <div
                      key={entry.id || idx}
                      draggable={isEditable}
                      onDragStart={(e) => handleDragStart(e, entry.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(event) => { event.stopPropagation(); if (isEditable && onCellSelect) onCellSelect(day, period.number, entry); }}
                      style={{
                        background: `linear-gradient(135deg, hsl(${subjectColorHue}, 80%, 65%), hsl(${subjectColorHue}, 80%, 55%))`,
                        color: 'white',
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
                      onMouseOver={(e) => { if(isEditable) e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.4)'; }}
                      onMouseOut={(e) => { if(isEditable) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.3)'; }}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.1)', opacity: 0.5, zIndex: 1 }}></div>
                      
                      <div style={{ position: 'relative', zIndex: 2 }}>
                        {isEditable && onEntryDelete && (
                          <button type="button" aria-label={`Remove ${entry.subject_name || 'subject'} from this period`} title="Remove this subject"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); onEntryDelete(entry); }}
                            style={{ position: 'absolute', top: '-8px', right: '-8px', width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,.8)', background: '#b91c1c', color: 'white', fontWeight: 800, cursor: 'pointer', lineHeight: 1, zIndex: 3 }}>×</button>
                        )}
                        <div style={{ fontWeight: 700, fontSize: compact ? '0.7rem' : 'var(--font-size-sm)', marginBottom: 'var(--space-1)', textShadow: '0 1px 2px rgba(0,0,0,0.2)', overflowWrap: 'anywhere' }}>
                          {entry.subject_name || entry.subject_code || 'Subject'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', gap: compact ? 3 : 0, justifyContent: 'space-between', opacity: 0.95, textShadow: '0 1px 1px rgba(0,0,0,0.2)', fontSize: compact ? '0.62rem' : '0.7rem', minWidth: 0 }}>
                          <span style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>{entry.teacher_name || 'Teacher'}</span>
                          <span style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>{entry.room_name || 'Room'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
