"use client";

import { useEffect, useRef, useState } from "react";
import type { Ingredient, Recipe } from "@/lib/types";
import { formatPrice } from "@/lib/formatPrice";
import { recipeCost } from "@/lib/recipeCost";
import { Icon } from "../Icon";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function SchedulePopup({
  recipe,
  catalog,
  onConfirm,
  onCancel,
}: {
  recipe: Recipe;
  catalog: Ingredient[];
  onConfirm: (portions: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [portions, setPortions] = useState(Math.max(1, recipe.portions));
  const [saving, setSaving] = useState(false);
  const cost = recipeCost(recipe, catalog);
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const pressStartedOnOverlay = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!savingRef.current) onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active) || active === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function cancel() {
    if (!savingRef.current) onCancel();
  }

  async function handleConfirm() {
    savingRef.current = true;
    setSaving(true);
    try {
      await onConfirm(portions);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onPointerDown={(e) => {
        pressStartedOnOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressStartedOnOverlay.current && e.target === e.currentTarget) cancel();
        pressStartedOnOverlay.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-popup-title"
        tabIndex={-1}
      >
        <h2 id="schedule-popup-title">{recipe.name}</h2>
        <p className="card-meta">Portions pour la semaine prochaine</p>
        <div className="stepper">
          <button
            type="button"
            aria-label="Moins de portions"
            disabled={portions <= 1}
            onClick={() => setPortions((p) => Math.max(1, p - 1))}
          >
            <Icon name="minus" />
          </button>
          <span className="stepper-value" aria-live="polite">
            {portions}
          </span>
          <button
            type="button"
            aria-label="Plus de portions"
            onClick={() => setPortions((p) => p + 1)}
          >
            <Icon name="plus" />
          </button>
        </div>
        {cost && (
          <p className="card-meta schedule-cost" aria-live="polite">
            {cost.complete ? "≈" : "~"} {formatPrice(cost.perPortion * portions)} pour {portions}{" "}
            portion{portions > 1 ? "s" : ""}
            {!cost.complete && " (prix incomplets)"}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn-primary" disabled={saving} onClick={handleConfirm}>
            Programmer
          </button>
          <button type="button" disabled={saving} onClick={cancel}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
