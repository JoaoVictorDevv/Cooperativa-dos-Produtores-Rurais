// Porta de persistência do núcleo de complementos e faltas (spec 008, etapa 4).
//
// As telas e componentes falam só com esta interface. Hoje existe apenas a
// implementação em memória (testes e demonstração). A implementação real será
// um adaptador para a API do Lucas, quando existirem as tabelas de evento de
// entrega por escola/produto e de decisão de falta — ver
// docs/propostas-pendentes.md §9. Não criar implementação em Prisma: seria um
// segundo núcleo operacional paralelo (proibido pelo prompt v2).

import { executeCommand, type Actor, type CommandResult, type CycleCommand, type CycleLedger } from "../domain/cycleLedger";

export interface CycleCoreRepository {
  // Estado atual do ciclo (pedidos, recebimentos do galpão, eventos, decisões, auditoria).
  load(cycleId: string): Promise<CycleLedger>;
  // Aplica um comando de forma atômica. O backend real deve repetir TODAS as
  // validações de `executeCommand` (não confiar no navegador), usar a versão
  // enviada para detectar edição concorrente e a chave de envio para ignorar
  // reenvios, e gravar evento + auditoria na mesma transação.
  execute(cycleId: string, command: CycleCommand, actor: Actor): Promise<CommandResult>;
}

export interface InMemoryOptions {
  clock?: () => string;
  newId?: () => string;
}

// Implementação em memória: guarda o estado só enquanto o objeto existir.
// Serve para testes e para a tela de demonstração — nunca para dados reais.
export class InMemoryCycleCoreRepository implements CycleCoreRepository {
  private ledgers = new Map<string, CycleLedger>();
  private readonly clock: () => string;
  private readonly newId: () => string;

  constructor(initial: CycleLedger[], options: InMemoryOptions = {}) {
    for (const l of initial) this.ledgers.set(l.cycleId, structuredClone(l));
    let seq = 0;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.newId = options.newId ?? (() => `mem-${++seq}`);
  }

  async load(cycleId: string): Promise<CycleLedger> {
    const ledger = this.ledgers.get(cycleId);
    if (!ledger) throw new Error("Ciclo não encontrado.");
    return structuredClone(ledger);
  }

  async execute(cycleId: string, command: CycleCommand, actor: Actor): Promise<CommandResult> {
    const ledger = this.ledgers.get(cycleId);
    if (!ledger) return { ok: false, code: "NAO_ENCONTRADO", error: "Ciclo não encontrado." };
    // Tudo ou nada: o estado só é trocado se o comando for aceito.
    const result = executeCommand(ledger, structuredClone(command), actor, { now: this.clock(), newId: this.newId });
    if (result.ok) this.ledgers.set(cycleId, result.ledger);
    return result.ok ? { ...result, ledger: structuredClone(result.ledger) } : result;
  }
}
