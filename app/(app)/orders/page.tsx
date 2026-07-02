import { createClient } from "@/lib/supabase/server";
import { OrdersTable } from "./orders-table";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = {
  id: string; order_date: string | null; platform: "AMZ" | "TTS";
  platform_order_id: string; platform_status: string | null;
  tracking_number: string | null; label_link: string | null;
  customer_name: string | null; customer_contact: string | null;
  seller_note: string | null; order_value: number | null;
  seller_name_import: string | null;
  selling_accounts: { name: string } | null;
  seller: { full_name: string } | null;
  order_items: Order["items"];
};

export default async function OrdersPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, platform, platform_order_id, platform_status, tracking_number, label_link, " +
      "customer_name, customer_contact, seller_note, order_value, seller_name_import, " +
      "selling_accounts(name), seller:profiles!orders_seller_id_fkey(full_name), " +
      "order_items(id, item_status, confirm_design, product_title, size, tracking_status)"
    )
    .order("order_date", { ascending: false, nullsFirst: false })
    .limit(500);

  const orders: Order[] = ((data as Row[] | null) ?? []).map((o) => ({
    id: o.id, order_date: o.order_date, platform: o.platform,
    platform_order_id: o.platform_order_id, platform_status: o.platform_status,
    tracking_number: o.tracking_number, label_link: o.label_link,
    customer_name: o.customer_name, customer_contact: o.customer_contact,
    seller_note: o.seller_note, order_value: o.order_value,
    selling_account_name: o.selling_accounts?.name ?? null,
    seller_name: o.seller?.full_name ?? o.seller_name_import ?? null,
    items: o.order_items ?? [],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Đơn hàng</h1>
      </div>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Chưa đọc được dữ liệu: {error.message}. Kiểm tra: đã chạy migration 0001 + 0002 và điền .env.local chưa?
        </div>
      ) : (
        <OrdersTable initialData={orders} />
      )}
    </div>
  );
}
