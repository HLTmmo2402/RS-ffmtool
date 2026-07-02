"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Tổng quan" },
  { href: "/orders", label: "Đơn hàng" },
  { href: "/orders/import", label: "Import Cotik" },
  { href: "/factories", label: "Xưởng" },
  { href: "/templates", label: "Template" },
  { href: "/selling-accounts", label: "TK bán" },
];

export function Nav() {
  const p = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {LINKS.map((l) => {
        const active =
          l.href === "/orders"
            ? p === "/orders" ||
              (p.startsWith("/orders/") && !p.startsWith("/orders/import"))
            : p === l.href || p.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "rounded-md px-3 py-1.5 " +
              (active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
