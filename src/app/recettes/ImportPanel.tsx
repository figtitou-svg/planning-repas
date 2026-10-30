"use client";

import { useRef, useState } from "react";
import type { ImportResponse } from "@/lib/importDraft";

const GENERIC_ERROR = "L'import a échoué, réessayez";
const MAX_VIDEO_MB = 50;

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

  async function send(request: () => Promise<Response>, onDone: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await request();
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
      onDone();
    } catch {
      setError("Impossible de joindre le serveur, réessayez");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (value === "") return;
    void send(
      () =>
        fetch("/api/import/recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(/^https?:\/\//i.test(value) ? { url: value } : { text: value }),
        }),
      () => setInput("")
    );
  }

  function handleVideo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Vidéo trop lourde (${MAX_VIDEO_MB} Mo maximum)`);
      return;
    }
    const form = new FormData();
    form.set("video", file);
    void send(
      () => fetch("/api/import/video", { method: "POST", body: form }),
      () => {}
    );
  }

  return (
    <form onSubmit={handleSubmit} className="import-panel" aria-busy={loading}>
      <div className="field">
        <label htmlFor="import-input">Lien TikTok, Instagram ou texte de la recette</label>
        <textarea
          id="import-input"
          rows={3}
          placeholder="Lien TikTok ou Instagram (Reel), ou collez la description de la recette"
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
      <div className="field">
        <label htmlFor="import-video">
          Ou envoyez la vidéo : la voix, le texte à l'écran et les images sont analysés
        </label>
        <input
          id="import-video"
          type="file"
          accept="video/*"
          disabled={loading}
          onChange={handleVideo}
        />
        <p className="form-note">
          Enregistrez d'abord la vidéo TikTok ou Instagram sur votre téléphone (50 Mo maximum).
          L'analyse peut prendre une minute.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
