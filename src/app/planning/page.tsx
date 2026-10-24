"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PlannedMeal, Recipe } from "@/lib/types";
import { localCalendarDateAsUtc, nextWeekStart } from "@/lib/week";
import { Icon } from "../Icon";
import { SwipeReveal } from "../SwipeReveal";
import { WeekStepper } from "../WeekStepper";

const UNDO_MS = 6000;

function PlannedRow({
  name,
  portions,
  onRemove,
}: {
  name: string;
  portions: number;
  onRemove: () => void;
}) {
  return (
    <SwipeReveal
      variant="remove"
      onAction={onRemove}
      className="swipe-reveal-row"
      foregroundClassName="row"
    >
      <div className="row-main">
        <p className="row-title">{name}</p>
        <p className="card-meta">
          {portions} portion{portions > 1 ? "s" : ""}
        </p>
      </div>
      <button type="button" className="icon-btn btn-danger-ghost" aria-label="Retirer" onClick={onRemove}>
        <Icon name="trash" />
      </button>
    </SwipeReveal>
  );
}

interface Removed {
  weekStart: string;
  recipeId: string;
  portions: number;
}

export default function PlanningPage() {
  const [week, setWeek] = useState(nextWeekStart(localCalendarDateAsUtc(new Date())));
  const weekRef = useRef(week);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [undo, setUndo] = useState<Removed | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Sans les recettes, les noms afficheraient « (recette supprimée) » à tort.
  const [recipesState, setRecipesState] = useState<"loading" | "ready" | "error">("loading");

  async function loadRecipes() {
    setRecipesState("loading");
    try {
      const response = await fetch("/api/recipes");
      if (!response.ok) throw new Error("bad status");
      setRecipes(await response.json());
      setRecipesState("ready");
    } catch {
      setRecipesState("error");
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  async function loadMeals(forWeek: string) {
    let plan: PlannedMeal[] | null = null;
    try {
      const response = await fetch(`/api/plan?week=${forWeek}`);
      if (response.ok) plan = await response.json();
    } catch {
      plan = null;
    }
    if (weekRef.current !== forWeek) return;
    if (plan) setMeals(plan);
    setError(plan === null);
    setLoading(false);
  }

  useEffect(() => {
    weekRef.current = week;
    setMeals([]);
    setError(false);
    setLoading(true);
    setUndo(null);
    loadMeals(week);
  }, [week]);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  function retry() {
    setError(false);
    setLoading(true);
    if (recipesState === "error") loadRecipes();
    loadMeals(weekRef.current);
  }

  function displayedPortions(meal: PlannedMeal): number {
    if (meal.portions > 0) return meal.portions;
    return recipes.find((r) => r.id === meal.recipeId)?.portions ?? 1;
  }

  async function remove(meal: PlannedMeal) {
    const removed: Removed = {
      weekStart: weekRef.current,
      recipeId: meal.recipeId,
      portions: displayedPortions(meal),
    };
    setMeals((current) => current.filter((m) => m.id !== meal.id));
    let ok = false;
    try {
      const response = await fetch(`/api/plan/${meal.id}`, { method: "DELETE" });
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (ok) setUndo(removed);
    else await loadMeals(weekRef.current);
  }

  // Annuler = reprogrammer la même recette (elle reçoit un nouvel identifiant côté Notion).
  async function undoRemove() {
    if (!undo || undoing) return;
    setUndoing(true);
    const restored = undo;
    try {
      await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restored),
      });
    } catch {
      // La liste rechargée ci-dessous montre l'état réel.
    }
    setUndo(null);
    setUndoing(false);
    await loadMeals(weekRef.current);
  }

  function recipeName(recipeId: string): string {
    return recipes.find((r) => r.id === recipeId)?.name ?? "(recette supprimée)";
  }

  const totalPortions = meals.reduce((sum, meal) => sum + displayedPortions(meal), 0);

  return (
    <main>
      <h1>Planning</h1>
      <WeekStepper week={week} onChange={setWeek} />

      {loading || recipesState === "loading" ? (
        <p className="empty-state" role="status">
          Chargement…
        </p>
      ) : error || recipesState === "error" ? (
        <div className="empty-state error-state" role="alert">
          <p>Impossible de charger le planning.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      ) : meals.length === 0 ? (
        <div className="empty-state">
          <p>Rien de programmé cette semaine.</p>
          <Link className="btn-link" href="/recettes">
            Choisir des recettes
          </Link>
        </div>
      ) : (
        <>
          <p className="list-summary">
            {meals.length} repas · {totalPortions} portion{totalPortions > 1 ? "s" : ""}
          </p>
          <ul className="panel">
            {meals.map((meal) => (
              <PlannedRow
                key={meal.id}
                name={recipeName(meal.recipeId)}
                portions={displayedPortions(meal)}
                onRemove={() => remove(meal)}
              />
            ))}
          </ul>
        </>
      )}

      <div className="toast-region" role="status">
        {undo && (
          <p className="notice notice-action">
            Repas retiré
            <button type="button" className="btn-sm" disabled={undoing} onClick={undoRemove}>
              Annuler
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
