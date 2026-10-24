"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { flushPendingChecks } from "@/lib/flushPendingChecks";
import { putCheck } from "@/app/courses/useCheckQueue";

// Posé quand le foyer a été confirmé dans cette session (onglet ou appli installée) : l'écran de
// choix revient donc à chaque nouvelle ouverture de l'appli, mais pas à chaque page.
const CONFIRMED_KEY = "planning-repas:household-confirmed";

function readConfirmed(): boolean {
  try {
    return window.sessionStorage.getItem(CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}

function markConfirmed(): void {
  try {
    window.sessionStorage.setItem(CONFIRMED_KEY, "1");
  } catch {
    // Stockage indisponible : l'écran de choix reviendra au prochain chargement.
  }
}

interface Option {
  id: string;
  label: string;
}

export function HouseholdSwitcher() {
  const [current, setCurrent] = useState<string | null>(null);
  const [chosen, setChosen] = useState(true);
  const [confirmed, setConfirmed] = useState(true);
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/household", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { household: string; chosen: boolean; households: Option[] }) => {
        setCurrent(data.household);
        setChosen(data.chosen);
        setConfirmed(readConfirmed());
        setOptions(data.households);
      })
      .catch(() => {
        // Sans le sélecteur, l'appli reste utilisable sur le foyer par défaut.
      });
  }, []);

  async function choose(id: string) {
    setMessage(null);
    // Les coches hors-ligne ne connaissent pas leur foyer : on les envoie AVANT de changer de
    // cookie, sinon elles partiraient dans la liste de courses de l'autre foyer.
    try {
      if ((await flushPendingChecks(window.localStorage, putCheck)) > 0) {
        setMessage("Coches en attente : réessayez avec du réseau.");
        return;
      }
    } catch {
      // Stockage indisponible : il n'y a pas de file à envoyer.
    }
    const res = await fetch("/api/household", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ household: id }),
    });
    if (!res.ok) return;
    markConfirmed();
    // Le service worker garde les réponses d'API par URL seule : celles de l'ancien foyer
    // seraient resservies au nouveau.
    try {
      for (const name of await caches.keys()) {
        if (name.startsWith("runtime-")) await caches.delete(name);
      }
    } catch {
      // Cache API indisponible : rien à purger.
    }
    // Toutes les données affichées dépendent du foyer : on repart d'une page propre.
    window.location.reload();
  }

  if (!current) return null;
  const currentLabel = options.find((option) => option.id === current)?.label ?? "Foyer";
  // À chaque ouverture de l'appli, le foyer doit être (re)confirmé avant d'afficher les données.
  const picking = !confirmed || open;
  return (
    <>
      <button type="button" className="household-switcher" onClick={() => setOpen(true)}>
        {currentLabel}
      </button>
      {/* Hors de la barre du haut : son flou (backdrop-filter) y piégerait le plein écran. */}
      {picking && createPortal(
        <div className="household-picker" role="dialog" aria-modal="true" aria-labelledby="household-picker-title">
          <h2 id="household-picker-title">Qui est-ce ?</h2>
          <div className="household-picker-choices">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="household-picker-choice"
                aria-current={chosen && option.id === current ? "true" : undefined}
                onClick={() => {
                  if (chosen && option.id === current) {
                    // Même foyer : rien à recharger, on confirme simplement.
                    markConfirmed();
                    setConfirmed(true);
                    setOpen(false);
                  } else {
                    choose(option.id);
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {message && <p role="status">{message}</p>}
          {confirmed && (
            <button type="button" className="household-picker-close" onClick={() => setOpen(false)}>
              Annuler
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
