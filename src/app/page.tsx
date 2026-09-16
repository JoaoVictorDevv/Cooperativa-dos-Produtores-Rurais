import { verifySession } from "@/lib/dal";
import { logout } from "@/app/actions/logout";

export default async function Home() {
  const user = await verifySession();

  return (
    <div className="login-shell">
      <div className="login-card" style={{ maxWidth: 480, alignItems: "flex-start" }}>
        <div className="login-brand display" style={{ textAlign: "left" }}>
          Colheita
        </div>
        <div className="login-sub" style={{ textAlign: "left" }}>
          Autenticação funcionando — dashboard real ainda por construir.
        </div>
        <p>
          Logado como <strong>{user.name}</strong> ({user.email}) — papel <strong>{user.role}</strong>.
        </p>
        <form action={logout}>
          <button className="btn-ghost" type="submit">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
