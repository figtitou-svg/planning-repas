import "@fontsource-variable/bricolage-grotesque/wght.css";
import "./globals.css";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";
import { NavBar } from "./NavBar";

export const metadata = {
  title: "Planning Repas",
  description: "Planification de repas, stock et liste de courses",
};

export const viewport: Viewport = {
  themeColor: "#f2f3ee",
  // Utilise tout l'écran en mode installé ; les marges de l'encoche sont gérées en CSS (safe-area).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ServiceWorkerRegistration />
        <NavBar />
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
