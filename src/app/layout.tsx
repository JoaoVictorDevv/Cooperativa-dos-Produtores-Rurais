import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "App da Cooperativa", template: "%s · Cooperativa" },
  description: "Pedidos, galpão, mapa de montagem, romaneios e fechamento da merenda escolar (PNAE).",
  icons: { icon: "/coop/logo.ico", apple: "/coop/logo.jpg" },
};

export const viewport = { themeColor: "#4a2b14" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
