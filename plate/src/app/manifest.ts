import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plate",
    short_name: "Plate",
    description: "Snap a photo of your meal, get ingredient-level calories and macros.",
    start_url: "/today",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2f9e5b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
