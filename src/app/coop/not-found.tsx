import Link from "next/link";

export default function NaoAchou() {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Não achei essa página</h2>
      <p className="discreto">A semana pode ter sido apagada, ou o endereço está errado.</p>
      <Link className="botao" href="/coop">
        Voltar para as semanas
      </Link>
    </div>
  );
}
