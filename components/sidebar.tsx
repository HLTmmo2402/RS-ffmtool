"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

const BASE: Item[] = [
  { href: "/dashboard", label: "Tổng quan", icon: "📊" },
  { href: "/orders/new", label: "Nhập đơn", icon: "📝" },
  { href: "/orders", label: "Đơn hàng", icon: "📦" },
  { href: "/orders/import", label: "Import", icon: "⬆️" },
  { href: "/templates", label: "Template", icon: "🎨" },
  { href: "/factories", label: "Xưởng", icon: "🏭" },
  { href: "/selling-accounts", label: "TK bán", icon: "🏷️" },
];

export function Sidebar({ role, userName, userRole }: { role?: string; userName: string; userRole: string }) {
  const p = usePathname();
  const [open, setOpen] = useState(false);

  const links = [...BASE];
  if (role === "ffm" || role === "admin") links.push({ href: "/finance", label: "Tài chính", icon: "💰" });
  if (role === "admin") links.push(
    { href: "/activity", label: "Nhật ký", icon: "📜" },
    { href: "/admin/users", label: "Người dùng", icon: "👥" },
  );

  const initials = (userName || "?").trim().split(/\s+/).slice(-1)[0].slice(0, 2).toUpperCase();

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {links.map((l) => {
        const active = l.href === "/orders" ? p === "/orders" : p === l.href || p.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
            className={"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition " +
              (active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
            <span className="w-5 text-center text-base leading-none">{l.icon}</span>
            <span className="font-medium">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const inner = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">FF</span>
          <div>
            <div className="text-sm font-bold leading-tight">FFM Tool</div>
            <div className="text-[11px] text-slate-400">Fulfillment POD · RSA</div>
          </div>
        </div>
      </div>
      {nav}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="text-[11px] text-slate-400">{userRole}</div>
          </div>
        </div>
        <form action="/auth/signout" method="post" className="mt-1">
          <button className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Thanh trên cùng (mobile) */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-xs font-bold text-white">FF</span>
          <span className="font-semibold">FFM Tool</span>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-md border border-slate-300 px-3 py-1 text-lg leading-none">☰</button>
      </div>

      {/* Overlay mobile */}
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={"fixed top-0 z-40 h-screen w-60 shrink-0 border-r border-slate-200 bg-white transition-transform md:sticky md:z-0 md:translate-x-0 " +
        (open ? "translate-x-0" : "-translate-x-full")}>
        {inner}
      </aside>
    </>
  );
}
