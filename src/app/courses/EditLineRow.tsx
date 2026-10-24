"use client";

import { useState } from "react";
import type { ShoppingListLine } from "@/lib/types";
import { formatQuantity } from "@/lib/formatQuantity";
import { parseQuantityInput } from "@/lib/parseQuantityInput";
import { Icon } from "../Icon";

// Ligne d'un article ajouté à la main, en mode « Modifier » : sa quantité tapée (vide = un
// paquet) et une poubelle. La quantité s'enregistre en quittant le champ ou sur Entrée.
export function EditLineRow({
  line,
  busy,
  onSaveQuantity,
  onDelete,
}: {
  line: ShoppingListLine;
  busy: boolean;
  onSaveQuantity: (quantity: number | null) => void;
  onDelete: () => void;
}) {
  const saved = line.extraQuantity ?? null;
  const [text, setText] = useState(saved === null ? "" : formatQuantity(saved));
  const [invalid, setInvalid] = useState(false);

  function commit() {
    const parsed = parseQuantityInput(text);
    if (parsed === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (parsed !== saved) onSaveQuantity(parsed);
  }

  return (
    <li className="ticket-line ticket-line-edit">
      <span className="ticket-line-name">{line.ingredientName}</span>
      <span className="ticket-qty">
        <input
          className="ticket-qty-input"
          type="text"
          inputMode="decimal"
          aria-label={`Quantité de ${line.ingredientName}`}
          aria-invalid={invalid}
          placeholder="1 paquet"
          value={text}
          disabled={busy}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <span className="ticket-qty-unit">{line.unit}</span>
      </span>
      <button
        type="button"
        className="btn-sm icon-btn ticket-action-btn"
        aria-label={`Supprimer ${line.ingredientName} de la liste`}
        disabled={busy}
        onClick={onDelete}
      >
        <Icon name="trash" />
      </button>
      {invalid && (
        <span className="ticket-edit-error" role="alert">
          Quantité invalide : un nombre positif, ou vide pour un paquet.
        </span>
      )}
    </li>
  );
}
