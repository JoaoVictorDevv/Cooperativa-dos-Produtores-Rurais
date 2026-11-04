import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Só acrescenta o atalho "@/" (o mesmo do tsconfig) para os testes poderem
// importar as ações de servidor. Descoberta de testes e ambiente: padrão.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
