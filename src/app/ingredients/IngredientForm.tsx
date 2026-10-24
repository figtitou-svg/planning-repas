// src/app/ingredients/IngredientForm.tsx
"use client";

import { useState } from "react";
import type { Ingredient, Unit } from "@/lib/types";

const UNITS: Unit[] = ["g", "mL", "pièce"];

// Doit rester synchronisé avec les options du Select "Catégorie" créées dans Notion
// — un texte libre ici
// casserait silencieusement le regroupement par rayon de la liste de courses.
const CATEGORIES = [
  "Fruits & Légumes",
  "Boucherie & Poissonnerie",
  "Produits laitiers",
  "Surgelés",
  "Épicerie",
  "Boissons",
  "Hygiène/Entretien",
  "Autre",
];

export interface IngredientFormValues {
  name: string;
  unit: Unit;
  packageSize: number;
  packagePrice: number;
  shelfLifeDays: number;
  category: string;
}

const EMPTY_VALUES: IngredientFormValues = {
  name: "",
  unit: "g",
  packageSize: 0,
  packagePrice: 0,
  shelfLifeDays: 0,
  category: CATEGORIES[0],
};

export function IngredientForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Ingredient;
  onSubmit: (values: IngredientFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<IngredientFormValues>(initial ?? EMPTY_VALUES);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
      if (!initial) setValues(EMPTY_VALUES);
    } catch {
      // L'échec est déjà signalé par la page (toast) ; on garde la saisie.
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ingredient-form">
      <div className="field">
        <label htmlFor="ing-name">Nom</label>
        <input
          id="ing-name"
          required
          placeholder="Farine"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
      </div>

      <div className="form-row form-row-2">
        <div className="field">
          <label htmlFor="ing-unit">Unité</label>
          <select
            id="ing-unit"
            value={values.unit}
            onChange={(e) => setValues({ ...values, unit: e.target.value as Unit })}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ing-category">Catégorie</label>
          <select
            id="ing-category"
            value={values.category || CATEGORIES[0]}
            onChange={(e) => setValues({ ...values, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="field">
          <label htmlFor="ing-package-size">Taille du paquet</label>
          <input
            id="ing-package-size"
            required
            type="number"
            step="any"
            min="0.01"
            value={values.packageSize}
            onChange={(e) => setValues({ ...values, packageSize: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="ing-package-price">Prix du paquet (€)</label>
          <input
            id="ing-package-price"
            required
            type="number"
            step="0.01"
            min="0"
            value={values.packagePrice}
            onChange={(e) => setValues({ ...values, packagePrice: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="ing-shelf-life">Durée de conservation (jours)</label>
        <input
          id="ing-shelf-life"
          required
          type="number"
          min="0"
          value={values.shelfLifeDays}
          onChange={(e) => setValues({ ...values, shelfLifeDays: Number(e.target.value) })}
        />
      </div>

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {initial ? "Enregistrer" : "Ajouter"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
