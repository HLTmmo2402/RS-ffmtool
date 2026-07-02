"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Cột item được phép cập nhật (RLS + trigger guard_item_columns tự chặn seller sửa cột FFM).
const ITEM_COLS = new Set([
  "template_id", "product_type", "factory_id", "dimension",
  "sku_phoi", "size", "color", "quantity", "design_link", "confirm_design",
  "listing_link", "factory_account_id", "factory_order_id", "tracking_number",
  "tracking_status", "item_status", "fulfillment_cost", "shipping_cost", "cost_currency",
  "carrier", "pushed_at", "deadline_ship", "note",
]);
const ORDER_COLS = new Set([
  "customer_name", "customer_contact", "customer_address", "label_link", "label_fee",
  "tracking_number", "platform_status", "selling_account_id", "seller_note",
  "order_date", "buyer_note", "shipped_by", "order_value",
]);

function pick(patch: Record<string, unknown>, allowed: Set<string>) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (!allowed.has(k)) continue;
    let v = patch[k];
    if (v === "") v = null;
    out[k] = v;
  }
  return out;
}

export async function updateOrderItem(itemId: string, patch: Record<string, unknown>) {
  const supabase = createClient();
  const fields = pick(patch, ITEM_COLS);
  if (Object.keys(fields).length === 0) return { ok: false as const, error: "Không có gì để lưu." };
  const { error } = await supabase.from("order_items").update(fields).eq("id", itemId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/orders");
  return { ok: true as const };
}

export async function updateOrder(orderId: string, patch: Record<string, unknown>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const fields = pick(patch, ORDER_COLS);
  if (user) fields.updated_by = user.id;
  if (Object.keys(fields).length === 0) return { ok: false as const, error: "Không có gì để lưu." };
  const { error } = await supabase.from("orders").update(fields).eq("id", orderId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/orders");
  return { ok: true as const };
}

/** Thêm 1 sản phẩm vào đơn (đơn nhiều SP). */
export async function addOrderItem(orderId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("order_items").insert({ order_id: orderId, quantity: 1 }).select("id").single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/orders");
  return { ok: true as const, id: data.id as string };
}

export async function deleteOrderItem(itemId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("order_items").delete().eq("id", itemId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/orders");
  return { ok: true as const };
}
