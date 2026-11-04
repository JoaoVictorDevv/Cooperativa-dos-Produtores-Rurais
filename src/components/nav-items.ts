import type { IconName } from "./Icon";

export const NAV_ITEMS = [
  { href: "/painel", label: "Visão geral", icon: "dashboard", group: "operacao" },
  { href: "/semanas", label: "Semanas", icon: "calendar", group: "operacao" },
  { href: "/escolas", label: "Escolas", icon: "school", group: "operacao" },
  { href: "/produtores", label: "Produtores", icon: "users", group: "operacao" },
  { href: "/mapa-producao", label: "Mapa de produção", icon: "map", group: "operacao" },
  { href: "/resumo", label: "Resumo operacional", icon: "chart", group: "gestao" },
  { href: "/diferenca", label: "Diferença do galpão", icon: "truck", group: "gestao" },
  { href: "/balanco", label: "Balanço", icon: "balance", group: "gestao" },
  { href: "/historico", label: "Histórico", icon: "history", group: "gestao" },
  { href: "/motivos", label: "Motivos", icon: "package", group: "gestao" },
  { href: "/precos", label: "Tabela de preços", icon: "prices", group: "gestao" },
] satisfies { href: string; label: string; icon: IconName; group: "operacao" | "gestao" }[];
