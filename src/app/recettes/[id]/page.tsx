"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Ingredient, Recipe } from "@/lib/types";
import { formatAmount, formatQuantity } from "@/lib/formatQuantity";
import { formatPrice } from "@/lib/formatPrice";
import { recipeCost } from "@/lib/recipeCost";
import { recipeCategoryColor } from "@/lib/recipeCategories";
import type { NewIngredientDraft } from "@/lib/importDraft";
import { localCalendarDateAsUtc, nextWeekStart } from "@/lib/week";
import { Icon } from "../../Icon";
import { RecipeForm, type RecipeFormValues } from "../RecipeForm";
import { SchedulePopup } from "../SchedulePopup";

function formatWeek(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [recipeRes, ingredientsRes] = await Promise.all([
        fetch(`/api/recipes/${id}`),
        fetch("/api/ingredients"),
      ]);
      if (recipeRes.status === 404) {
        setStatus("missing");
        return;
      }
      if (!recipeRes.ok || !ingredientsRes.ok) throw new Error("bad status");
      setRecipe(await recipeRes.json());
      setCatalog(await ingredientsRes.json());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Suppression en deux temps : le premier appui demande confirmation, puis se referme seul.
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const closePopup = useCallback(() => setScheduling(false), []);

  async function createIngredient(item: NewIngredientDraft): Promise<Ingredient> {
    const response = await fetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name.trim(),
        unit: item.unit,
        packageSize: 0,
        packagePrice: 0,
        shelfLifeDays: 0,
        category: "Autre",
      }),
    });
    if (!response.ok) throw new Error("Création de l'ingrédient impossible");
    const created: Ingredient = await response.json();
    setCatalog((current) => [...current, created]);
    return created;
  }

  async function handleUpdate(values: RecipeFormValues) {
    const response = await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) throw new Error("Modification de la recette impossible");
    setRecipe((current) => (current ? { ...current, ...values } : current));
    setEditing(false);
    setNotice({ text: `${values.name} mise à jour`, error: false });
  }

  async function handleDelete() {
    let ok = false;
    try {
      ok = (await fetch(`/api/recipes/${id}`, { method: "DELETE" })).ok;
    } catch {
      ok = false;
    }
    if (ok) router.push("/recettes");
    else setNotice({ text: "Impossible de supprimer cette recette.", error: true });
  }

  // Mise à jour immédiate ; si Notion refuse, on revient en arrière et on le dit.
  async function toggleFavorite() {
    if (!recipe) return;
    const favorite = !recipe.favorite;
    setRecipe({ ...recipe, favorite });
    let ok = false;
    try {
      const response = await fetch(`/api/recipes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite }),
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setRecipe((current) => (current ? { ...current, favorite: !favorite } : current));
      setNotice({ text: "Impossible de modifier les favorites.", error: true });
    }
  }

  async function handleSchedule(portions: number) {
    const weekStart = nextWeekStart(localCalendarDateAsUtc(new Date()));
    let ok = false;
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, recipeId: id, portions }),
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    setScheduling(false);
    setNotice(
      ok
        ? { text: `Programmé pour la semaine du ${formatWeek(weekStart)}`, error: false }
        : { text: "Impossible de programmer cette recette.", error: true }
    );
  }

  if (status === "loading") {
    return (
      <main>
        <p className="empty-state" role="status">
          Chargement…
        </p>
      </main>
    );
  }
  if (status === "missing" || status === "error" || !recipe) {
    return (
      <main>
        <Link className="chip-link" href="/recettes">
          ‹ Recettes
        </Link>
        <div className="empty-state error-state" role="alert">
          <p>
            {status === "missing" ? "Cette recette n'existe plus." : "Impossible de charger la recette."}
          </p>
          {status === "error" && (
            <button type="button" onClick={() => void load()}>
              Réessayer
            </button>
          )}
        </div>
      </main>
    );
  }

  const cost = recipeCost(recipe, catalog);
  const steps = recipe.steps ?? [];

  return (
    <main className="recipe-detail" style={{ "--cat": recipeCategoryColor(recipe.category) } as React.CSSProperties}>
      <Link className="chip-link" href="/recettes">
        ‹ Recettes
      </Link>

      {editing ? (
        <section className="sheet-panel" aria-label="Modifier la recette">
          <h2>Modifier la recette</h2>
          <RecipeForm
            catalog={catalog}
            initial={recipe}
            createIngredient={createIngredient}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
          />
        </section>
      ) : (
        <>
          <div className="page-head recipe-detail-head">
            <div className="row-head-text">
              <h1>{recipe.name}</h1>
              <p className="card-meta">
                {recipe.portions} portion{recipe.portions > 1 ? "s" : ""} · {recipe.ingredients.length}{" "}
                ingrédient{recipe.ingredients.length > 1 ? "s" : ""}
                {cost && (
                  <span title={cost.complete ? undefined : "Certains ingrédients n'ont pas de prix"}>
                    {" "}
                    · {cost.complete ? "≈" : "~"} {formatPrice(cost.perPortion)} / portion
                  </span>
                )}
              </p>
              {recipe.category && <span className="chip recipe-chip">{recipe.category}</span>}
            </div>
            <button
              type="button"
              className={recipe.favorite ? "icon-btn heart-btn is-favorite" : "icon-btn heart-btn"}
              aria-pressed={recipe.favorite}
              aria-label={
                recipe.favorite ? "Retirer des favorites" : "Ajouter aux favorites"
              }
              onClick={() => void toggleFavorite()}
            >
              <Icon name="heart" filled={recipe.favorite} />
            </button>
          </div>

          <div className="row-actions recipe-detail-actions">
            <button className="btn-sm btn-primary" type="button" onClick={() => setScheduling(true)}>
              <Icon name="calendar" />
              Programmer
            </button>
            <button className="btn-sm" type="button" onClick={() => setEditing(true)}>
              <Icon name="edit" />
              Modifier
            </button>
            <button
              className={confirmingDelete ? "btn-sm btn-danger" : "btn-sm icon-btn btn-danger-ghost"}
              type="button"
              aria-label={confirmingDelete ? "Confirmer la suppression" : `Supprimer ${recipe.name}`}
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                setConfirmingDelete(false);
                void handleDelete();
              }}
            >
              <Icon name="trash" />
              {confirmingDelete && "Confirmer"}
            </button>
          </div>

          <h2 className="section-title">Ingrédients</h2>
          {recipe.ingredients.length === 0 ? (
            <p className="card-meta">Aucun ingrédient.</p>
          ) : (
            <ul className="card-ingredients panel panel-pad">
              {recipe.ingredients.map((ri, i) => {
                const ingredient = catalog.find((c) => c.id === ri.ingredientId);
                return (
                  <li key={i}>
                    <span>{ingredient?.name ?? "(ingrédient supprimé)"}</span>
                    <span>
                      {ingredient ? formatAmount(ri.quantity, ingredient.unit) : formatQuantity(ri.quantity)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="section-title">Instructions</h2>
          {steps.length === 0 ? (
            <p className="card-meta">
              Aucune instruction pour cette recette. « Modifier » permet d'en ajouter.
            </p>
          ) : (
            <ol className="card-steps panel panel-pad">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
        </>
      )}

      <div className="toast-region" role="status">
        {notice && <p className={notice.error ? "notice notice-error" : "notice"}>{notice.text}</p>}
      </div>
      {scheduling && (
        <SchedulePopup
          recipe={recipe}
          catalog={catalog}
          onConfirm={handleSchedule}
          onCancel={closePopup}
        />
      )}
    </main>
  );
}
