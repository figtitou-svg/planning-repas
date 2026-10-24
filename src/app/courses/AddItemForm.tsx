"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { Ingredient, Unit } from "@/lib/types";
import { normalizeName } from "@/lib/matchIngredients";
import { checkNewIngredientName } from "@/lib/newIngredientCheck";
import { parseExtraItem } from "@/lib/parseExtraItem";
import { formatAmount } from "@/lib/formatQuantity";
import { Icon } from "../Icon";

const MAX_SUGGESTIONS = 5;

// Un article désigné par son id (suggestion choisie) ou par son nom, avec la quantité tapée
// (« 2 kg riz » → 2000 g) dans l'unité du catalogue.
export interface AddTarget {
  ingredientId?: string;
  name: string;
  quantity?: number;
  unit?: Unit;
}
export interface AddNotice {
  text: string;
  error: boolean;
}

// Ligne « à écrire » en haut du ticket : on tape un article (avec sa quantité si on veut :
// « 2 kg riz », « 6 œufs »), on choisit une suggestion du catalogue ou on valide tel quel
// (un nom inconnu est alors créé dans Notion).
export function AddItemForm({ onAdd }: { onAdd: (target: AddTarget) => Promise<AddNotice> }) {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Ingredient[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<AddNotice | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = useRef(false);
  const listId = useId();

  // Le catalogue n'est chargé qu'au premier passage dans le champ : la plupart des visites
  // à la liste n'ajoutent rien.
  async function loadCatalog() {
    if (catalog || loading.current) return;
    loading.current = true;
    try {
      const response = await fetch("/api/ingredients");
      if (response.ok) setCatalog(await response.json());
    } catch {
      // Sans catalogue : pas de suggestions, mais l'ajout par nom reste possible.
    } finally {
      loading.current = false;
    }
  }

  const parsed = parseExtraItem(query);
  const trimmed = parsed.name;
  const key = normalizeName(trimmed);
  // Seulement si un nombre a été reconnu : les champs restent absents sinon.
  const typedQuantity =
    parsed.quantity !== null && parsed.unit !== null ? { quantity: parsed.quantity, unit: parsed.unit } : {};
  const suggestions =
    catalog && key
      ? catalog
          .filter((ingredient) => normalizeName(ingredient.name).includes(key))
          .slice(0, MAX_SUGGESTIONS)
      : [];
  const check = catalog ? checkNewIngredientName(trimmed, catalog, []) : null;
  const amountLabel =
    parsed.quantity !== null && parsed.unit !== null ? ` (${formatAmount(parsed.quantity, parsed.unit)})` : "";

  async function submit(target: AddTarget) {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    const result = await onAdd(target);
    setNotice(result);
    if (!result.error) setQuery("");
    setBusy(false);
    // On enchaîne souvent plusieurs articles : le champ reste prêt.
    inputRef.current?.focus();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmed === "") {
      setNotice({ text: "Tapez le nom d'un article", error: true });
      return;
    }
    // Le nom tapé correspond à une suggestion : on la prend, pour viser le bon ingrédient.
    const exact = catalog?.find((ingredient) => normalizeName(ingredient.name) === key);
    submit(
      exact
        ? { ingredientId: exact.id, name: exact.name, ...typedQuantity }
        : { name: trimmed, ...typedQuantity }
    );
  }

  return (
    <div
      className="ticket-add"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="ticket-add-row">
          <div className="ticket-add-field">
            <Icon name="plus" className="ticket-add-icon" />
            <input
              ref={inputRef}
              className="ticket-add-input"
              type="text"
              role="combobox"
              aria-label="Ajouter un article"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              placeholder="Ajouter un article"
              autoComplete="off"
              enterKeyHint="done"
              value={query}
              disabled={busy}
              onFocus={() => {
                setOpen(true);
                loadCatalog();
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setNotice(null);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <button type="submit" className="btn-sm" disabled={busy}>
            {busy ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </form>

      {open && suggestions.length > 0 && (
        // preventDefault : le champ garde le focus pendant le toucher, sinon la liste
        // se ferme avant que le clic n'arrive.
        <ul
          id={listId}
          className="combobox-results ticket-add-results"
          onMouseDown={(event) => event.preventDefault()}
        >
          {suggestions.map((ingredient) => (
            <li key={ingredient.id}>
              <button
                type="button"
                onClick={() =>
                  submit({ ingredientId: ingredient.id, name: ingredient.name, ...typedQuantity })
                }
              >
                {ingredient.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {check?.kind === "ok" && !notice && (
        <p className="ticket-add-hint">
          {suggestions.length > 0
            ? `Ou ajouter « ${check.name} »${amountLabel} tel quel : il sera créé dans Notion.`
            : `« ${check.name} »${amountLabel} n'est pas dans le catalogue : il sera créé dans Notion, à compléter ensuite.`}
        </p>
      )}
      {/* La zone « status » existe avant son contenu : c'est ce qui la fait annoncer. */}
      <p className="ticket-add-notice" role="status">
        {notice && !notice.error ? notice.text : ""}
      </p>
      {notice?.error && (
        <p className="ticket-add-notice is-error" role="alert">
          {notice.text}
        </p>
      )}
    </div>
  );
}
