"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function HodDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const stats = await api.dashboard.getHodStats();
        setData(stats);
      } catch(e) {
        console.error(e);
      }
    }
    load();
  }, []);

  if (!data) return <div>Loading Dashboard...</div>;

  return (
    <div style={{ padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>{data.departmentName} Department</h1>
        <button style={{ padding: "0.75rem 1.5rem", backgroundColor: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
          🚀 Generate Timetable
        </button>
      </header>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
          <h3>Classes</h3><p style={{ fontSize: "2rem" }}>{data.classesCount}</p>
        </div>
        <div style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
          <h3>Faculty</h3><p style={{ fontSize: "2rem" }}>{data.facultyCount}</p>
        </div>
        <div style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
          <h3>Subjects</h3><p style={{ fontSize: "2rem" }}>{data.subjectsCount}</p>
        </div>
        <div style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
          <h3>Status</h3><p style={{ fontSize: "1.5rem", color: data.isPublished ? "var(--success)" : "var(--warning)" }}>{data.isPublished ? "Published" : "Draft"}</p>
        </div>
      </div>
    </div>
  );
}
