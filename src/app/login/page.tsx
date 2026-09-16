"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="login-shell">
      <form className="login-card" action={formAction}>
        <div className="login-brand display">Colheita</div>
        <div className="login-sub">Cooperativa dos Produtores Rurais de Petrópolis</div>

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
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
