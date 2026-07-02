"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Tổng quan" },
  { href: "/orders/new", label: "Nhập đơn" },
  { href: "/orders", label: "Đơn hàng" },
  { href: "/orders/import", label: "Import" },
  { href: "/templates", label: "Template" },
  { href: "/factories", label: "Xưởng" },
  { href: "/selling-accounts", label: "TK bán" },
];

export function Nav({ role }: { role?: string }) {
  const p = usePathname();
  const links = [...LINKS];
  if (role === "ffm" || role === "admin") links.push({ href: "/finance", label: "Tài chính" });
  if (role === "admin") links.push({ href: "/activity", label: "Nhật ký" }, { href: "/admin/users", label: "Người dùng" });
  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {links.map((l) => {
        // '/orders' khớp CHÍNH XÁC để không nuốt /orders/new, /orders/import
        const active = l.href === "/orders" ? p === "/orders" : p === l.href || p.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href}
            className={"rounded-md px-3 py-1.5 " +
              (active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
