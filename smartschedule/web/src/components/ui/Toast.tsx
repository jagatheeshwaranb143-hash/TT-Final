"use client";
import React from "react";

export default function Toast({ message, type }: { message: string, type: "success" | "error" | "info" | "warning" }) {
  const colors = {
    success: "var(--success)",
    error: "var(--danger)",
    info: "var(--primary)",
    warning: "var(--warning)"
  };
  
  return (
    <div style={{
      position: "fixed",
      top: "1rem",
      right: "1rem",
      padding: "1rem",
      backgroundColor: colors[type],
      color: "white",
      borderRadius: "4px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      zIndex: 9999
    }}>
      {message}
    </div>
  );
}
