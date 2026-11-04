import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Planilhas de pedido da prefeitura passam de 1 MB (a GZ de exemplo tem
      // 2,1 MB). A action recusa arquivos acima de 7 MB antes de ler.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
