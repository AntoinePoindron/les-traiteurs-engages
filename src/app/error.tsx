"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("=== APP ERROR ===", error);
  }, [error]);

  return (
    <div style={{ padding: 40, fontFamily: "monospace", background: "#fffbe6", minHeight: "100vh" }}>
      <h1 style={{ color: "#b06000", fontSize: 24, marginBottom: 16 }}>
        Erreur (app level)
      </h1>
      <p style={{ marginBottom: 8 }}>
        <strong>Message :</strong> {error.message || "(aucun message)"}
      </p>
      {error.digest && (
        <p style={{ marginBottom: 8 }}>
          <strong>Digest :</strong> {error.digest}
        </p>
      )}
      <pre
        style={{
          background: "#fff",
          padding: 16,
          border: "1px solid #e6c060",
          marginTop: 16,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 400,
          overflow: "auto",
        }}
      >
        {error.stack || "(aucun stack)"}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          background: "#1A3A52",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
