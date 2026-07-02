import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ItemLite = { item_status: string };
type Row = {
  seller_name_import: string | null;
  seller: { full_name: string } | { full_name: string }[] | null;
  order_items: ItemLite[];
};

function stageBucket(items: ItemLite[]): "design" | "push" | "prod" | "done" | "issue" | "other" {
  if (!items.length) return "design";
  const has = (s: string) => items.some((i) => i.item_status === s);
  const all = (s: string) => items.every((i) => i.item_status === s);
  if (has("issue")) return "issue";
  if (all("cancelled")) return "other";
  if (all("delivered")) return "done";
  if (has("synced")) return "done";
  if (has("has_tracking") || has("in_production")) return "prod";
  if (has("ordered") || has("design_ok")) return "push";
  return "design";
}

export default async function BySellerPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("seller_name_import, seller:profiles!orders_seller_id_fkey(full_name), order_items(item_status)")
    .limit(4000);

  const rows = (data as Row[] | null) ?? [];
  const agg = new Map<string, { total: number; design: number; push: number; prod: number; done: number; issue: number }>();
  for (const o of rows) {
    const s = Array.isArray(o.seller) ? o.seller[0]?.full_name : o.seller?.full_name;
    const name = s ?? o.seller_name_import ?? "(chưa gán seller)";
    const a = agg.get(name) ?? { total: 0, design: 0, push: 0, prod: 0, done: 0, issue: 0 };
    a.total++;
    const b = stageBucket(o.order_items ?? []);
    if (b !== "other") a[b]++;
    agg.set(name, a);
  }
  const list = [...agg.entries()].sort((x, y) => y[1].total - x[1].total);

  const H = "px-3 py-2 text-right font-medium text-slate-600";
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Thống kê theo Seller</h1>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error.message}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-600">Seller</th>
                <th className={H}>Tổng đơn</th>
                <th className={H}>Chờ design</th>
                <th className={H}>Chờ đẩy</th>
                <th className={H}>Đang SX/ship</th>
                <th className={H}>Đã giao</th>
                <th className={H}>Sự cố</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Chưa có đơn.</td></tr>
              ) : list.map(([name, a]) => (
                <tr key={name} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-medium">{name}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{a.total}</td>
                  <td className="px-3 py-1.5 text-right text-orange-600">{a.design || ""}</td>
                  <td className="px-3 py-1.5 text-right text-amber-600">{a.push || ""}</td>
                  <td className="px-3 py-1.5 text-right text-blue-600">{a.prod || ""}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-600">{a.done || ""}</td>
                  <td className="px-3 py-1.5 text-right text-red-600">{a.issue || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
