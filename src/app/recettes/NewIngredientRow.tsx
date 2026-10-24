"use client";

import type { Unit } from "@/lib/types";
import { Icon } from "../Icon";
import { MAX_INGREDIENT_NAME_LENGTH, type NewIngredientDraft } from "@/lib/importDraft";

const UNITS: Unit[] = ["g", "mL", "pièce"];

export function NewIngredientRow({
  index,
  draft,
  onChange,
  onRemove,
}: {
  index: number;
  draft: NewIngredientDraft;
  onChange: (draft: NewIngredientDraft) => void;
  onRemove: () => void;
}) {
  const label = draft.name.trim() || `nouvel ingrédient ${index + 1}`;

  return (
    <li className="selected-ingredient-row new-ingredient-row">
      <input
        required
        className="new-ingredient-name"
        type="text"
        maxLength={MAX_INGREDIENT_NAME_LENGTH}
        aria-label={`Nom du nouvel ingrédient ${index + 1}`}
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
      />
      <input
        required
        type="number"
        step="any"
        min="0"
        placeholder="Qté"
        aria-label={`Quantité de ${label}`}
        value={draft.quantity}
        onChange={(e) => onChange({ ...draft, quantity: Number(e.target.value) })}
      />
      <select
        className="selected-ingredient-unit-select"
        aria-label={`Unité de ${label}`}
        value={draft.unit}
        onChange={(e) => onChange({ ...draft, unit: e.target.value as Unit })}
      >
        {UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-sm icon-btn btn-danger-ghost"
        onClick={onRemove}
        aria-label={`Retirer ${label}`}
      >
        <Icon name="x" />
      </button>
      {draft.unitMismatch && (
        <span className="row-warning">unité différente dans la recette — vérifiez la quantité</span>
      )}
    </li>
  );
}
