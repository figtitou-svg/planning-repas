// src/app/ingredients/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Ingredient } from "@/lib/types";
import { categoryColorVar } from "@/lib/categoryColor";
import { searchIngredients } from "@/lib/ingredientSearch";
import { Icon } from "../Icon";
import { IngredientForm, type IngredientFormValues } from "./IngredientForm";

type CatalogStatus = "idle" | "loading" | "ready" | "error";

// Au-delà, une nouvelle session de recherche recharge la liste (modifs faites dans Notion).
const CATALOG_MAX_AGE_MS = 60_000;

async function fetchCatalog(fresh = false): Promise<Ingredient[] | null> {
  try {
    const response = await fetch(fresh ? "/api/ingredients?fresh=1" : "/api/ingredients");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default function IngredientsPage() {
  // La liste n'est chargée qu'à la première recherche, jamais à l'ouverture de la page.
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [status, setStatus] = useState<CatalogStatus>("idle");
  const statusRef = useRef<CatalogStatus>("idle");
  const fetchedAtRef = useRef(0);
  const inflightRef = useRef(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function changeStatus(next: CatalogStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  function storeCatalog(list: Ingredient[]) {
    fetchedAtRef.current = Date.now();
    setCatalog(list);
    changeStatus("ready");
  }

  // `newSession` : la recherche démarre (champ vide -> saisie). Seul un nouveau départ
  // relance un chargement en erreur ou périmé, jamais chaque frappe.
  async function ensureCatalog(newSession: boolean) {
    if (inflightRef.current) return;
    const current = statusRef.current;
    const stale = Date.now() - fetchedAtRef.current > CATALOG_MAX_AGE_MS;
    const needed =
      current === "idle" || (newSession && (current === "error" || (current === "ready" && stale)));
    if (!needed) return;
    inflightRef.current = true;
    // Une liste déjà affichée le reste pendant le rafraîchissement.
    if (current !== "ready") changeStatus("loading");
    const list = await fetchCatalog();
    inflightRef.current = false;
    if (list) storeCatalog(list);
    else if (current !== "ready") changeStatus("error");
  }

  async function handleCreate(values: IngredientFormValues) {
    let created: Ingredient | null = null;
    try {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (response.ok) created = await response.json();
    } catch {
      created = null;
    }
    if (!created) {
      setNotice({ text: "Impossible d'ajouter cet ingrédient.", error: true });
      throw new Error("create failed"); // le formulaire garde la saisie
    }
    const added = created;
    // Garde le cache de recherche à jour s'il est déjà chargé.
    if (statusRef.current === "ready") setCatalog((current) => [...current, added]);
    setNotice({ text: `${added.name} ajouté`, error: false });
  }

  async function handleUpdate(id: string, values: IngredientFormValues) {
    let updated: Ingredient | null = null;
    try {
      const response = await fetch(`/api/ingredients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (response.ok) updated = await response.json();
    } catch {
      updated = null;
    }
    if (!updated) {
      setNotice({ text: "Impossible de mettre à jour cet ingrédient.", error: true });
      throw new Error("update failed");
    }
    const saved = updated;
    setCatalog((current) => current.map((ing) => (ing.id === saved.id ? saved : ing)));
    setEditing(null);
    setNotice({ text: `${saved.name} mis à jour`, error: false });
  }

  // Relit l'ingrédient avant l'édition : l'enregistrement écraserait sinon des modifs faites dans Notion.
  async function startEditing(ingredient: Ingredient) {
    if (openingId) return;
    setOpeningId(ingredient.id);
    const list = await fetchCatalog(true);
    setOpeningId(null);
    if (!list) {
      setNotice({ text: "Impossible de charger cet ingrédient.", error: true });
      return;
    }
    storeCatalog(list);
    const fresh = list.find((ing) => ing.id === ingredient.id);
    if (!fresh) {
      setNotice({ text: "Cet ingrédient n'existe plus", error: true });
      return;
    }
    setEditing(fresh);
    setQuery("");
    window.scrollTo({ top: 0 });
  }

  const trimmed = query.trim();
  const results = searchIngredients(catalog, query);

  return (
    <main>
      <h1>Catalogue d'ingrédients</h1>
      <Link className="chip-link" href="/recettes">
        <Icon name="chevron-left" />
        Recettes
      </Link>
      {editing && (
        <IngredientForm
          key={editing.id}
          initial={editing}
          onSubmit={(values) => handleUpdate(editing.id, values)}
          onCancel={() => setEditing(null)}
        />
      )}
      {/* Reste monté (masqué) pendant l'édition pour ne pas perdre une saisie en cours. */}
      <div hidden={editing !== null}>
        <details className="fold">
          <summary>
            <Icon name="plus" />
            Nouvel ingrédient
          </summary>
          <IngredientForm onSubmit={handleCreate} />
        </details>
      </div>

      <section className="ingredient-search" aria-label="Modifier un ingrédient">
        <input
          type="search"
          placeholder="Rechercher un ingrédient à modifier…"
          aria-label="Rechercher un ingrédient à modifier"
          autoComplete="off"
          value={query}
          onFocus={() => ensureCatalog(trimmed === "")}
          onChange={(e) => {
            setQuery(e.target.value);
            ensureCatalog(trimmed === "" && e.target.value.trim() !== "");
          }}
        />
        {trimmed === "" ? (
          <p className="search-hint">Tapez un nom pour retrouver un ingrédient et le modifier.</p>
        ) : status === "error" ? (
          <p className="search-hint">
            Impossible de charger les ingrédients.{" "}
            <button type="button" className="btn-sm" onClick={() => ensureCatalog(true)}>
              Réessayer
            </button>
          </p>
        ) : status !== "ready" ? (
          <p className="search-hint">Chargement…</p>
        ) : results.length === 0 ? (
          <p className="search-hint">Aucun ingrédient ne correspond.</p>
        ) : (
          <ul className="panel">
            {results.map((ing) => (
              <li
                key={ing.id}
                className="row"
                style={{ "--cat": categoryColorVar(ing.category) } as CSSProperties}
              >
                <span className="cat-dot" aria-hidden="true" />
                <div className="row-main">
                  <p className="row-title">{ing.name}</p>
                  <p className="card-meta">{ing.category}</p>
                </div>
                <button
                  className="btn-sm"
                  type="button"
                  disabled={openingId !== null}
                  onClick={() => startEditing(ing)}
                >
                  <Icon name="edit" />
                  {openingId === ing.id ? "Chargement…" : "Modifier"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="toast-region" role="status">
        {notice && (
          <p className={notice.error ? "notice notice-error" : "notice"}>{notice.text}</p>
        )}
      </div>
    </main>
  );
}
