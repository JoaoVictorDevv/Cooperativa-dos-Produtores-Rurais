"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { Icon } from "./Icon";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link className="brand" href="/painel">
        <span className="brand-symbol"><Icon name="leaf" size={18} /></span>
        <span><strong className="brand-mark">Colheita</strong><small>Gestão cooperativa</small></span>
      </Link>

      <div className="nav-group-label">Operação</div>
      {NAV_ITEMS.filter((item) => item.group === "operacao").map((item) => (
        <Link key={item.href} href={item.href} className={`nav-item${pathname === item.href || pathname.startsWith(`${item.href}/`) ? " active" : ""}`}>
          <Icon name={item.icon} size={18} /> <span>{item.label}</span>
        </Link>
      ))}
      <div className="nav-group-label">Gestão</div>
      {NAV_ITEMS.filter((item) => item.group === "gestao").map((item) => (
        <Link key={item.href} href={item.href} className={`nav-item${pathname === item.href || pathname.startsWith(`${item.href}/`) ? " active" : ""}`}>
          <Icon name={item.icon} size={18} /> <span>{item.label}</span>
        </Link>
      ))}
      <div className="sidebar-foot"><span className="online-dot" /> Sistema operacional</div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.slice(0, 5);

  return (
    <nav className="mobile-bottom">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={`m-item${pathname === item.href ? " active" : ""}`}>
          <Icon name={item.icon} size={20} />
          {item.label === "Visão geral" ? "Início" : item.label}
        </Link>
      ))}
    </nav>
  );
}
