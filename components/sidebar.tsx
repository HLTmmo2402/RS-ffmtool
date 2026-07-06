"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ScrollText, LogOut, Menu, type LucideIcon } from "lucide-react";
import { MODULES } from "@/lib/modules";

type Item = { key: string; href: string; label: string; icon: LucideIcon };

export function Sidebar({
  role, userName, userRole, todayCount = 0, allowedModules = null,
}: {
  role?: string; userName: string; userRole: string; todayCount?: number; allowedModules?: string[] | null;
}) {
  const p = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = role === "admin";
  const isFFM = role === "ffm" || role === "admin";

  const canSee = (key: string, ffmOnly?: boolean) => {
    if (ffmOnly && !isFFM) return false;
    if (!isAdmin && allowedModules && key !== "dashboard" && !allowedModules.includes(key)) return false;
    return true;
  };

  const dash: Item = { key: "dashboard", href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard };
  const pick = (g: string) => MODULES.filter((m) => m.group === g && canSee(m.key, m.ffmOnly)).map((m) => ({ key: m.key, href: m.href, label: m.label, icon: m.icon }));

  const groups: { title: string; items: Item[] }[] = [
    { title: "Vận hành", items: [dash, ...pick("Vận hành")] },
    { title: "Báo cáo", items: pick("Báo cáo") },
    { title: "Danh mục", items: pick("Danh mục") },
  ];
  if (isAdmin) groups.push({
    title: "Quản trị",
    items: [
      { key: "admin_users", href: "/admin/users", label: "Người dùng & Phân quyền", icon: Users },
      { key: "activity", href: "/activity", label: "Nhật ký", icon: ScrollText },
    ],
  });
  const shown = groups.filter((g) => g.items.length > 0);

  const initials = (userName || "?").trim().split(/\s+/).slice(-1)[0].slice(0, 2).toUpperCase();
  const isActive = (href: string) => (href === "/orders" ? p === "/orders" : p === href || p.startsWith(href + "/"));

  const nav = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
      {shown.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map((l) => {
              const on = isActive(l.href);
              const Icon = l.icon;
              return (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className={"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition " +
                    (on ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{l.label}</span>
                  {l.key === "today" && todayCount > 0 && (
                    <span className={"ml-auto rounded-full px-2 py-0.5 text-xs font-semibold " + (on ? "bg-white/20 text-white" : "bg-red-100 text-red-700")}>{todayCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const inner = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">FF</span>
          <div>
            <div className="text-sm font-bold leading-tight">FFM Tool</div>
            <div className="text-xs text-slate-400">Fulfillment POD · RSA</div>
          </div>
        </div>
      </div>
      {nav}
      <div className="border-t border-slate-200 p-3">
        <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="text-xs text-slate-400">{userRole}</div>
          </div>
        </Link>
        <form action="/auth/signout" method="post" className="mt-1">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" /> Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-xs font-bold text-white">FF</span>
          <span className="font-semibold">FFM Tool</span>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-md border border-slate-300 p-1.5"><Menu className="h-5 w-5" /></button>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      <aside className={"fixed top-0 z-40 h-screen w-60 shrink-0 border-r border-slate-200 bg-white transition-transform md:sticky md:z-0 md:translate-x-0 " + (open ? "translate-x-0" : "-translate-x-full")}>
        {inner}
      </aside>
    </>
  );
}
