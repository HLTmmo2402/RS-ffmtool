import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { TodayView, type TodayItem } from "./today-view";

export const dynamic = "force-dynamic";

type Ord = { id: string; platform_order_id: string; customer_name: string | null; order_date: string | null; seller_name_import: string | null };
type Raw = { id: string; item_status: string; product_title: string | null; size: string | null; deadline_ship: string | null; order: Ord | Ord[] | null };

const SEL = "id, item_status, product_title, size, deadline_ship, order:orders(id, platform_order_id, customer_name, order_date, seller_name_import)";
const OPEN = ["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking"];

export default async function TodayPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const floor180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);

  // 2 truy vấn NHẸ thay vì kéo 4000 dòng: (1) việc chờ design/đẩy; (2) đơn quá hạn (dùng index deadline).
  const [pendRes, overRes] = await Promise.all([
    supabase.from("order_items").select(SEL).in("item_status", ["new", "waiting_design", "design_ok", "ordered"]).limit(2000),
    supabase.from("order_items").select(SEL).in("item_status", OPEN).lt("deadline_ship", today).gte("deadline_ship", floor180).limit(2000),
  ]);
  const error = pendRes.error || overRes.error;

  const map = new Map<string, Raw>();
  for (const r of [...((pendRes.data as Raw[] | null) ?? []), ...((overRes.data as Raw[] | null) ?? [])]) map.set(r.id, r);
  const items: TodayItem[] = [...map.values()].map((r) => {
    const o = Array.isArray(r.order) ? r.order[0] : r.order;
    return {
      id: r.id, itemStatus: r.item_status, productTitle: r.product_title, size: r.size, deadline: r.deadline_ship,
      orderId: o?.id ?? null, platformOrderId: o?.platform_order_id ?? "—",
      customerName: o?.customer_name ?? null, orderDate: o?.order_date ?? null, seller: o?.seller_name_import ?? null,
    };
  });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Việc hôm nay</h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error.message}</div>
      </div>
    );
  }
  const me = await supabase.from("profiles").select("role").eq("id", (await getCurrentUser())?.id ?? "").maybeSingle();
  const isFFM = me.data?.role === "ffm" || me.data?.role === "admin";
  return <TodayView items={items} today={today} isFFM={isFFM} />;
}
