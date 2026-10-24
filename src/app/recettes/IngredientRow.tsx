"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/types";
import { Icon } from "../Icon";
import {
  formatQuantity,
  packageLabel,
  packagesToQuantity,
  quantityInPackages,
  quantityToPackages,
} from "@/lib/packageHint";

type InputMode = "unit" | "package";

// One selected ingredient in the recipe form. The quantity is always reported
// (and stored) in the ingredient's base unit; "paquet" is only an input mode.
export function IngredientRow({
  ingredient,
  quantity,
  onQuantityChange,
  onRemove,
  warning,
}: {
  ingredient: Ingredient | undefined;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  warning?: string;
}) {
  const [mode, setMode] = useState<InputMode>("unit");
  // Text typed in package mode. Kept as a string so "0." or "1," survive
  // while the user is still typing (a controlled number input would eat them).
  const [packageDraft, setPackageDraft] = useState("");

  const packageSize = ingredient?.packageSize ?? 0;
  const canUsePackages = packageSize > 0;
  const inPackageMode = canUsePackages && mode === "package";

  function switchMode(next: InputMode) {
    if (next === "package") {
      setPackageDraft(quantity > 0 ? String(quantityToPackages(quantity, packageSize)) : "");
    }
    setMode(next);
  }

  function handlePackageChange(text: string) {
    setPackageDraft(text);
    const packages = Number(text);
    if (text.trim() === "") {
      onQuantityChange(0);
    } else if (Number.isFinite(packages) && packages >= 0) {
      onQuantityChange(packagesToQuantity(packages, packageSize));
    }
  }

  const label = ingredient ? packageLabel(ingredient) : null;
  const equivalent = !ingredient
    ? null
    : inPackageMode
      ? quantity > 0
        ? `= ${formatQuantity(quantity, ingredient.unit)}`
        : null
      : quantityInPackages(quantity, packageSize);

  return (
    <li className="selected-ingredient-row">
      <div className="selected-ingredient-main">
        <span className="selected-ingredient-name">
          {ingredient?.name ?? "(ingrédient supprimé)"}
        </span>
        {(label || equivalent) && (
          <span className="package-hint">{[label, equivalent].filter(Boolean).join(" · ")}</span>
        )}
        {warning && <span className="row-warning">{warning}</span>}
      </div>

      {inPackageMode ? (
        <input
          required
          type="number"
          step="any"
          min="0"
          placeholder="Qté"
          aria-label="Quantité en paquets"
          value={packageDraft}
          onChange={(e) => handlePackageChange(e.target.value)}
        />
      ) : (
        <input
          required
          type="number"
          step="any"
          min="0"
          placeholder="Qté"
          aria-label="Quantité"
          value={quantity}
          onChange={(e) => onQuantityChange(Number(e.target.value))}
        />
      )}

      {ingredient &&
        (canUsePackages ? (
          <select
            className="selected-ingredient-unit-select"
            aria-label="Unité de saisie"
            value={mode}
            onChange={(e) => switchMode(e.target.value as InputMode)}
          >
            <option value="unit">{ingredient.unit}</option>
            <option value="package">paquet</option>
          </select>
        ) : (
          <span className="selected-ingredient-unit">{ingredient.unit}</span>
        ))}

      {canUsePackages && !inPackageMode && (
        <button type="button" className="btn-sm" onClick={() => onQuantityChange(packageSize)}>
          1 paquet
        </button>
      )}

      <button
        type="button"
        className="btn-sm icon-btn btn-danger-ghost"
        onClick={onRemove}
        aria-label="Retirer cet ingrédient"
      >
        <Icon name="x" />
      </button>
    </li>
  );
}
