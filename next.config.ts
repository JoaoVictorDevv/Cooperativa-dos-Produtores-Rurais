import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Endereços deste PC na rede: no "modo simples" (dev) o celular também carrega o app.
const enderecosDaRede = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4")
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: enderecosDaRede,
  experimental: {
    serverActions: {
      // Planilhas de pedido da prefeitura passam de 1 MB (a GZ de exemplo tem
      // 2,1 MB). A action recusa arquivos acima de 7 MB antes de ler.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
