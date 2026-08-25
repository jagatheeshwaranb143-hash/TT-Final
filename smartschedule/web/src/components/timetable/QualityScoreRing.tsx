import React from "react";

export default function QualityScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? "var(--success)" : score >= 75 ? "var(--primary)" : score >= 60 ? "var(--warning)" : "var(--danger)";
  return (
    <div style={{ width: "120px", height: "120px", borderRadius: "50%", border: `8px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: "bold", color }}>
      {score}%
    </div>
  );
}
