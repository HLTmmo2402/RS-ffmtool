import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Ord = { id: string; platform_order_id: string; customer_name: string | null };
type Row = {
  id: string; item_status: string; product_title: string | null; size: string | null;
  deadline_ship: string | null; order: Ord | Ord[] | null;
};

function ord(r: Row): Ord | null {
  return Array.isArray(r.order) ? r.order[0] ?? null : r.order;
}

function Section({ title, note, items, cls }: { title: string; note: string; items: Row[]; cls: string }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + cls}>{items.length}</span>
        <span className="text-xs text-slate-400">{note}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-400">Không có.</div>
        ) : (
          <table className="min-w-full text-sm">
            <tbody>
              {items.slice(0, 100).map((r) => {
                const o = ord(r);
                return (
                  <tr key={r.id} className="border-t border-slate-100 first:border-0 hover:bg-slate-50">
                    <td className="px-3 py-1.5">
                      {o ? <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">{o.platform_order_id}</Link> : "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-1.5 text-slate-500">{o?.customer_name ?? "—"}</td>
                    <td className="max-w-[280px] truncate px-3 py-1.5">
                      {r.product_title ?? "—"}{r.size ? ` · ${r.size}` : ""}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-400">{r.deadline_ship ? `hạn ${r.deadline_ship}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default async function TodayPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("order_items")
    .select("id, item_status, product_title, size, deadline_ship, order:orders(id, platform_order_id, customer_name)")
    .in("item_status", ["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking"])
    .limit(3000);

  const items = ((data as Row[] | null) ?? []);
  const design = items.filter((i) => ["new", "waiting_design"].includes(i.item_status));
  const push = items.filter((i) => ["design_ok", "ordered"].includes(i.item_status));
  const overdue = items.filter((i) => i.deadline_ship && i.deadline_ship < today);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Việc hôm nay</h1>
        <span className="text-sm text-slate-400">{new Date().toLocaleDateString("vi-VN")}</span>
      </div>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error.message}</div>
      ) : (
        <>
          <Section title="⏰ Quá hạn ship" note="cần ưu tiên xử lý ngay" items={overdue} cls="bg-red-100 text-red-700" />
          <Section title="🎨 Chờ design" note="seller chuẩn bị/xác nhận thiết kế" items={design} cls="bg-orange-100 text-orange-700" />
          <Section title="🏭 Chờ FFM đẩy xưởng" note="đủ điều kiện, chờ đẩy đơn" items={push} cls="bg-amber-100 text-amber-700" />
        </>
      )}
    </div>
  );
}
