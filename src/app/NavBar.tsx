"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { badgeText, bellLabel } from "@/lib/notificationsView";
import { localTodayString } from "@/lib/week";
import { HouseholdSwitcher } from "./HouseholdSwitcher";
import { Icon, type IconName } from "./Icon";

const TABS: Array<{ href: string; label: string; icon: IconName; also?: string[] }> = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/planning", label: "Planning", icon: "calendar" },
  // Le catalogue d'ingrédients se range sous Recettes.
  { href: "/recettes", label: "Recettes", icon: "book", also: ["/ingredients"] },
  { href: "/courses", label: "Courses", icon: "cart" },
  { href: "/stock", label: "Stock", icon: "box" },
];

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  const paths = [tab.href, ...(tab.also ?? [])];
  return paths.some((path) => (path === "/" ? pathname === "/" : pathname.startsWith(path)));
}

// Le badge n'a pas besoin d'être exact à la seconde : pas de requête à chaque changement de page.
const BADGE_REFRESH_MS = 30_000;

export function NavBar() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const lastLoadRef = useRef(0);

  const loadCount = useCallback(async () => {
    if (Date.now() - lastLoadRef.current < BADGE_REFRESH_MS) return;
    lastLoadRef.current = Date.now();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const res = await fetch(`/api/notifications?today=${localTodayString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error("bad status");
      const data: unknown = await res.json();
      const value = (data as { count?: unknown }).count;
      if (controller.signal.aborted) return;
      setCount(typeof value === "number" ? value : 0);
    } catch {
      // Échec ou requête annulée : le prochain déclencheur doit pouvoir réessayer tout de suite.
      lastLoadRef.current = 0;
      if (!controller.signal.aborted) setCount(0);
    }
  }, []);

  // Au changement de page (limité par BADGE_REFRESH_MS).
  useEffect(() => {
    loadCount();
  }, [pathname, loadCount]);

  // Au retour sur l'app (PWA rouverte, onglet ré-affiché).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadCount();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      controllerRef.current?.abort();
      // Synchrone : en mode strict (dev) l'effet est relancé aussitôt et doit pouvoir recharger.
      lastLoadRef.current = 0;
    };
  }, [loadCount]);

  const badge = badgeText(count);

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-inner">
          <p className="top-bar-title">Planning Repas</p>
          <HouseholdSwitcher />
          <Link
            href="/notifications"
            className="bell"
            aria-label={bellLabel(count)}
            aria-current={pathname === "/notifications" ? "page" : undefined}
          >
            <Icon name="bell" />
            {badge && (
              <span className="bell-badge" aria-hidden="true">
                {badge}
              </span>
            )}
          </Link>
        </div>
      </header>
      <nav className="tab-bar" aria-label="Navigation principale">
        <ul className="tab-bar-inner">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            return (
              <li key={tab.href}>
                <Link href={tab.href} aria-current={active ? "page" : undefined}>
                  <Icon name={tab.icon} />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
