import { createClient } from "@/lib/supabase/server";
import { TodayView, type TodayItem } from "./today-view";

export const dynamic = "force-dynamic";

type Ord = { id: string; platform_order_id: string; customer_name: string | null; order_date: string | null; seller_name_import: string | null };
type Raw = { id: string; item_status: string; product_title: string | null; size: string | null; deadline_ship: string | null; order: Ord | Ord[] | null };

export default async function TodayPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("order_items")
    .select("id, item_status, product_title, size, deadline_ship, order:orders(id, platform_order_id, customer_name, order_date, seller_name_import)")
    .in("item_status", ["new", "waiting_design", "design_ok", "ordered", "in_production", "has_tracking"])
    .limit(4000);

  const items: TodayItem[] = ((data as Raw[] | null) ?? []).map((r) => {
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
  return <TodayView items={items} today={today} />;
}
