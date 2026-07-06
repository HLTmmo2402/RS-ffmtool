import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { OrdersTable } from "./orders-table";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

const SIZE = 50;
const SELECT =
  "id, order_date, platform, platform_order_id, platform_status, tracking_number, label_link, " +
  "customer_name, customer_contact, seller_note, order_value, seller_name_import, " +
  "selling_accounts(name), seller:profiles!orders_seller_id_fkey(full_name), " +
  "order_items(id, item_status, confirm_design, product_title, size, tracking_status)";

type Row = {
  id: string; order_date: string | null; platform: "AMZ" | "TTS";
  platform_order_id: string; platform_status: string | null;
  tracking_number: string | null; label_link: string | null;
  customer_name: string | null; customer_contact: string | null;
  seller_note: string | null; order_value: number | null; seller_name_import: string | null;
  selling_accounts: { name: string } | null;
  seller: { full_name: string } | null;
  order_items: Order["items"];
};

export default async function OrdersPage({ searchParams }: { searchParams: { page?: string; q?: string; platform?: string; from?: string; to?: string } }) {
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? "").trim();
  const platform = searchParams.platform ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";

  let query = supabase.from("orders").select(SELECT, { count: "exact" });
  if (q) query = query.or(`platform_order_id.ilike.%${q}%,customer_name.ilike.%${q}%,seller_name_import.ilike.%${q}%,tracking_number.ilike.%${q}%`);
  if (platform === "TTS" || platform === "AMZ") query = query.eq("platform", platform);
  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);
  const { data, error, count } = await query
    .order("order_date", { ascending: false, nullsFirst: false })
    .range((page - 1) * SIZE, page * SIZE - 1);

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

  const meUser = await getCurrentUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", meUser?.id ?? "").maybeSingle();
  const isFFM = me?.role === "ffm" || me?.role === "admin";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Đơn hàng</h1>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Chưa đọc được dữ liệu: {error.message}. Kiểm tra đã chạy migration + bản vá RLS chưa.
        </div>
      ) : (
        <OrdersTable orders={orders} total={count ?? 0} page={page} size={SIZE} isFFM={isFFM}
          filters={{ q, platform, from, to }} />
      )}
    </div>
  );
}
