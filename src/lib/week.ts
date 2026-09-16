import { prisma } from "./prisma";
import type { Week } from "@prisma/client";

export async function getOpenWeek() {
  return prisma.week.findFirst({ where: { status: "ABERTA" }, orderBy: { number: "desc" } });
}

export async function requireOpenWeek() {
  const week = await getOpenWeek();
  if (!week) {
    throw new Error("Nao ha nenhuma semana aberta. Crie uma semana antes de lancar dados.");
  }
  return week;
}

// CA-SEM-05: semana fechada nao pode ser editada (exceto via reabertura).
export function assertWeekEditable(week: Pick<Week, "status">) {
  if (week.status !== "ABERTA") {
    throw new Error("Esta semana esta fechada. Um ADMIN precisa reabri-la para editar.");
  }
}

// Preco vigente NA DATA DE REFERENCIA DA SEMANA (nao "agora") — assim
// toda edicao dentro da mesma semana usa o mesmo preco, e semanas
// antigas continuam usando o preco que valia quando foram lancadas
// (CA-PRECO-04).
export async function getCurrentPrice(productId: string, at: Date) {
  const price = await prisma.price.findFirst({
    where: {
      productId,
      validFrom: { lte: at },
      OR: [{ validTo: null }, { validTo: { gt: at } }],
    },
    orderBy: { validFrom: "desc" },
  });
  if (!price) {
    throw new Error("Este produto nao possui preco vigente cadastrado para a data da semana.");
  }
  return price;
}

export async function getSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    throw new Error("Configuracoes (Settings) nao inicializadas — rode o seed.");
  }
  return settings;
}
