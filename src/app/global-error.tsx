"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("=== GLOBAL ERROR ===", error);
  }, [error]);

  return (
    <html>
      <body style={{ padding: 40, fontFamily: "monospace", background: "#ffe6e6", minHeight: "100vh", margin: 0 }}>
        <h1 style={{ color: "#900", fontSize: 24, marginBottom: 16 }}>
          Erreur globale (root)
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
            border: "1px solid #e66",
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
      </body>
    </html>
  );
}
