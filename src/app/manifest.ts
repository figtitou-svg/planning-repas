import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Planning Repas",
    short_name: "Repas",
    description: "Planification de repas, stock et liste de courses",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f3ee",
    theme_color: "#f2f3ee",
    // Une seule image 512 px, déclarée pour les deux tailles qu'exigent les navigateurs.
    icons: [{ src: "/icon.png", sizes: "192x192 512x512", type: "image/png" }],
  };
}
