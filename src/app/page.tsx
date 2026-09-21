import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";

const capabilities = [
  { icon: "school" as const, index: "01", title: "Pedidos das escolas", text: "Centralize as demandas da rede escolar e acompanhe cada item, quantidade e entrega em um só lugar." },
  { icon: "users" as const, index: "02", title: "Distribuição entre produtores", text: "Divida a produção de forma clara, acompanhe limites do PNAE e mantenha todos os volumes rastreáveis." },
  { icon: "truck" as const, index: "03", title: "Entregas e devoluções", text: "Registre o que realmente chegou, trate devoluções e reduza divergências antes do fechamento semanal." },
  { icon: "balance" as const, index: "04", title: "Financeiro confiável", text: "Saiba quanto cobrar, quanto pagar e qual é o saldo real da operação, com custos e histórico preservados." },
];

const proof = [
  ["1 fluxo", "do pedido ao balanço"],
  ["100%", "das alterações auditáveis"],
  ["Visão anual", "do limite PNAE"],
];

export default function LandingPage() {
  return (
    <div className="marketing-page">
      <header className="marketing-nav">
        <Link className="marketing-brand" href="/" aria-label="Colheita — início">
          <span className="brand-symbol"><Icon name="leaf" size={19} /></span>
          <span>Colheita</span>
        </Link>
        <nav className="marketing-links" aria-label="Navegação principal">
          <a href="#plataforma">Plataforma</a>
          <a href="#operacao">Como funciona</a>
          <a href="#seguranca">Segurança</a>
        </nav>
        <div className="marketing-actions">
          <Link className="nav-login" href="/login">Entrar</Link>
          <a className="button button-light button-small" href="#contato">Cadastrar cooperativa</a>
        </div>
      </header>

      <main>
        <section className="marketing-hero">
          <Image className="hero-photo" src="/images/colheita-cooperativa-hero.png" alt="Produtores rurais organizando alimentos para entrega" fill priority sizes="100vw" />
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="hero-kicker"><span /> Gestão de cooperativas para o PNAE</div>
            <h1>Da produção rural à escola, com controle em cada etapa.</h1>
            <p>Uma plataforma para organizar pedidos, dividir a produção, acompanhar entregas e fechar o financeiro semanal sem depender de centenas de planilhas.</p>
            <div className="hero-actions">
              <Link className="button button-accent" href="/login">Acessar plataforma <Icon name="arrow-right" size={18} /></Link>
              <a className="button button-glass" href="#plataforma">Conhecer o sistema</a>
            </div>
          </div>
          <div className="hero-proof">
            {proof.map(([value, label]) => <div key={value}><strong>{value}</strong><span>{label}</span></div>)}
          </div>
        </section>

        <section className="trusted-strip" aria-label="Benefícios principais">
          <span>Operação semanal</span><i />
          <span>Rastreabilidade financeira</span><i />
          <span>Controle de produtores</span><i />
          <span>Histórico preservado</span>
        </section>

        <section className="marketing-section" id="plataforma">
          <div className="section-intro">
            <div><span className="overline">Uma operação, uma fonte de verdade</span><h2>Menos retrabalho.<br />Mais previsibilidade.</h2></div>
            <p>O Colheita conecta a rotina administrativa, produtiva e financeira da cooperativa. Cada informação é registrada uma única vez e acompanha todo o ciclo.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map((item) => (
              <article className="capability-card" key={item.index}>
                <div className="capability-top"><span className="capability-icon"><Icon name={item.icon} /></span><span className="capability-index">{item.index}</span></div>
                <h3>{item.title}</h3><p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="workflow-section" id="operacao">
          <div className="workflow-copy">
            <span className="overline overline-light">Rotina semanal organizada</span>
            <h2>O processo inteiro,<br />sem pontos cegos.</h2>
            <p>Do pedido inicial ao balanço final, a equipe acompanha pendências e toma decisões usando dados atualizados.</p>
            <Link className="text-link-light" href="/login">Ver o painel operacional <Icon name="arrow-right" size={17} /></Link>
          </div>
          <div className="workflow-list">
            {["Receba e consolide os pedidos das escolas", "Distribua os itens entre os produtores", "Registre entregas e ocorrências reais", "Confira valores e encerre a semana"].map((step, index) => (
              <div className="workflow-step" key={step}><span>0{index + 1}</span><strong>{step}</strong><Icon name="check" size={18} /></div>
            ))}
          </div>
        </section>

        <section className="assurance-section" id="seguranca">
          <div className="assurance-card">
            <span className="assurance-icon"><Icon name="shield" size={25} /></span>
            <span className="overline">Controle que protege a operação</span>
            <h2>Informação confiável para decisões importantes.</h2>
            <p>Semanas fechadas ficam protegidas, alterações críticas são auditadas e o sistema avisa sobre pendências antes que elas cheguem ao financeiro.</p>
            <ul><li><Icon name="check" /> Histórico de alterações</li><li><Icon name="check" /> Regras de fechamento</li><li><Icon name="check" /> Acesso por perfil</li></ul>
          </div>
          <div className="assurance-visual" aria-hidden="true">
            <div className="mini-window">
              <div className="mini-window-head"><span /><span /><span /></div>
              <div className="mini-window-body"><div className="mini-label">Balanço da semana</div><strong>R$ 48.720,40</strong><div className="mini-bar"><i /></div><div className="mini-rows"><span /><span /><span /></div></div>
            </div>
          </div>
        </section>

        <section className="cta-section" id="contato">
          <span className="overline">Pronto para sair da planilha?</span>
          <h2>Organize hoje a próxima semana da sua cooperativa.</h2>
          <p>A plataforma já está pronta para o primeiro ciclo operacional.</p>
          <div className="cta-actions"><Link className="button button-dark" href="/login">Entrar no Colheita <Icon name="arrow-right" size={18} /></Link><Link className="button button-outline-dark" href="/login?cadastro=1">Cadastrar cooperativa</Link></div>
        </section>
      </main>

      <footer className="marketing-footer"><div className="marketing-brand"><span className="brand-symbol"><Icon name="leaf" size={18} /></span><span>Colheita</span></div><p>Gestão inteligente para cooperativas que alimentam o futuro.</p><span>© 2026 · Petrópolis, RJ</span></footer>
    </div>
  );
}
