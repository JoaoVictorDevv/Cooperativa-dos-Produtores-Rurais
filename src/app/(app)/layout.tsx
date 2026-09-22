import { verifySession } from "@/lib/dal";
import { logout } from "@/app/actions/logout";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Icon } from "@/components/Icon";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();

  return (
    <div className="shell">
      <div className="mobile-top">
        <span className="mobile-brand"><span className="brand-symbol"><Icon name="leaf" size={17} /></span> Colheita</span>
      </div>

      <Sidebar />

      <div className="workspace">
        <header className="app-topbar">
          <div className="app-context"><span className="online-dot" /> Operação PNAE <span className="context-separator" /> Petrópolis, RJ</div>
          <div className="user-area">
            <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="user-copy"><strong>{user.name}</strong><small>{user.role === "ADMIN" ? "Administrador" : "Operador"}</small></span>
            <form action={logout}><button className="icon-button" type="submit" title="Sair"><Icon name="logout" size={18} /><span className="sr-only">Sair</span></button></form>
          </div>
        </header>
        <main className="main">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
