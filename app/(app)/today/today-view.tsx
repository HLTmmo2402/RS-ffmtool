"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type TodayItem = {
  id: string; itemStatus: string; productTitle: string | null; size: string | null;
  deadline: string | null; orderId: string | null; platformOrderId: string;
  customerName: string | null; orderDate: string | null; seller: string | null;
};

function daysBetween(dateStr: string | null, today: string): number | null {
  if (!dateStr) return null;
  const d = Date.parse(dateStr + "T00:00:00Z");
  const t = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(d) || Number.isNaN(t)) return null;
  return Math.round((t - d) / 86400000);
}
// deadline hợp lệ: có giá trị, < hôm nay, và trễ KHÔNG quá 180 ngày (loại ngày rác 1899…)
function overdueDays(it: TodayItem, today: string): number | null {
  const n = daysBetween(it.deadline, today);
  return n != null && n > 0 && n <= 180 ? n : null;
}

function List({ rows, today, mode }: { rows: TodayItem[]; today: string; mode: "overdue" | "aging" }) {
  if (rows.length === 0) return <div className="px-3 py-5 text-center text-sm text-slate-400">Không có.</div>;
  return (
    <table className="min-w-full text-sm">
      <tbody>
        {rows.slice(0, 200).map((r) => {
          const od = overdueDays(r, today);
          const age = daysBetween(r.orderDate, today);
          return (
            <tr key={r.id} className="border-t border-slate-100 first:border-0 hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2">
                {r.orderId ? <Link href={`/orders/${r.orderId}`} className="font-medium text-blue-600 hover:underline">{r.platformOrderId}</Link> : "—"}
              </td>
              <td className="px-2 py-2">{r.seller ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{r.seller}</span> : <span className="text-xs text-slate-300">—</span>}</td>
              <td className="max-w-[140px] truncate px-2 py-2 text-slate-500">{r.customerName ?? "—"}</td>
              <td className="max-w-[300px] truncate px-2 py-2">{r.productTitle ?? "—"}{r.size ? ` · ${r.size}` : ""}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {mode === "overdue" && od != null ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">trễ {od} ngày</span>
                ) : age != null && age >= 0 ? (
                  <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (age >= 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500")}>chờ {age} ngày</span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Card({ title, hint, count, tone, children }: { title: string; hint: string; count: number; tone: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={"flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 " + tone}>
        <span className="font-semibold">{title}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{count}</span>
        <span className="ml-auto text-xs opacity-70">{hint}</span>
      </div>
      {children}
    </section>
  );
}

export function TodayView({ items, today }: { items: TodayItem[]; today: string }) {
  const [q, setQ] = useState("");
  const [seller, setSeller] = useState("");

  const sellers = useMemo(
    () => [...new Set(items.map((i) => i.seller).filter(Boolean) as string[])].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (seller && i.seller !== seller) return false;
      if (!s) return true;
      return [i.platformOrderId, i.customerName, i.productTitle, i.seller, i.size].join(" ").toLowerCase().includes(s);
    });
  }, [items, q, seller]);

  const overdue = useMemo(
    () => filtered.filter((i) => overdueDays(i, today) != null)
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? "")),
    [filtered, today]
  );
  const byAge = (a: TodayItem, b: TodayItem) => (a.orderDate ?? "9999").localeCompare(b.orderDate ?? "9999");
  const design = useMemo(() => filtered.filter((i) => ["new", "waiting_design"].includes(i.itemStatus)).sort(byAge), [filtered]);
  const push = useMemo(() => filtered.filter((i) => ["design_ok", "ordered"].includes(i.itemStatus)).sort(byAge), [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Việc hôm nay</h1>
        <span className="text-sm text-slate-400">{new Date().toLocaleDateString("vi-VN")}</span>
        <span className="ml-auto text-sm text-slate-400">{overdue.length + design.length + push.length} việc</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm: Order ID, khách, sản phẩm, size…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        <select value={seller} onChange={(e) => setSeller(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Tất cả seller</option>
          {sellers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(q || seller) && <button onClick={() => { setQ(""); setSeller(""); }} className="text-xs text-blue-600 hover:underline">Xoá lọc</button>}
      </div>

      <Card title="⏰ Quá hạn ship" hint="trễ nhất lên đầu — xử lý ngay" count={overdue.length} tone="bg-red-50 text-red-800">
        <List rows={overdue} today={today} mode="overdue" />
      </Card>
      <Card title="🎨 Chờ design" hint="đơn để lâu nhất lên đầu" count={design.length} tone="bg-orange-50 text-orange-800">
        <List rows={design} today={today} mode="aging" />
      </Card>
      <Card title="🏭 Chờ FFM đẩy xưởng" hint="đủ điều kiện, chờ đẩy" count={push.length} tone="bg-amber-50 text-amber-800">
        <List rows={push} today={today} mode="aging" />
      </Card>
    </div>
  );
}
