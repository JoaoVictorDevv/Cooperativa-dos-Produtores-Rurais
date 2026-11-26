import type { MetadataRoute } from "next";

// "Adicionar à tela inicial" no celular: abre o app com a logo da cooperativa.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App da Cooperativa",
    short_name: "Cooperativa",
    start_url: "/coop",
    display: "standalone",
    background_color: "#f4eee2",
    theme_color: "#4a2b14",
    // Segurar o ícone no celular mostra o atalho direto para o galpão.
    shortcuts: [{ name: "Galpão", short_name: "Galpão", url: "/coop/galpao" }],
    icons: [{ src: "/coop/logo.jpg", sizes: "640x640", type: "image/jpeg", purpose: "any" }],
  };
}
