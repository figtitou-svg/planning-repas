"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { swipeState, type SwipeState } from "@/lib/swipeState";
import { lockGesture, isClearlyVertical } from "@/lib/swipeGesture";
import { Icon } from "./Icon";

type Variant = "schedule" | "remove";
type Phase = "idle" | "dragging" | "settling" | "leaving";

const VARIANTS: Record<Variant, { icon: ReactNode; label: string }> = {
  schedule: { icon: <Icon name="calendar" />, label: "Programmer" },
  remove: { icon: <Icon name="trash" />, label: "Retirer" },
};

const TRANSITION_MS = 200;
// Filet de sécurité si `transitionend` ne vient jamais (onglet en arrière-plan, etc.).
const FALLBACK_MS = TRANSITION_MS + 150;
const INTERACTIVE = "button, a, input, select, textarea, label";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Élément de liste (<li>) dont le contenu suit le doigt en glissant et révèle, dessous,
 * l'action déclenchée au relâchement (calendrier ou croix). Les classes de style de la
 * carte vont sur `foregroundClassName` ; `className` sert au conteneur (rayon des coins).
 */
export function SwipeReveal({
  variant,
  onAction,
  className = "",
  foregroundClassName = "",
  children,
}: {
  variant: Variant;
  onAction: () => void;
  className?: string;
  foregroundClassName?: string;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  // Aspect de la révélation, figé pendant le retour en place pour qu'elle s'efface avec la carte.
  const [look, setLook] = useState<SwipeState | null>(null);

  const wrapRef = useRef<HTMLLIElement>(null);
  const widthRef = useRef(0);
  const offsetRef = useRef(0);
  const lockRef = useRef<"h" | "v" | "ignore" | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const lastAbsRef = useRef({ x: 0, y: 0 });
  const phaseRef = useRef<Phase>("idle");
  const pendingRef = useRef<(() => void) | null>(null);
  const fallbackTimer = useRef<number | undefined>(undefined);
  // Toujours la dernière action : évite une fermeture périmée dans les gestes.
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  function move(next: number, nextPhase: Phase) {
    offsetRef.current = next;
    phaseRef.current = nextPhase;
    setOffset(next);
    setPhase(nextPhase);
    if (nextPhase === "dragging" || nextPhase === "leaving") {
      setLook(swipeState(next, widthRef.current));
    } else if (nextPhase === "idle") {
      setLook(null);
    }
  }

  function clearPending() {
    pendingRef.current = null;
    window.clearTimeout(fallbackTimer.current);
  }

  // Exécute `cb` à la fin de la transition (ou tout de suite sans animation).
  function afterTransition(cb: () => void) {
    clearPending();
    if (prefersReducedMotion()) {
      cb();
      return;
    }
    const run = () => {
      if (pendingRef.current !== run) return;
      clearPending();
      cb();
    };
    pendingRef.current = run;
    fallbackTimer.current = window.setTimeout(run, FALLBACK_MS);
  }

  useEffect(
    () => () => {
      pendingRef.current = null;
      window.clearTimeout(fallbackTimer.current);
    },
    []
  );

  function springBack() {
    move(0, "settling");
    afterTransition(() => move(0, "idle"));
  }

  function release() {
    const lock = lockRef.current;
    lockRef.current = null;
    if (lock !== "h") {
      // Un nouveau toucher a interrompu un retour en place : ne pas rester bloqué.
      if (phaseRef.current === "settling" && pendingRef.current === null) move(0, "idle");
      return;
    }
    const width = widthRef.current;
    const state = swipeState(offsetRef.current, width);
    const horizontal = lastAbsRef.current.x > lastAbsRef.current.y;
    if (!state.armed || state.direction === null || !horizontal) {
      springBack();
      return;
    }
    if (variant === "schedule") {
      onActionRef.current();
      springBack();
      return;
    }
    // remove : la carte sort de l'écran, puis l'action est déclenchée.
    move(state.direction === "right" ? width : -width, "leaving");
    afterTransition(() => onActionRef.current());
  }

  const handlers = useSwipeable({
    delta: 10,
    trackMouse: false,
    trackTouch: true,
    onTouchStartOrOnMouseDown: ({ event }) => {
      touchIdRef.current = "touches" in event ? event.touches[0]?.identifier ?? null : null;
      lastAbsRef.current = { x: 0, y: 0 };
      lockRef.current =
        phaseRef.current === "leaving" ||
        (event.target instanceof Element && event.target.closest(INTERACTIVE))
          ? "ignore"
          : null;
      if (lockRef.current === null) clearPending();
    },
    onSwiping: ({ deltaX, absX, absY }) => {
      if (lockRef.current === null) {
        // Geste horizontal ou vertical, décidé une fois pour toutes (indécis sous ~16 px).
        const decided = lockGesture(absX, absY);
        if (decided === null) return;
        lockRef.current = decided;
        widthRef.current = wrapRef.current?.offsetWidth ?? 0;
      }
      if (lockRef.current !== "h") return;
      lastAbsRef.current = { x: absX, y: absY };
      if (isClearlyVertical(absX, absY)) {
        // Le geste a dérivé à la verticale : on rend la carte et on n'agit pas.
        lockRef.current = "ignore";
        springBack();
        return;
      }
      const width = widthRef.current;
      const limit = width > 0 ? width : Infinity;
      move(Math.max(-limit, Math.min(limit, deltaX)), "dragging");
    },
    onTouchEndOrOnMouseUp: ({ event }) => {
      if ("changedTouches" in event && touchIdRef.current !== null) {
        const first = Array.from(event.changedTouches).some(
          (t) => t.identifier === touchIdRef.current
        );
        if (!first) {
          // Un second doigt se lève : la bibliothèque a réinitialisé son suivi, on abandonne le geste.
          const wasHorizontal = lockRef.current === "h";
          if (lockRef.current !== null) lockRef.current = "ignore";
          if (wasHorizontal) springBack();
          return;
        }
      }
      release();
    },
  });

  const { icon, label } = VARIANTS[variant];
  const active = phase !== "idle";
  const shown = look ?? swipeState(0, 0);
  const bgOpacity = shown.armed ? 1 : 0.35 + 0.5 * shown.progress;
  const iconScale = shown.armed ? 1.25 : 0.75 + 0.25 * shown.progress;

  return (
    <li
      ref={wrapRef}
      className={`swipe-reveal ${active ? "swipe-reveal-active" : ""} ${className}`}
    >
      <div
        className={`swipe-bg swipe-bg-${variant} swipe-bg-${shown.direction ?? "right"}${
          shown.armed ? " swipe-bg-armed" : ""
        }`}
        aria-hidden="true"
        style={{ opacity: bgOpacity }}
      >
        <span className="swipe-bg-content" style={{ transform: `scale(${iconScale})` }}>
          <span className="swipe-bg-icon">{icon}</span>
          <span className="swipe-bg-label">{label}</span>
        </span>
      </div>
      <div
        {...handlers}
        className={`swipe-fg ${foregroundClassName}`}
        style={{
          transform: offset === 0 ? undefined : `translateX(${offset}px)`,
          transition: phase === "dragging" || phase === "idle" ? "none" : undefined,
        }}
        onTouchCancel={() => {
          if (lockRef.current === "h") {
            lockRef.current = null;
            springBack();
          }
        }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "transform") {
            pendingRef.current?.();
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}
