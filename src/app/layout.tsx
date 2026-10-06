import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Colheita — Gestão Cooperativa", template: "%s | Colheita" },
  description: "Gestão integrada de pedidos, produtores, entregas e financeiro para cooperativas do PNAE.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
