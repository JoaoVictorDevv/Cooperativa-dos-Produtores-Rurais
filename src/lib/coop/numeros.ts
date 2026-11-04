// Arredondamentos iguais aos do Excel (ROUND e ROUNDDOWN), para o app dar
// exatamente os mesmos números da planilha.

// O Excel trabalha com 15 dígitos significativos: 0,285 × 100 dá 28,5 lá,
// mas 28,499999… em JavaScript. Normaliza antes de arredondar.
function limpa(x: number): number {
  return Number(x.toPrecision(15));
}

export function arred(x: number, casas = 2): number {
  const f = 10 ** casas;
  const v = limpa(Math.abs(x) * f);
  return (Math.sign(x) * Math.round(v)) / f || 0;
}

export function arredBaixo(x: number, casas = 2): number {
  const f = 10 ** casas;
  const v = limpa(Math.abs(x) * f);
  return (Math.sign(x) * Math.floor(v)) / f || 0;
}

export function soma(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0);
}

export function kg(x: number, casas = 2): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas }).format(arred(x, casas));
}

export function kg2(x: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(arred(x, 2));
}

export function reais(x: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(arred(x, 2));
}

// "19,32" como na mensagem da planilha: inteiro sem vírgula, senão 2 casas.
export function kgMensagem(x: number): string {
  const r = arred(x, 2);
  const inteiro = Math.trunc(r);
  const centavos = Math.round((r - inteiro) * 100);
  return centavos > 0 ? `${inteiro},${String(centavos).padStart(2, "0")}` : String(inteiro);
}
