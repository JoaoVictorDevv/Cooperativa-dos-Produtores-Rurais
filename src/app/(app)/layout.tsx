import { verifySession } from "@/lib/dal";
import { logout } from "@/app/actions/logout";
import { Sidebar, MobileNav } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();

  return (
    <div className="shell">
      <div className="mobile-top">
        <span className="brand-mark display">Colheita</span>
      </div>

      <Sidebar />

      <main className="main">
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 18 }}>
          <span className="filter-chip">
            {user.name} · {user.role}
          </span>
          <form action={logout}>
            <button className="btn-ghost" type="submit">
              Sair
            </button>
          </form>
        </div>
        {children}
      </main>

      <MobileNav />
    </div>
  );
}
