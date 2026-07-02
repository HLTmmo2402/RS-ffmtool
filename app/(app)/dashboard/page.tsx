import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ItemLite = { item_status: string };
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

  const [ordRes, itRes, balRes] = await Promise.all([
    supabase.from("orders").select("id, order_items(item_status)").limit(3000),
    supabase.from("order_items").select("item_status, deadline_ship, factories(name)").limit(4000),
    supabase.from("v_factory_balance").select("name, balance_usd"),
  ]);

  if (ordRes.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Tổng quan</h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Chưa đọc được dữ liệu ({ordRes.error.message}). Kiểm tra đã chạy migration 0001+0002 và cấu hình Supabase (README).
        </div>
      </div>
    );
  }

  const orders = (ordRes.data ?? []) as { id: string; order_items: ItemLite[] }[];
  const stages: Record<string, number> = {};
  for (const o of orders) { const k = stageKey(o.order_items ?? []); stages[k] = (stages[k] ?? 0) + 1; }
  const cnt = (keys: string[]) => keys.reduce((n, k) => n + (stages[k] ?? 0), 0);

  const items = (itRes.data ?? []) as { item_status: string; deadline_ship: string | null; factories: { name: string } | { name: string }[] | null }[];
  const byFactory: Record<string, number> = {};
  let overdue = 0;
  for (const it of items) {
    if (!OPEN.has(it.item_status)) continue;
    const fac = Array.isArray(it.factories) ? it.factories[0]?.name : it.factories?.name;
    const name = fac ?? "(chưa gán xưởng)";
    byFactory[name] = (byFactory[name] ?? 0) + 1;
    if (it.deadline_ship && it.deadline_ship < today) overdue++;
  }
  const queue = Object.entries(byFactory).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const balances = (balRes.data ?? []).filter((b) => Number(b.balance_usd) < 0)
    .sort((a, b) => Number(a.balance_usd) - Number(b.balance_usd)).slice(0, 8);

  const cards = [
    { label: "Tổng đơn", value: orders.length, cls: "text-slate-900" },
    { label: "Chờ seller (design)", value: cnt(["new", "waiting_design"]), cls: "text-orange-600" },
    { label: "Chờ FFM đẩy xưởng", value: cnt(["design_ok", "ordered"]), cls: "text-amber-600" },
    { label: "Đang SX / vận chuyển", value: cnt(["in_production", "has_tracking"]), cls: "text-blue-600" },
    { label: "Đã giao / sync", value: cnt(["delivered", "synced"]), cls: "text-emerald-600" },
    { label: "Sự cố", value: cnt(["issue"]), cls: "text-red-600" },
  ];

  const dist = [
    { k: "Chờ seller", n: cnt(["new", "waiting_design"]), c: "bg-orange-400" },
    { k: "Chờ FFM", n: cnt(["design_ok", "ordered"]), c: "bg-amber-400" },
    { k: "Đang SX/ship", n: cnt(["in_production", "has_tracking"]), c: "bg-blue-400" },
    { k: "Đã giao", n: cnt(["delivered", "synced"]), c: "bg-emerald-400" },
    { k: "Sự cố", n: cnt(["issue"]), c: "bg-red-400" },
    { k: "Huỷ", n: cnt(["cancelled"]), c: "bg-slate-300" },
  ];
  const totalD = dist.reduce((s, d) => s + d.n, 0) || 1;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Tổng quan</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className={"text-2xl font-semibold " + c.cls}>{c.value}</div>
            <div className="mt-1 text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      {overdue > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          ⏰ Có <b>{overdue}</b> sản phẩm quá hạn ship (Deadline &lt; hôm nay) mà chưa giao. Ưu tiên xử lý.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Hàng chờ theo xưởng (item chưa giao)</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left"><tr>
                <th className="px-3 py-2 font-medium text-slate-600">Xưởng</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Số item chờ</th>
              </tr></thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={2} className="px-3 py-6 text-center text-slate-400">Không có hàng chờ.</td></tr>
                ) : queue.map(([name, n]) => (
                  <tr key={name} className="border-t border-slate-100">
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
            <h2 className="text-sm font-semibold text-slate-700">Xưởng số dư âm (cần topup)</h2>
            <Link href="/finance" className="text-xs text-blue-600 hover:underline">Tài chính →</Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left"><tr>
                <th className="px-3 py-2 font-medium text-slate-600">Xưởng</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Số dư (USD)</th>
              </tr></thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr><td colSpan={2} className="px-3 py-6 text-center text-slate-400">Không có xưởng âm số dư.</td></tr>
                ) : balances.map((b) => (
                  <tr key={b.name} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">{b.name}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-red-600">
                      {Number(b.balance_usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
