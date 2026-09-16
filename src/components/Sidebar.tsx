"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark display">Colheita</span>
      </div>
      <div className="brand-sub">Cooperativa dos Produtores
        <br />
        Rurais de Petrópolis
      </div>

      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-item${pathname === item.href ? " active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.slice(0, 4);

  return (
    <nav className="mobile-bottom">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={`m-item${pathname === item.href ? " active" : ""}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
