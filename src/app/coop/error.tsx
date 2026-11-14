"use client";

export default function ErroCoop({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Deu um erro nesta tela</h2>
      <p className="erro">{error.message || "Erro inesperado."}</p>
      <p className="discreto">Nada do que você salvou se perdeu. Tente de novo; se continuar, tire uma foto desta mensagem e me manda.</p>
      <div className="botoes">
        <button type="button" className="botao" onClick={() => reset()}>
          Tentar de novo
        </button>
        <a className="botao claro" href="/coop">
          Voltar para as semanas
        </a>
      </div>
    </div>
  );
}
