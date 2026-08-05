import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atoryn Forge",
    short_name: "Atoryn",
    description:
      "Governed remote AI coding runs with review, approvals, evidence, and draft publication.",
    start_url: "/app/forge",
    scope: "/",
    display: "standalone",
    background_color: "#0c0b0a",
    theme_color: "#0c0b0a",
    orientation: "any",
    lang: "en",
    categories: ["developer", "productivity"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
