// Arredondamento do total a cobrar (decisão do usuário em 26/09/2026): ciclos
// novos somam as linhas já arredondadas a 2 casas, como a planilha. Ciclos
// criados antes do corte — abertos ou fechados — mantêm o cálculo antigo
// (arredondar só no fim) e nunca são recalculados.
//
// O corte é a data de criação do ciclo. Padrão: 27/09/2026 00:00 (Brasília).
// Pode ser ajustado por TREASURY_PER_LINE_ROUNDING_FROM (data ISO), por
// exemplo para a data da implantação em produção.

export type TreasuryRounding = "POR_LINHA" | "TOTAL_LEGADO";

export const DEFAULT_PER_LINE_ROUNDING_FROM = "2026-09-27T00:00:00-03:00";

export function perLineRoundingCutoff(env: Record<string, string | undefined> = process.env): Date {
  const configured = env.TREASURY_PER_LINE_ROUNDING_FROM;
  const parsed = configured ? new Date(configured) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(DEFAULT_PER_LINE_ROUNDING_FROM);
}

export function treasuryRoundingFor(week: { createdAt: Date }, cutoff: Date = perLineRoundingCutoff()): TreasuryRounding {
  return week.createdAt.getTime() >= cutoff.getTime() ? "POR_LINHA" : "TOTAL_LEGADO";
}

export const TREASURY_ROUNDING_NOTE: Record<TreasuryRounding, string> = {
  POR_LINHA: "Arredondamento: cada linha a 2 casas; o total a cobrar é a soma das linhas arredondadas (como a planilha).",
  TOTAL_LEGADO:
    "Arredondamento (ciclo anterior à regra de 26/09/2026): total a cobrar arredondado só no fim; pode diferir em centavos da soma das linhas exibidas. Mantido para não recalcular ciclos antigos.",
};
