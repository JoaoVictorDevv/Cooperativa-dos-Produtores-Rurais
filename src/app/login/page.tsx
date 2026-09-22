"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import Link from "next/link";
import { Icon } from "@/components/Icon";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="login-shell">
      <div className="login-visual">
        <Link className="login-home-brand" href="/"><span className="brand-symbol"><Icon name="leaf" size={18} /></span> Colheita</Link>
        <div className="login-visual-copy"><span className="overline overline-light">Gestão cooperativa</span><h1>Uma operação organizada começa com informação confiável.</h1><p>Pedidos, produtores, entregas e financeiro conectados em uma única rotina.</p></div>
        <div className="login-visual-foot"><Icon name="shield" size={18} /> Ambiente protegido e auditável</div>
      </div>
      <div className="login-panel">
      <form className="login-card" action={formAction}>
        <Link className="login-back" href="/">← Voltar ao site</Link>
        <div className="login-eyebrow">Acesso à plataforma</div>
        <h1 className="login-brand">Bem-vindo de volta</h1>
        <div className="login-sub">Entre com as credenciais fornecidas pela sua cooperativa.</div>

        <label className="login-label" htmlFor="email">
          Email
        </label>
        <input className="login-input" id="email" name="email" type="email" autoComplete="username" required />

        <label className="login-label" htmlFor="password">
          Senha
        </label>
        <input
          className="login-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        {state.error && <p className="login-error">{state.error}</p>}

        <button className="btn-primary login-submit" type="submit" disabled={pending}>
          {pending ? "Entrando…" : <>Entrar na plataforma <Icon name="arrow-right" size={17} /></>}
        </button>
        <div className="login-help"><Icon name="lock" size={15} /> Seu acesso é individual e protegido.</div>
      </form>
      </div>
    </div>
  );
}
