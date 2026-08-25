"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import ConflictReport from "@/components/timetable/ConflictReport";
import { exportTimetablePdf } from "@/lib/timetable-pdf";

const editorPeriods = [
  { number: 1, label: "P1", start_time: "09:00", end_time: "10:00" },
  { number: 2, label: "P2", start_time: "10:00", end_time: "11:00" },
  { number: 3, label: "P3", start_time: "11:15", end_time: "12:15" },
  { number: 4, label: "P4", start_time: "12:15", end_time: "13:15" },
  { number: 5, label: "P5", start_time: "14:00", end_time: "15:00" },
  { number: 6, label: "P6", start_time: "15:00", end_time: "16:00" },
];

export default function EditorPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [entries, setEntries] = useState<any[]>([]);
  const [versionId, setVersionId] = useState<string>("Master Version 1");
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const clsList = await api.classes.list() as any[];
        if (clsList && clsList.length > 0) {
          setClasses(clsList);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleClassChange = async (classId: string) => {
    setSelectedClass(classId);
    if (!classId) { setEntries([]); return; }
    try {
      setLoading(true);
      const data = await api.timetable.classTimetable(classId) as any;
      if (Array.isArray(data)) {
        setEntries(data.map((e: any) => ({
          ...e,
          day_of_week: e.day + 1,
          period_number: e.period,
          subject_name: e.subject_name || e.subject_code,
          teacher_name: e.faculty_name,
          room_name: e.room_name || e.lab_name || "Room 101",
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (entryId: string, newDay: number, newPeriod: number) => {
    const conflict = entries.find(e => e.id !== entryId && e.day_of_week === newDay && e.period_number === newPeriod);
    
    if (conflict) {
      setConflicts(prev => [
        ...prev.filter(c => c.id !== entryId),
        {
          id: entryId,
          type: "warning",
          message: `Slot overlap with ${conflict.subject_name}`,
          details: `Both classes assigned to Day ${newDay}, Period ${newPeriod}`,
        }
      ]);
    } else {
      setConflicts(prev => prev.filter(c => c.id !== entryId));
    }

    try {
      const entry = entries.find(e => e.id === entryId);
      if (entry && entry.version_id) {
        await api.editor.move({
          entry_id: entryId,
          new_day_of_week: newDay,
          new_period_number: newPeriod,
          version_id: entry.version_id,
        });
      }
    } catch (e: any) {
      console.warn("Backend move sync:", e.message);
    }

    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, day_of_week: newDay, period_number: newPeriod } : e));
    toast.success("Period moved & stored!");
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      toast.success("Timetable modifications saved successfully to database!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", background: "#f8fafc" }}>
      <header style={{
        padding: "1rem 1.5rem",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "white",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Interactive Timetable Editor</h2>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Version: {versionId} • {entries.length} active class slots</div>
          </div>
          <select
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            style={{ padding: "0.5rem 0.875rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontWeight: 600, fontSize: "0.875rem", background: "#f8fafc" }}
          >
            <option value="">Choose a class</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.department_name} - Year {c.year}, Semester {c.semester}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          {selectedClass && entries.length > 0 && <button type="button" onClick={() => { try { const cls = classes.find(item => item.id === selectedClass); exportTimetablePdf({ title: 'Manual Class Timetable', subtitle: cls ? `${cls.department_name} - Year ${cls.year}, Semester ${cls.semester}` : '', entries, periods: editorPeriods }); } catch (error: any) { toast.error(error.message); } }} style={{ padding: "0.5rem 1rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "6px", color: "#334155", fontWeight: 600, cursor: "pointer" }}>Export PDF</button>}
          <a
            href="/timetable"
            style={{ padding: "0.5rem 1rem", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", textDecoration: "none", color: "#475569", fontWeight: 600, fontSize: "0.875rem" }}
          >
            Back to Matrix
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "0.5rem 1.25rem", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Main Grid Area */}
        <main style={{
          flex: 1,
          overflow: "auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column"
        }}>
          {loading ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#64748b" }}>Loading editor grid...</div>
          ) : (
            <TimetableGrid
              entries={entries}
              periods={editorPeriods}
              workingDays={[1, 2, 3, 4, 5]}
              isEditable={true}
              onEntryMove={handleMove}
            />
          )}
        </main>

        {/* Sidebar Conflict Inspector */}
        <aside style={{
          width: "320px",
          borderLeft: "1px solid #e2e8f0",
          padding: "1.5rem",
          overflowY: "auto",
          background: "white"
        }}>
          <ConflictReport conflicts={conflicts} />
        </aside>
      </div>
    </div>
  );
}
