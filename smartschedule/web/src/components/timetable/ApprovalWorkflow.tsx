import React from "react";

export default function ApprovalWorkflow({ currentStep }: { currentStep: string }) {
  const steps = ["Generated", "Reviewed", "HOD Approved", "Principal Approved", "Published", "Locked"];
  return (
    <div style={{ display: "flex", gap: "1rem", overflowX: "auto", padding: "1rem" }}>
      {steps.map((step, index) => (
        <div key={index} style={{ padding: "0.5rem 1rem", borderRadius: "20px", backgroundColor: currentStep === step ? "var(--primary)" : "var(--bg-card)", color: currentStep === step ? "white" : "var(--text-primary)", border: "1px solid var(--border-color)", whiteSpace: "nowrap" }}>
          {step}
        </div>
      ))}
    </div>
  );
}
