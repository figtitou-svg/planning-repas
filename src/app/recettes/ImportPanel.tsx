"use client";

import { useRef, useState } from "react";
import type { ImportResponse } from "@/lib/importDraft";

const GENERIC_ERROR = "L'import a échoué, réessayez";

function isImportResponse(body: unknown): body is ImportResponse {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Partial<ImportResponse>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.portions === "number" &&
    Array.isArray(candidate.matched) &&
    Array.isArray(candidate.created)
  );
}

export function ImportPanel({
  onImported,
}: {
  onImported: (result: ImportResponse) => void | Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (value === "" || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/import/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(/^https?:\/\//i.test(value) ? { url: value } : { text: value }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : GENERIC_ERROR);
        return;
      }
      if (!isImportResponse(body)) {
        setError(GENERIC_ERROR);
        return;
      }
      await onImported(body);
      setInput("");
    } catch {
      setError("Impossible de joindre le serveur, réessayez");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="import-panel" aria-busy={loading}>
      <div className="field">
        <label htmlFor="import-input">Lien TikTok ou texte de la recette</label>
        <textarea
          id="import-input"
          rows={3}
          placeholder="https://www.tiktok.com/… ou collez la description de la recette"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>
      <div className="form-actions">
        <button type="submit" disabled={loading || input.trim() === ""}>
          {loading ? "Analyse de la recette…" : "Importer"}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
