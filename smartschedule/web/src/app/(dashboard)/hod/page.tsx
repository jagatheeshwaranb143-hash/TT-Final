"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarCheck2,
  GraduationCap,
  LayoutGrid,
  RefreshCw,
  Users,
  WandSparkles,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const hodWorkflow = [
  {
    title: "Manage faculty",
    text: "Review teaching staff qualifications and subject assignments.",
    href: "/faculty",
  },
  {
    title: "Configure subjects",
    text: "Add or update curriculum subjects and link them to faculty.",
    href: "/subjects",
  },
  {
    title: "Set up classes",
    text: "Define class sections and assign the subject curriculum.",
    href: "/classes",
  },
  {
    title: "Generate timetable",
    text: "Run the CP-SAT solver to produce a conflict-free schedule.",
    href: "/timetable/generate",
  },
];

interface HodStats {
  departmentId: string | null;
  departmentName: string;
  facultyCount: number;
  subjectsCount: number;
  classesCount: number;
  entriesCount: number;
  isPublished: boolean;
}

export default function HodDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<HodStats | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const canSwitchDepartment = user?.role === "super_admin";

  const loadDepartments = async () => {
    if (!canSwitchDepartment) return;
    try {
      const list = (await api.departments.list()) as any[];
      const depts = (Array.isArray(list) ? list : []).filter(
        (d) => (d.department_type || "department") !== "lab"
      );
      setDepartments(depts);
    } catch {
      // Non-blocking
    }
  };

  const loadStats = async (deptId?: string) => {
    setLoading(true);
    setError(false);
    try {
      const stats = (await api.analytics.workload(deptId)) as HodStats;
      setData(stats);
      if (stats.departmentId && !selectedDeptId) {
        setSelectedDeptId(stats.departmentId);
      }
    } catch (e: any) {
      setError(true);
      toast.error(e?.message || "Could not load department data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeptChange = (deptId: string) => {
    setSelectedDeptId(deptId);
    loadStats(deptId);
  };

  const deptName = data?.departmentName || "Your Department";

  const cards = [
    {
      label: "Classes",
      value: data?.classesCount ?? 0,
      href: "/classes",
      icon: GraduationCap,
      tone: "teal",
    },
    {
      label: "Faculty members",
      value: data?.facultyCount ?? 0,
      href: "/faculty",
      icon: Users,
      tone: "violet",
    },
    {
      label: "Course subjects",
      value: data?.subjectsCount ?? 0,
      href: "/subjects",
      icon: BookOpen,
      tone: "amber",
    },
    {
      label: "Scheduled periods",
      value: data?.entriesCount ?? 0,
      href: "/timetable",
      icon: CalendarCheck2,
      tone: "blue",
    },
  ];

  return (
    <div className="overview-page">
      {/* Super-admin department context switcher */}
      {canSwitchDepartment && departments.length > 0 && (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "14px 20px",
            marginBottom: 20,
            borderRadius: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Building2 size={18} style={{ color: "var(--color-primary)" }} />
            <div>
              <strong style={{ fontSize: 13, display: "block" }}>
                Active Department View
              </strong>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                Viewing analytics as institutional administrator
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              htmlFor="hod-dept-switcher"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}
            >
              Switch department:
            </label>
            <select
              id="hod-dept-switcher"
              className="form-input"
              value={selectedDeptId}
              onChange={(e) => handleDeptChange(e.target.value)}
              style={{ minWidth: 220, padding: "7px 12px", fontSize: 13 }}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Empty State when no departments exist */}
      {!loading && !data?.departmentId && !departments.length ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Building2 size={28} />
          </div>
          <h2 className="empty-state-title">No Academic Department Found</h2>
          <p className="empty-state-desc">
            To view department metrics and manage curriculum schedules, please
            create an academic department first.
          </p>
          <Link href="/departments" className="btn btn-primary">
            Create Department
          </Link>
        </div>
      ) : (
        <>
          {/* Hero banner */}
          <section className="overview-hero">
            <div className="hero-copy">
              <div className="hero-kicker">
                <Building2 size={15} /> Department Dashboard
              </div>
              <h1>
                {deptName}
                <br />
                <span>Department Overview</span>
              </h1>
              <p>
                Manage your department&apos;s faculty, curriculum, and class
                schedules from one unified workspace.
              </p>
              <div className="hero-actions">
                <Link className="hero-primary" href="/timetable/generate">
                  <WandSparkles size={18} /> Generate timetable
                </Link>
                <Link className="hero-secondary" href="/timetable">
                  Open master grid <ArrowRight size={17} />
                </Link>
              </div>
            </div>
            <div className="hero-health">
              <div className="health-ring">
                <LayoutGrid size={31} />
                <strong>
                  {loading ? "—" : (data?.entriesCount ?? 0).toLocaleString()}
                </strong>
                <span>
                  {data?.isPublished ? "periods scheduled" : "no schedule yet"}
                </span>
              </div>
              <p>
                <i />
                {data?.isPublished ? "Live schedule active" : "Awaiting generation"}
              </p>
            </div>
          </section>

          {/* Error alert */}
          {error && (
            <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>
              Department data could not be loaded.{" "}
              <button className="inline-action" onClick={() => loadStats(selectedDeptId)}>
                <RefreshCw size={13} /> Try again
              </button>
            </div>
          )}

          {/* Stat cards */}
          <section className="overview-stats" aria-label="Department summary">
            {cards.map(({ label, value, href, icon: Icon, tone }) => (
              <Link href={href} className="overview-stat" key={label}>
                <div className={`stat-symbol ${tone}`}>
                  <Icon size={21} />
                </div>
                <div>
                  <span>{label}</span>
                  <strong>
                    {loading ? <i className="mini-skeleton" /> : value.toLocaleString()}
                  </strong>
                </div>
                <ArrowRight className="stat-arrow" size={17} />
              </Link>
            ))}
          </section>

          {/* Workflow guide */}
          <section className="workflow-panel">
            <div className="panel-heading">
              <div>
                <span>Recommended workflow</span>
                <h2>From setup to a finished timetable</h2>
              </div>
              <p>Complete these steps in order for the strongest generation result.</p>
            </div>
            <div className="workflow-grid">
              {hodWorkflow.map((step, index) => (
                <Link href={step.href} className="workflow-step" key={step.title}>
                  <span className="step-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <span className="step-link">
                    Continue <ArrowRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
