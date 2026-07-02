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
  // item — Seller nhập
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
  // item — FFM cập nhật (chỉ ffm/admin được lưu; seller gửi cũng bị bỏ qua)
  factoryOrderId: string | null;
  carrier: string | null;
  pushedAt: string | null;
  trackingNumber: string | null;
  itemStatus: string | null;
  savedOrderId?: string | null;
  savedItemId?: string | null;
};

export type SaveResult =
  | { ok: false; error: string }
  | { ok: true; orderId: string; itemId: string };

const n = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export async function saveOrderRow(row: OrderRowInput): Promise<SaveResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!n(row.orderId)) return { ok: false, error: "Thiếu Order ID." };

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isFFM = me?.role === "ffm" || me?.role === "admin";

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

  // Cột SELLER (luôn lưu)
  const sellerFields: Record<string, unknown> = {
    order_id: order.id,
    template_id: n(row.templateId),
    product_type: n(row.productType),
    factory_id: n(row.factoryId),
    dimension: n(row.dimension),
    sku_phoi: n(row.skuPhoi),
    size: n(row.size),
    color: n(row.color),
    quantity: row.quantity || 1,
    design_link: n(row.designLink),
    confirm_design: row.confirmDesign,
    listing_link: n(row.listingLink),
  };
  // Cột FFM (chỉ ffm/admin) — tránh trigger chặn seller
  const ffmFields: Record<string, unknown> = isFFM
    ? {
        factory_order_id: n(row.factoryOrderId),
        carrier: n(row.carrier),
        pushed_at: n(row.pushedAt),
        tracking_number: n(row.trackingNumber),
        item_status: n(row.itemStatus) ?? undefined,
      }
    : {};

  // item_status mặc định khi seller tạo mới (nếu FFM không set)
  const defaultStatus = row.confirmDesign ? "design_ok" : row.templateId || n(row.designLink) ? "waiting_design" : "new";
  const fields = { ...sellerFields, ...ffmFields };
  if (!("item_status" in fields) || fields.item_status === undefined) {
    if (!row.savedItemId) fields.item_status = defaultStatus; // chỉ đặt mặc định khi tạo mới
    else delete fields.item_status;
  }

  let itemId = row.savedItemId ?? "";
  if (itemId) {
    const { error } = await supabase.from("order_items").update(fields).eq("id", itemId);
    if (error) return { ok: false, error: "Lưu sản phẩm lỗi: " + error.message };
  } else {
    const { data: item, error } = await supabase.from("order_items").insert(fields).select("id").single();
    if (error) return { ok: false, error: "Lưu sản phẩm lỗi: " + error.message };
    itemId = item.id;
  }

  revalidatePath("/orders");
  return { ok: true, orderId: order.id, itemId };
}
