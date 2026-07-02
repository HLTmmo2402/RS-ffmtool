import { createClient } from "@/lib/supabase/server";
import { OrdersTable } from "./orders-table";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, platform, platform_order_id, platform_status, label_fee, customer_name, customer_contact, tracking_number, label_link, seller_note, created_at"
    )
    .order("order_date", { ascending: false, nullsFirst: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Đơn hàng</h1>
      </div>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Chưa đọc được dữ liệu: {error.message}. Kiểm tra: đã chạy migration
          (supabase/migrations/0001_init.sql) và điền .env.local chưa?
        </div>
      ) : (
        <OrdersTable initialData={(data as Order[]) ?? []} />
      )}
    </div>
  );
}
