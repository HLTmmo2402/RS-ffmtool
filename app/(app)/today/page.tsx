import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Ord = {
  id: string; platform_order_id: string; customer_name: string | null;
  order_date: string | null; seller_name_import: string | null;
};
type Row = {
  id: string; item_status: string; product_title: string | null; size: string | null;
  deadline_ship: string | null; order: Ord | Ord[] | null;
};
const ordOf = (r: Row): Ord | null => (Array.isArray(r.order) ? r.order[0] ?? null : r.order);

function daysBetween(dateStr: string | null, today: string): number | null {
  if (!dateStr) return null;
  const d = Date.parse(dateStr + "T00:00:00Z");
  const t = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(d) || Number.isNaN(t)) return null;
  return Math.round((t - d) / 86400000);
}

function List({ rows, today, mode, empty }: { rows: Row[]; today: string; mode: "overdue" | "aging"; empty: string }) {
  if (rows.length === 0) return <div className="px-3 py-5 text-center text-sm text-slate-400">{empty}</div>;
  return (
    <table className="min-w-full text-sm">
      <tbody>
        {rows.slice(0, 60).map((r) => {
          const o = ordOf(r);
          const overdue = daysBetween(r.deadline_ship, today);
          const age = daysBetween(o?.order_date ?? null, today);
          return (
            <tr key={r.id} className="border-t border-slate-100 first:border-0 hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2">
                {o ? <Link href={`/orders/${o.id}`} className="font-medium text-blue-600 hover:underline">{o.platform_order_id}</Link> : "—"}
              </td>
              <td className="px-2 py-2">
                {o?.seller_name_import
                  ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{o.seller_name_import}</span>
                  : <span className="text-xs text-slate-300">—</span>}
              </td>
              <td className="max-w-[140px] truncate px-2 py-2 text-slate-500">{o?.customer_name ?? "—"}</td>
              <td className="max-w-[300px] truncate px-2 py-2">{r.product_title ?? "—"}{r.size ? ` · ${r.size}` : ""}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {mode === "overdue" && overdue != null && overdue > 0 ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">trễ {overdue} ngày</span>
                ) : age != null && age >= 0 ? (
                  <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (age >= 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500")}>
                    chờ {age} ngày
                  </span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Card({ title, hint, count, tone, children }: {
  title: string; hint: string; count: number; tone: string; children: React.ReactNode;
}) {
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

export default async function TodayPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("order_items")
    .select("id, item_status, product_title, size, deadline_ship, order:orders(id, platform_order_id, customer_name, order_date, seller_name_import)")
    .in("item_status", ["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking"])
    .limit(3000);

  const items = (data as Row[] | null) ?? [];

  // Quá hạn: deadline < hôm nay -> trễ nhất lên đầu
  const overdue = items
    .filter((i) => i.deadline_ship && i.deadline_ship < today)
    .sort((a, b) => (a.deadline_ship ?? "").localeCompare(b.deadline_ship ?? ""));
  // Chờ design / chờ đẩy: đơn để LÂU nhất lên đầu (theo ngày order tăng dần)
  const byAge = (a: Row, b: Row) => (ordOf(a)?.order_date ?? "9999").localeCompare(ordOf(b)?.order_date ?? "9999");
  const design = items.filter((i) => ["new", "waiting_design"].includes(i.item_status)).sort(byAge);
  const push = items.filter((i) => ["design_ok", "ordered"].includes(i.item_status)).sort(byAge);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Việc hôm nay</h1>
        <span className="text-sm text-slate-400">{new Date().toLocaleDateString("vi-VN")}</span>
        <span className="ml-auto text-sm text-slate-400">{overdue.length + design.length + push.length} việc cần xử lý</span>
      </div>

      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error.message}</div>
      ) : (
        <>
          <Card title="⏰ Quá hạn ship" hint="trễ nhất lên đầu — xử lý ngay" count={overdue.length} tone="bg-red-50 text-red-800">
            <List rows={overdue} today={today} mode="overdue" empty="Không có đơn quá hạn 🎉" />
          </Card>
          <Card title="🎨 Chờ design" hint="đơn để lâu nhất lên đầu" count={design.length} tone="bg-orange-50 text-orange-800">
            <List rows={design} today={today} mode="aging" empty="Không có." />
          </Card>
          <Card title="🏭 Chờ FFM đẩy xưởng" hint="đủ điều kiện, chờ đẩy" count={push.length} tone="bg-amber-50 text-amber-800">
            <List rows={push} today={today} mode="aging" empty="Không có." />
          </Card>
        </>
      )}
    </div>
  );
}
