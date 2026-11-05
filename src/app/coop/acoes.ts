"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { garantirLocal, gravarCadastro, gravarPrevisao, gravarSemana, lerCadastro, lerPrevisao, lerSemana, listarSemanas } from "@/lib/coop/armazem";
import { lerConferencia, lerPedidoPrefeitura, type LinhaPedido } from "@/lib/coop/planilha/pedidoPrefeitura";
import { lerPlanilha } from "@/lib/coop/planilha/lerPlanilha";
import { novaSemana } from "@/lib/coop/semana";
import type { Previsao } from "@/lib/coop/previsao";
import type { Cadastro, Semana } from "@/lib/coop/tipos";

export type Resposta<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const MAX_ARQUIVO = 7 * 1024 * 1024;

async function arquivoDoForm(form: FormData, campo = "arquivo"): Promise<ArrayBuffer> {
  const f = form.get(campo);
  if (!(f instanceof File) || f.size === 0) throw new Error("Escolha o arquivo.");
  if (f.size > MAX_ARQUIVO) throw new Error("Arquivo grande demais (máximo 7 MB).");
  if (!/\.xlsx$/i.test(f.name)) throw new Error("O arquivo tem que ser .xlsx (Excel).");
  return f.arrayBuffer();
}

function erro(e: unknown): { ok: false; erro: string } {
  return { ok: false, erro: e instanceof Error ? e.message : "Não deu certo. Tente de novo." };
}

async function exigirCadastro(): Promise<Cadastro> {
  const c = await lerCadastro();
  if (!c) throw new Error("Importe primeiro o MODELO (tela Cadastro).");
  return c;
}

async function exigirSemana(data: string): Promise<Semana> {
  const s = await lerSemana(data);
  if (!s) throw new Error("Semana não encontrada.");
  return s;
}

// ---------- Cadastro ----------

export async function importarModelo(form: FormData): Promise<Resposta<{ resumo: string }>> {
  try {
    garantirLocal();
    const { cadastro, avisos } = await lerPlanilha(await arquivoDoForm(form));
    await gravarCadastro(cadastro);
    revalidatePath("/coop", "layout");
    const rotas = cadastro.rotas.reduce((s, r) => s + r.paradas.length, 0);
    return {
      ok: true,
      resumo: `${cadastro.produtos.length} produtos, ${cadastro.produtores.length} produtores, ${cadastro.escolas.length} escolas, ${cadastro.rotas.length} rotas (${rotas} paradas)${avisos.length ? ` · ${avisos.length} aviso(s)` : ""}.`,
    };
  } catch (e) {
    return erro(e);
  }
}

// Traz uma semana já feita na planilha (ex.: 20/10 e 26/10) para o histórico do app.
export async function importarSemanaDaPlanilha(form: FormData): Promise<Resposta<{ data: string }>> {
  try {
    garantirLocal();
    const { cadastro, semana } = await lerPlanilha(await arquivoDoForm(form));
    if (!semana.data) throw new Error("A planilha não tem a data da semana (ÍNDICE, D2).");
    if (!(await lerCadastro())) await gravarCadastro(cadastro);
    if ((await lerSemana(semana.data)) && form.get("substituir") !== "sim") {
      throw new Error(`A semana ${semana.referencia} já existe no app. Marque "substituir" para trocar.`);
    }
    // Semana feita na planilha: as mensagens já foram mandadas naquela época.
    const quando = new Date().toISOString();
    await gravarSemana({ ...semana, mensagensEnviadas: Object.fromEntries(cadastro.produtores.map((p) => [p.id, quando])) });
    revalidatePath("/coop", "layout");
    return { ok: true, data: semana.data };
  } catch (e) {
    return erro(e);
  }
}

// ---------- Pedido da Prefeitura ----------

export async function analisarPedido(form: FormData): Promise<
  Resposta<{ linhas: LinhaPedido[]; totalPrefeitura: Record<string, number>; foraDaLista: Record<string, number>; semCodigo: string[]; desconhecidas: string[]; previsao: Record<string, number> | null }>
> {
  try {
    garantirLocal();
    const cad = await exigirCadastro();
    const lido = await lerPedidoPrefeitura(await arquivoDoForm(form), cad.produtos.map((p) => p.nome));
    const conhecidas = new Set(cad.escolas.map((e) => e.codigo));
    const desconhecidas = [...new Set(lido.linhas.map((l) => l.codigo).filter((c) => !conhecidas.has(c)))];
    const data = String(form.get("data") ?? "");
    const prev = /^\d{4}-\d{2}-\d{2}$/.test(data) ? await lerPrevisao(data) : null;
    const previsao = prev ? prev.itens.reduce<Record<string, number>>((m, i) => ({ ...m, [i.produto]: (m[i.produto] ?? 0) + i.kg }), {}) : null;
    return { ok: true, ...lido, desconhecidas, previsao };
  } catch (e) {
    return erro(e);
  }
}

const esquemaCriar = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data da semana."),
  entrega: z.number().int().min(1).max(200),
  dias: z.tuple([z.string().min(3).max(12), z.string().min(3).max(12)]),
  linhas: z.array(z.object({ codigo: z.string().max(20), modalidade: z.enum(["UE", "UE Integral", "EMEI", "CEI"]), produto: z.string().max(60), kg: z.number().min(0).max(100000) })).max(20000),
  cortes: z.array(z.string().max(80)).max(400),
  substituir: z.boolean().optional(),
});

export async function criarSemana(entrada: z.infer<typeof esquemaCriar>): Promise<Resposta<{ data: string }>> {
  try {
    garantirLocal();
    const p = esquemaCriar.parse(entrada);
    const cad = await exigirCadastro();
    if ((await lerSemana(p.data)) && !p.substituir) throw new Error("Já existe uma semana com essa data.");
    const conhecidas = new Set(cad.escolas.map((e) => e.codigo));
    const produtos = new Set(cad.produtos.map((x) => x.nome));
    const cortes = new Set(p.cortes);
    const pedido: Semana["pedidoEscolas"] = {};
    const original: Semana["pedidoEscolas"] = {};
    for (const l of p.linhas) {
      if (!conhecidas.has(l.codigo)) throw new Error(`Escola ${l.codigo} não existe no cadastro.`);
      if (!produtos.has(l.produto)) continue;
      (original[l.codigo] ??= {})[l.produto] = (original[l.codigo][l.produto] ?? 0) + l.kg;
      if (cortes.has(`${l.modalidade}|${l.produto}`)) continue;
      (pedido[l.codigo] ??= {})[l.produto] = (pedido[l.codigo][l.produto] ?? 0) + l.kg;
    }
    const anteriores = (await listarSemanas()).filter((d) => d < p.data);
    const ultima = anteriores.length ? await lerSemana(anteriores[0]) : null;
    const s = novaSemana(cad, { data: p.data, entrega: p.entrega, diasGalpao: p.dias, pedidoEscolas: pedido, pedidoPrefeituraOriginal: original, custosAnteriores: ultima?.custos });
    await gravarSemana(s);
    revalidatePath("/coop", "layout");
    return { ok: true, data: s.data };
  } catch (e) {
    return erro(e);
  }
}

// ---------- Divisão e mensagens ----------

const kgOpcional = z.number().min(0).max(100000).nullable();
const mapaProdutos = z.record(z.string().max(60), kgOpcional);

export async function salvarAjustesDivisao(data: string, ajustes: Record<string, Record<string, number | null>>): Promise<Resposta> {
  try {
    garantirLocal();
    const a = z.record(z.string().max(80), mapaProdutos).parse(ajustes);
    const s = await exigirSemana(data);
    for (const [prod, itens] of Object.entries(a)) {
      for (const [produto, v] of Object.entries(itens)) {
        if (v === null) delete s.pedidoProdutorManual[prod]?.[produto];
        else (s.pedidoProdutorManual[prod] ??= {})[produto] = v;
      }
    }
    await gravarSemana(s);
    revalidatePath(`/coop/semana/${data}`, "layout");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

// "SÓ ESTA SEMANA" do Mapa de Produção: o produtor avisou que tem outra quantidade.
export async function salvarCapacidadeSemana(data: string, capacidade: Record<string, Record<string, number | null>>): Promise<Resposta> {
  try {
    garantirLocal();
    const c = z.record(z.string().max(60), z.record(z.string().max(80), kgOpcional)).parse(capacidade);
    const s = await exigirSemana(data);
    for (const [produto, itens] of Object.entries(c)) {
      for (const [prod, v] of Object.entries(itens)) {
        if (v === null) delete s.capacidadeSemana[produto]?.[prod];
        else (s.capacidadeSemana[produto] ??= {})[prod] = v;
      }
      if (s.capacidadeSemana[produto] && !Object.keys(s.capacidadeSemana[produto]).length) delete s.capacidadeSemana[produto];
    }
    await gravarSemana(s);
    revalidatePath(`/coop/semana/${data}`, "layout");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function marcarMensagemEnviada(data: string, produtor: string): Promise<Resposta> {
  try {
    garantirLocal();
    const s = await exigirSemana(data);
    s.mensagensEnviadas = { ...(s.mensagensEnviadas ?? {}), [z.string().max(80).parse(produtor)]: new Date().toISOString() };
    await gravarSemana(s);
    revalidatePath(`/coop/semana/${data}`, "layout");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

// ---------- Galpão ----------

export async function salvarEntrega(data: string, dia: "1" | "2" | "extra", produtor: string, valores: Record<string, number | null>): Promise<Resposta> {
  try {
    garantirLocal();
    const v = mapaProdutos.parse(valores);
    const s = await exigirSemana(data);
    const alvo = dia === "1" ? s.entrega1 : dia === "2" ? s.entrega2 : s.extra;
    const id = z.string().max(80).parse(produtor);
    const atual = { ...(alvo[id] ?? {}) };
    for (const [produto, kg] of Object.entries(v)) {
      if (kg === null) delete atual[produto];
      else atual[produto] = kg;
    }
    if (Object.keys(atual).length) alvo[id] = atual;
    else delete alvo[id];
    await gravarSemana(s);
    revalidatePath(`/coop/semana/${data}`, "layout");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

// ---------- Retornos das escolas ----------

const esquemaRetorno = z
  .object({
    recebido: z.number().min(0).max(100000).optional(),
    rejeitado: z.number().min(0).max(100000).optional(),
    motivo: z.string().max(10).optional(),
    situacao: z.string().max(60).optional(),
  })
  .nullable();

export async function salvarRetornos(data: string, retornos: Record<string, Record<string, z.infer<typeof esquemaRetorno>>>): Promise<Resposta> {
  try {
    garantirLocal();
    const r = z.record(z.string().max(20), z.record(z.string().max(60), esquemaRetorno)).parse(retornos);
    const s = await exigirSemana(data);
    for (const [codigo, itens] of Object.entries(r)) {
      for (const [produto, ret] of Object.entries(itens)) {
        if (!ret || Object.keys(ret).length === 0) {
          delete s.retornos[codigo]?.[produto];
          if (s.retornos[codigo] && !Object.keys(s.retornos[codigo]).length) delete s.retornos[codigo];
        } else (s.retornos[codigo] ??= {})[produto] = ret;
      }
    }
    await gravarSemana(s);
    revalidatePath(`/coop/semana/${data}`, "layout");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function marcarRomaneiosConferidos(data: string, conferidos: boolean): Promise<Resposta> {
  try {
    garantirLocal();
    const s = await exigirSemana(data);
    s.romaneiosConferidos = z.boolean().parse(conferidos);
    await gravarSemana(s);
    revalidatePath(`/coop/semana/${data}`, "layout");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

// ---------- Fechamento ----------

// Lê o arquivo de conferência que a Prefeitura manda por e-mail. Só devolve os
// números para a tela: o João confere e aí salva.
export async function lerConferenciaPrefeitura(form: FormData): Promise<Resposta<{ entregue: Record<string, number>; foraDaLista: string[] }>> {
  try {
    garantirLocal();
    const cad = await exigirCadastro();
    return { ok: true, ...(await lerConferencia(await arquivoDoForm(form), cad.produtos.map((p) => p.nome))) };
  } catch (e) {
    return erro(e);
  }
}

const esquemaFechamento = z.object({
  conferido: z.record(z.string().max(60), z.number().min(0).max(1000000)),
  custos: z.object({
    transporte: z.number().min(0),
    montagem: z.number().min(0),
    administrativo: z.number().min(0),
    administrativoFalta: z.number().min(0),
    embalagens: z.number().min(0),
    escritorio: z.number().min(0),
    impostos: z.number().min(0),
    contabilidade: z.number().min(0),
    conselho: z.number().min(0),
  }),
  romaneiosConferidos: z.boolean(),
});

export async function salvarFechamento(data: string, entrada: z.infer<typeof esquemaFechamento>): Promise<Resposta> {
  try {
    garantirLocal();
    const f = esquemaFechamento.parse(entrada);
    const s = await exigirSemana(data);
    s.conferidoPrefeitura = f.conferido;
    s.custos = f.custos;
    s.romaneiosConferidos = f.romaneiosConferidos;
    await gravarSemana(s);
    revalidatePath(`/coop/semana/${data}`, "layout");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

// ---------- Previsão ----------

const esquemaPrevisao = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itens: z.array(z.object({ produtor: z.string().max(80), produto: z.string().max(60), kg: z.number().min(0).max(1000000) })).max(2000),
  semProducao: z.array(z.string().max(80)).max(100),
  observacoes: z.array(z.string().max(300)).max(50),
  respostas: z.record(z.string().max(80), z.string().max(4000)),
});

export async function salvarPrevisao(p: Previsao): Promise<Resposta> {
  try {
    garantirLocal();
    await gravarPrevisao(esquemaPrevisao.parse(p));
    revalidatePath("/coop/previsao");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}
