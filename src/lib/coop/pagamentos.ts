// Pagamento aos produtores, semana a semana: quanto cada um tem a receber e se já foi pago (✓ no Fechamento).
import { lerSemana, listarSemanas } from "./armazem";
import { calcularSemana } from "./motor";
import type { Cadastro } from "./tipos";

export interface SemanaPagamento {
  data: string;
  ref: string; // "16/11"
  porProdutor: Record<string, { valor: number; pagoEm: string | null }>;
}

export async function pagamentosPorSemana(cad: Cadastro) {
  const semanas: SemanaPagamento[] = [];
  for (const d of (await listarSemanas()).slice().sort()) {
    const s = await lerSemana(d);
    if (!s) continue;
    const r = calcularSemana(cad, s);
    if (r.resumo.entregasLancadasKg <= 0) continue; // sem entrega ainda: nada a pagar
    const porProdutor: SemanaPagamento["porProdutor"] = {};
    for (const p of cad.produtores) {
      const v = r.pagarProdutor[p.id] ?? 0;
      if (v > 0.004) porProdutor[p.id] = { valor: v, pagoEm: s.pagamentos?.[p.id] ?? null };
    }
    semanas.push({ data: d, ref: s.referencia.slice(0, 5), porProdutor });
  }
  const falta = semanas.flatMap((s) => Object.values(s.porProdutor).filter((x) => !x.pagoEm)).reduce((t, x) => t + x.valor, 0);
  const semanasComFalta = semanas.filter((s) => Object.values(s.porProdutor).some((x) => !x.pagoEm)).map((s) => s.ref);
  return { semanas, falta, semanasComFalta };
}
