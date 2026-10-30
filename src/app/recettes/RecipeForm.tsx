"use client";

import { useRef, useState } from "react";
import type { Ingredient, Recipe, RecipeIngredient } from "@/lib/types";
import { packageLabel } from "@/lib/packageHint";
import type { NewIngredientDraft, RecipeDraft } from "@/lib/importDraft";
import { createPendingIngredients } from "@/lib/createPendingIngredients";
import { checkNewIngredientName } from "@/lib/newIngredientCheck";
import { IngredientRow } from "./IngredientRow";
import { NewIngredientRow } from "./NewIngredientRow";

export interface RecipeFormValues {
  name: string;
  portions: number;
  ingredients: RecipeIngredient[];
  /** Absent quand les instructions n'ont pas pu être chargées : on ne touche alors pas à celles de Notion. */
  steps?: string[];
}

function parseSteps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:\d+\s*[.)]|[-*•])\s*/, "").trim())
    .filter((line) => line !== "");
}

export function RecipeForm({
  catalog,
  initial,
  draft,
  onSubmit,
  onCancel,
  createIngredient,
}: {
  catalog: Ingredient[];
  initial?: Recipe;
  draft?: RecipeDraft;
  onSubmit: (values: RecipeFormValues) => Promise<void>;
  onCancel?: () => void;
  createIngredient: (draft: NewIngredientDraft) => Promise<Ingredient>;
}) {
  const [name, setName] = useState(initial?.name ?? draft?.name ?? "");
  const [portionsDraft, setPortionsDraft] = useState(
    String(initial?.portions ?? draft?.portions ?? 2)
  );
  const [rows, setRows] = useState<RecipeIngredient[]>(
    initial?.ingredients ?? draft?.ingredients ?? []
  );
  const [newIngredients, setNewIngredients] = useState<NewIngredientDraft[]>(
    draft?.newIngredients ?? []
  );
  // Sans liste d'étapes connue (recette existante dont le chargement a échoué), le champ est masqué.
  const initialSteps = initial ? initial.steps : draft?.steps ?? [];
  const stepsEditable = initialSteps !== undefined;
  const [stepsText, setStepsText] = useState((initialSteps ?? []).join("\n"));
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unitMismatchIds = draft?.unitMismatchIds ?? [];

  function normalizePortions(text: string): number {
    const value = Number(text);
    return Number.isFinite(value) && value >= 1 ? Math.round(value) : 1;
  }

  function isChecked(ingredientId: string): boolean {
    return rows.some((row) => row.ingredientId === ingredientId);
  }

  function toggle(ingredientId: string) {
    setRows((current) =>
      current.some((row) => row.ingredientId === ingredientId)
        ? current.filter((row) => row.ingredientId !== ingredientId)
        : [...current, { ingredientId, quantity: 0 }]
    );
  }

  function updateQuantity(ingredientId: string, quantity: number) {
    setRows((current) =>
      current.map((row) => (row.ingredientId === ingredientId ? { ...row, quantity } : row))
    );
  }

  function ingredientOf(id: string): Ingredient | undefined {
    return catalog.find((i) => i.id === id);
  }

  const filtered = catalog.filter((ing) =>
    ing.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const check = checkNewIngredientName(search, catalog, newIngredients);
  const hasHint = check.kind === "exists" || check.kind === "pending" || check.kind === "invalid";

  function addNewIngredient() {
    if (check.kind !== "ok") return;
    setNewIngredients((current) => [...current, { name: check.name, unit: "g", quantity: 0 }]);
    setSearch("");
    searchRef.current?.focus();
  }

  function updateNewIngredient(index: number, next: NewIngredientDraft) {
    setNewIngredients((current) => current.map((item, i) => (i === index ? next : item)));
  }

  function removeNewIngredient(index: number) {
    setNewIngredients((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (check.kind === "ok") {
      setError(
        `Ajoutez « ${check.name} » avec le bouton + (ou effacez le champ) avant d'enregistrer`
      );
      searchRef.current?.focus();
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const portions = normalizePortions(portionsDraft);
      setPortionsDraft(String(portions));

      const result = await createPendingIngredients({
        rows,
        pending: newIngredients,
        createFn: createIngredient,
        onProgress: (nextRows, nextPending) => {
          setRows(nextRows);
          setNewIngredients(nextPending);
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      try {
        await onSubmit({
          name,
          portions,
          ingredients: result.rows,
          ...(stepsEditable ? { steps: parseSteps(stepsText) } : {}),
        });
      } catch {
        setError("Impossible d'enregistrer la recette, réessayez");
        return;
      }
      if (!initial) {
        setName("");
        setPortionsDraft("2");
        setRows([]);
        setNewIngredients([]);
        setStepsText("");
        setSearch("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="recipe-form">
      <fieldset className="form-fieldset" disabled={saving}>
        <div className="field">
          <label htmlFor="recipe-name">Nom de la recette</label>
          <input
            id="recipe-name"
            required
            placeholder="Crêpes"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="recipe-portions">Portions</label>
          <input
            id="recipe-portions"
            required
            type="number"
            min="1"
            step="1"
            value={portionsDraft}
            onChange={(e) => setPortionsDraft(e.target.value)}
            onBlur={() => setPortionsDraft(String(normalizePortions(portionsDraft)))}
          />
        </div>

        <div className="field">
          <label htmlFor="recipe-ingredient-search">Ingrédients</label>
          <input
            id="recipe-ingredient-search"
            ref={searchRef}
            type="text"
            placeholder="Rechercher un ingrédient…"
            value={search}
            aria-describedby={hasHint ? "recipe-ingredient-hint" : undefined}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              addNewIngredient();
            }}
          />
          <ul className="check-list">
            {filtered.length === 0 && <li className="combobox-empty">Aucun résultat</li>}
            {filtered.map((ing) => (
              <li key={ing.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked(ing.id)}
                    onChange={() => toggle(ing.id)}
                  />
                  <span className="check-list-name">{ing.name}</span>
                  {packageLabel(ing) && (
                    <span className="package-hint">{packageLabel(ing)}</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          {check.kind === "ok" && (
            <button type="button" className="add-new-ingredient" onClick={addNewIngredient}>
              + Ajouter « {check.name} » comme nouvel ingrédient
            </button>
          )}
          {check.kind === "exists" && (
            <p id="recipe-ingredient-hint" className="form-note new-ingredient-hint">
              {isChecked(check.ingredient.id)
                ? `« ${check.ingredient.name} » est déjà dans la recette`
                : `« ${check.ingredient.name} » existe déjà — cochez-le dans la liste`}
            </p>
          )}
          {check.kind === "pending" && (
            <p id="recipe-ingredient-hint" className="form-note new-ingredient-hint">
              Déjà ajouté dans les nouveaux ingrédients
            </p>
          )}
          {check.kind === "invalid" && (
            <p id="recipe-ingredient-hint" className="row-warning new-ingredient-hint">
              {check.message}
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <div className="field">
            <label>Quantités</label>
            <ul className="selected-ingredients">
              {rows.map((row) => (
                <IngredientRow
                  key={row.ingredientId}
                  ingredient={ingredientOf(row.ingredientId)}
                  quantity={row.quantity}
                  onQuantityChange={(quantity) => updateQuantity(row.ingredientId, quantity)}
                  onRemove={() => toggle(row.ingredientId)}
                  warning={
                    unitMismatchIds.includes(row.ingredientId)
                      ? "unité différente du catalogue — vérifiez la quantité"
                      : undefined
                  }
                />
              ))}
            </ul>
          </div>
        )}

        {newIngredients.length > 0 && (
          <div className="field">
            <label>Nouveaux ingrédients</label>
            <p className="form-note">
              Ces ingrédients seront ajoutés au catalogue, à compléter dans Notion (conditionnement,
              prix, conservation).
            </p>
            <ul className="selected-ingredients">
              {newIngredients.map((item, index) => (
                <NewIngredientRow
                  key={index}
                  index={index}
                  draft={item}
                  onChange={(next) => updateNewIngredient(index, next)}
                  onRemove={() => removeNewIngredient(index)}
                />
              ))}
            </ul>
          </div>
        )}

        {stepsEditable && (
          <div className="field">
            <label htmlFor="recipe-steps">Instructions (une étape par ligne)</label>
            <textarea
              id="recipe-steps"
              rows={6}
              placeholder="Cuire les pâtes&#10;Ajouter la sauce"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" disabled={saving || rows.length + newIngredients.length === 0}>
            {initial ? "Enregistrer" : "Ajouter la recette"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Annuler
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
