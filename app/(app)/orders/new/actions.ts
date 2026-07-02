"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type OrderRowInput = {
  orderId: string;
  orderDate: string | null;
  sellingAccountId: string | null;
  labelLink: string | null;
  customerName: string | null;
  customerContact: string | null;
  customerAddress: string | null;
  sellerNote: string | null;
  // item
  templateId: string | null;
  productType: string | null;
  factoryId: string | null;
  dimension: string | null;
  skuPhoi: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  listingLink: string | null;
  designLink: string | null;
  confirmDesign: boolean;
  savedOrderId?: string | null;
  savedItemId?: string | null;
};

export type SaveResult =
  | { ok: false; error: string }
  | { ok: true; orderId: string; itemId: string };

const n = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/** Lưu 1 dòng của sheet nhập đơn: upsert order (TTS) + upsert 1 order_item. */
export async function saveOrderRow(row: OrderRowInput): Promise<SaveResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!n(row.orderId)) return { ok: false, error: "Thiếu Order ID." };

  // Seller Name = người đăng nhập (không cần điền). Platform/Shipped by auto theo mô tả.
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .upsert(
      {
        platform: "TTS",
        platform_order_id: n(row.orderId),
        selling_account_id: n(row.sellingAccountId),
        seller_id: user.id,
        order_date: n(row.orderDate),
        shipped_by: "tiktok_shipping",
        label_link: n(row.labelLink),
        customer_name: n(row.customerName),
        customer_contact: n(row.customerContact),
        customer_address: n(row.customerAddress),
        seller_note: n(row.sellerNote),
        updated_by: user.id,
      },
      { onConflict: "platform,platform_order_id" }
    )
    .select("id")
    .single();
  if (oErr) return { ok: false, error: "Lưu đơn lỗi: " + oErr.message };

  // trạng thái item suy từ dữ liệu seller nhập (rule engine phần seller)
  const itemStatus = row.confirmDesign && n(row.labelLink)
    ? "design_ok"
    : row.confirmDesign
    ? "design_ok"
    : row.templateId || n(row.designLink)
    ? "waiting_design"
    : "new";

  const itemFields = {
    order_id: order.id,
    template_id: n(row.templateId),
    product_type: n(row.productType),   // snapshot từ template lúc nhập
    factory_id: n(row.factoryId),
    dimension: n(row.dimension),
    sku_phoi: n(row.skuPhoi),
    size: n(row.size),
    color: n(row.color),
    quantity: row.quantity || 1,
    design_link: n(row.designLink),
    confirm_design: row.confirmDesign,
    listing_link: n(row.listingLink),
    item_status: itemStatus,
  };

  let itemId = row.savedItemId ?? "";
  if (itemId) {
    const { error } = await supabase.from("order_items").update(itemFields).eq("id", itemId);
    if (error) return { ok: false, error: "Lưu sản phẩm lỗi: " + error.message };
  } else {
    const { data: item, error } = await supabase
      .from("order_items").insert(itemFields).select("id").single();
    if (error) return { ok: false, error: "Lưu sản phẩm lỗi: " + error.message };
    itemId = item.id;
  }

  revalidatePath("/orders");
  return { ok: true, orderId: order.id, itemId };
}
