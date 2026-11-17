import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MarginOS — Agency financial intelligence",
    short_name: "MarginOS",
    description: "Know your margins. Control your agency.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f4",
    theme_color: "#16181d",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log time", url: "/time", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Record expense", url: "/expenses", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Clients", url: "/clients", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
