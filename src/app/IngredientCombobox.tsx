"use client";

import { useEffect, useRef, useState } from "react";
import type { Ingredient } from "@/lib/types";

export function IngredientCombobox({
  id,
  catalog,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  catalog: Ingredient[];
  value: string;
  onChange: (ingredientId: string) => void;
  placeholder?: string;
}) {
  const selected = catalog.find((i) => i.id === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the displayed text in sync if the selection changes from outside
  // (e.g. catalog loads after the value was already set).
  useEffect(() => {
    if (!open) setQuery(selected?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.name]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.name ?? "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.name]);

  const results = catalog.filter((ing) =>
    ing.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  function select(ing: Ingredient) {
    onChange(ing.id);
    setQuery(ing.name);
    setOpen(false);
  }

  return (
    <div className="combobox" ref={wrapRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        placeholder={placeholder ?? "Rechercher un ingrédient…"}
        value={query}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <ul className="combobox-results">
          {results.length === 0 && <li className="combobox-empty">Aucun résultat</li>}
          {results.map((ing) => (
            <li key={ing.id}>
              <button type="button" onClick={() => select(ing)}>
                {ing.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
