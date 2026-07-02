import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ItemLite = { item_status: string };
type OrderRow = {
  id: string; order_date: string | null; platform_order_id: string;
  customer_name: string | null; seller_name_import: string | null; order_items: ItemLite[];
};

const STAGE: Record<string, { label: string; cls: string }> = {
  issue: { label: "Sự cố", cls: "bg-red-100 text-red-700" },
  cancelled: { label: "Huỷ", cls: "bg-slate-200 text-slate-600" },
  delivered: { label: "Đã giao", cls: "bg-emerald-100 text-emerald-700" },
  synced: { label: "Đã sync", cls: "bg-teal-100 text-teal-700" },
  has_tracking: { label: "Có tracking", cls: "bg-blue-100 text-blue-700" },
  in_production: { label: "Đang SX", cls: "bg-indigo-100 text-indigo-700" },
  ordered: { label: "Chờ đẩy", cls: "bg-amber-100 text-amber-700" },
  design_ok: { label: "Design OK", cls: "bg-lime-100 text-lime-700" },
  waiting_design: { label: "Chờ design", cls: "bg-orange-100 text-orange-700" },
  new: { label: "Mới", cls: "bg-slate-100 text-slate-600" },
};
function stageKey(items: ItemLite[]): string {
  if (!items.length) return "new";
  const has = (s: string) => items.some((i) => i.item_status === s);
  const all = (s: string) => items.every((i) => i.item_status === s);
  if (has("issue")) return "issue";
  if (all("cancelled")) return "cancelled";
  if (all("delivered")) return "delivered";
  if (has("synced")) return "synced";
  if (has("has_tracking")) return "has_tracking";
  if (has("in_production")) return "in_production";
  if (has("ordered")) return "ordered";
  if (has("design_ok")) return "design_ok";
  if (has("waiting_design")) return "waiting_design";
  return "new";
}
const OPEN = new Set(["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking"]);

export default async function DashboardPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [ordRes, itRes, balRes] = await Promise.all([
    supabase.from("orders")
      .select("id, order_date, platform_order_id, customer_name, seller_name_import, order_items(item_status)")
      .order("order_date", { ascending: false, nullsFirst: false }).limit(3000),
    supabase.from("order_items").select("item_status, deadline_ship, factories(name)").limit(4000),
    supabase.from("v_factory_balance").select("name, balance_usd"),
  ]);

  if (ordRes.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Tổng quan</h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Chưa đọc được dữ liệu ({ordRes.error.message}). Kiểm tra đã chạy migration 0001–0004 + bản vá RLS chưa.
        </div>
      </div>
    );
  }

  const orders = (ordRes.data as OrderRow[] | null) ?? [];
  const stages: Record<string, number> = {};
  for (const o of orders) { const k = stageKey(o.order_items ?? []); stages[k] = (stages[k] ?? 0) + 1; }
  const cnt = (keys: string[]) => keys.reduce((n, k) => n + (stages[k] ?? 0), 0);

  const items = (itRes.data as { item_status: string; deadline_ship: string | null; factories: { name: string } | { name: string }[] | null }[] | null) ?? [];
  const byFactory: Record<string, number> = {};
  let overdue = 0;
  for (const it of items) {
    if (!OPEN.has(it.item_status)) continue;
    const fac = Array.isArray(it.factories) ? it.factories[0]?.name : it.factories?.name;
    byFactory[fac ?? "(chưa gán xưởng)"] = (byFactory[fac ?? "(chưa gán xưởng)"] ?? 0) + 1;
    if (it.deadline_ship && it.deadline_ship < today) overdue++;
  }
  const queue = Object.entries(byFactory).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const balances = ((balRes.data as { name: string; balance_usd: number }[] | null) ?? [])
    .filter((b) => Number(b.balance_usd) < 0).sort((a, b) => Number(a.balance_usd) - Number(b.balance_usd)).slice(0, 8);

  const todayCount = orders.filter((o) => o.order_date === today).length;
  const weekCount = orders.filter((o) => o.order_date && o.order_date >= weekAgo).length;
  const recent = orders.slice(0, 8);

  const cards = [
    { label: "Tổng đơn", value: orders.length, cls: "text-slate-900" },
    { label: "Đơn hôm nay", value: todayCount, cls: "text-slate-900" },
    { label: "7 ngày qua", value: weekCount, cls: "text-slate-900" },
    { label: "Đang xử lý", value: cnt([...OPEN]), cls: "text-blue-600" },
    { label: "Quá hạn ship", value: overdue, cls: "text-red-600" },
    { label: "Đã giao", value: cnt(["delivered", "synced"]), cls: "text-emerald-600" },
  ];
  const dist = [
    { k: "Chờ design", n: cnt(["new", "waiting_design"]), c: "bg-orange-400" },
    { k: "Chờ FFM", n: cnt(["design_ok", "ordered"]), c: "bg-amber-400" },
    { k: "Đang SX/ship", n: cnt(["in_production", "has_tracking"]), c: "bg-blue-400" },
    { k: "Đã giao", n: cnt(["delivered", "synced"]), c: "bg-emerald-400" },
    { k: "Sự cố", n: cnt(["issue"]), c: "bg-red-400" },
    { k: "Huỷ", n: cnt(["cancelled"]), c: "bg-slate-300" },
  ];
  const totalD = dist.reduce((s, d) => s + d.n, 0) || 1;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Tổng quan</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={"text-2xl font-semibold " + c.cls}>{c.value}</div>
            <div className="mt-1 text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      {overdue > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <span>⏰ Có <b>{overdue}</b> sản phẩm quá hạn ship chưa giao.</span>
          <Link href="/today" className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">Xem việc hôm nay →</Link>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Phân bố đơn theo tiến độ</h2>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
          {dist.filter((d) => d.n > 0).map((d) => (
            <div key={d.k} className={d.c} style={{ width: `${(d.n / totalD) * 100}%` }} title={`${d.k}: ${d.n}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {dist.map((d) => (
            <div key={d.k} className="flex items-center gap-1.5 text-xs">
              <span className={"h-3 w-3 rounded-sm " + d.c} />
              <span className="text-slate-600">{d.k}</span>
              <span className="font-semibold">{d.n}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Đơn gần đây */}
        <section className="space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Đơn gần đây</h2>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline">Tất cả đơn →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <tbody>
                {recent.length === 0 ? (
                  <tr><td className="px-3 py-6 text-center text-slate-400">Chưa có đơn. Vào Import để nạp.</td></tr>
                ) : recent.map((o) => {
                  const s = STAGE[stageKey(o.order_items ?? [])];
                  return (
                    <tr key={o.id} className="border-t border-slate-100 first:border-0 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">{o.order_date ? new Date(o.order_date).toLocaleDateString("vi-VN") : "—"}</td>
                      <td className="px-2 py-2"><Link href={`/orders/${o.id}`} className="font-medium text-blue-600 hover:underline">{o.platform_order_id}</Link></td>
                      <td className="px-2 py-2">{o.seller_name_import ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{o.seller_name_import}</span> : ""}</td>
                      <td className="max-w-[140px] truncate px-2 py-2 text-slate-500">{o.customer_name ?? "—"}</td>
                      <td className="px-3 py-2 text-right"><span className={"rounded px-2 py-0.5 text-xs " + s.cls}>{s.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Hàng chờ xưởng + số dư */}
        <div className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700">Hàng chờ theo xưởng</h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <tbody>
                  {queue.length === 0 ? (
                    <tr><td className="px-3 py-5 text-center text-slate-400">Không có hàng chờ.</td></tr>
                  ) : queue.map(([name, n]) => (
                    <tr key={name} className="border-t border-slate-100 first:border-0">
                      <td className="px-3 py-1.5">{name}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Xưởng cần topup</h2>
              <Link href="/finance" className="text-xs text-blue-600 hover:underline">Tài chính →</Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <tbody>
                  {balances.length === 0 ? (
                    <tr><td className="px-3 py-5 text-center text-slate-400">Không có xưởng âm số dư.</td></tr>
                  ) : balances.map((b) => (
                    <tr key={b.name} className="border-t border-slate-100 first:border-0">
                      <td className="px-3 py-1.5">{b.name}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-red-600">{Number(b.balance_usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
