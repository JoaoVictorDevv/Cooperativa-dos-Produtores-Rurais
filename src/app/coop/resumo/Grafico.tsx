import { reais } from "@/lib/coop/numeros";

export interface PontoSemana {
  ref: string; // "16/11"
  saldo: number;
  perdas: number;
}

const curto = (v: number) => {
  const a = Math.abs(v);
  const t = a >= 1000 ? `${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : Math.round(a).toLocaleString("pt-BR");
  return `${v < 0 ? "−" : ""}${t}`;
};

// Barras semana a semana: saldo (verde, ou vermelho quando negativo) e perdas.
export function GraficoSemanas({ pontos }: { pontos: PontoSemana[] }) {
  const L = 760;
  const A = 260;
  const m = { cima: 22, baixo: 34, esq: 56, dir: 10 };
  const maior = Math.max(1, ...pontos.flatMap((p) => [p.saldo, p.perdas]));
  const menor = Math.min(0, ...pontos.map((p) => p.saldo));
  const passo = [500, 1000, 2000, 2500, 5000, 10000, 20000].find((s) => (maior - menor) / s <= 6) ?? 50000;
  const topo = Math.ceil(maior / passo) * passo;
  const fundo = Math.floor(menor / passo) * passo;
  const y = (v: number) => m.cima + ((topo - v) / (topo - fundo)) * (A - m.cima - m.baixo);
  const grupo = (L - m.esq - m.dir) / pontos.length;
  const barra = Math.min(34, grupo / 3);
  const marcas: number[] = [];
  for (let v = fundo; v <= topo + 0.1; v += passo) marcas.push(v);
  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Saldo e perdas por semana">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.esq} x2={L - m.dir} y1={y(v)} y2={y(v)} className={v === 0 ? "eixo" : "grade"} />
            <text x={m.esq - 6} y={y(v) + 4} textAnchor="end" className="rotulo">
              {curto(v)}
            </text>
          </g>
        ))}
        {pontos.map((p, i) => {
          const cx = m.esq + grupo * i + grupo / 2;
          const xs = cx - barra - 2;
          const xp = cx + 2;
          return (
            <g key={p.ref}>
              <rect x={xs} width={barra} y={Math.min(y(p.saldo), y(0))} height={Math.abs(y(p.saldo) - y(0))} rx={3} className={p.saldo >= 0 ? "saldo" : "negativo"}>
                <title>{`Saldo ${p.ref}: ${reais(p.saldo)}`}</title>
              </rect>
              <rect x={xp} width={barra} y={y(p.perdas)} height={y(0) - y(p.perdas)} rx={3} className="perdas">
                <title>{`Perdas ${p.ref}: ${reais(p.perdas)}`}</title>
              </rect>
              <text x={xs + barra / 2} y={p.saldo >= 0 ? y(p.saldo) - 5 : y(p.saldo) + 13} textAnchor="middle" className="valor">
                {curto(p.saldo)}
              </text>
              <text x={xp + barra / 2} y={y(p.perdas) - 5} textAnchor="middle" className="valor perdas-t">
                {curto(p.perdas)}
              </text>
              <text x={cx} y={A - 12} textAnchor="middle" className="rotulo semana">
                {p.ref}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="legenda">
        <span className="ponto saldo" /> Saldo da semana <span className="ponto negativo" /> saldo negativo <span className="ponto perdas" /> Perdas (Prefeitura não pagou)
      </p>
    </div>
  );
}
