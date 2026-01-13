import React from "react";

export default function PdfGenerator({ disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "12px 16px",
        fontSize: "16px",
        borderRadius: "6px",
        border: "none",
        background: disabled ? "#9ca3af" : "#16a34a",
        color: "white",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      Generate PDF
    </button>
  );
}
