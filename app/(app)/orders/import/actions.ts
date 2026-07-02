"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ParsedOrder } from "@/lib/import/shared";

export type ImportSource = "cotik" | "rsa_ffm";

export type ImportResult =
  | { ok: false; error: string }
  | {
      ok: true;
      ordersUpserted: number;
      itemsInserted: number;
      skippedExistingOrders: number; // đơn đã có -> chỉ cập nhật cấp đơn, GIỮ item (không phá dữ liệu FFM)
      unmatchedAccounts: string[];
      unmatchedFactories: string[];
    };

const key = (platform: string, id: string) => `${platform}|${id}`;

/**
 * Nạp 1 LÔ đơn đã chuẩn hoá (client chia lô để tránh giới hạn body của server action).
 * - Upsert orders theo (platform, platform_order_id).
 * - Map selling_account / seller / factory theo tên (ffm/admin tự tạo cái còn thiếu; seller thì bỏ qua).
 * - CHỈ tạo order_items cho ĐƠN MỚI — đơn đã tồn tại giữ nguyên item (bảo toàn dữ liệu FFM đã nhập).
 */
export async function importParsedOrders(
  orders: ParsedOrder[],
  source: ImportSource
): Promise<ImportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };

  const valid = orders.filter((o) => o.platform_order_id?.trim());
  if (valid.length === 0) return { ok: false, error: "Lô rỗng / thiếu Order ID." };

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  const myRole = (me?.role as string) ?? "seller";
  const canWriteRef = myRole === "ffm" || myRole === "admin";

  // ---------------- lookup: selling_accounts ----------------
  const { data: accRows } = await supabase.from("selling_accounts").select("id, platform, name");
  const accMap = new Map<string, string>();
  (accRows ?? []).forEach((a) => accMap.set(key(a.platform, (a.name ?? "").toLowerCase()), a.id));

  const unmatchedAccounts = new Set<string>();
  const missingAccounts: { platform: string; name: string }[] = [];
  for (const o of valid) {
    if (!o.selling_account_name) continue;
    const k = key(o.platform, o.selling_account_name.toLowerCase());
    if (!accMap.has(k) && !missingAccounts.find((m) => key(m.platform, m.name.toLowerCase()) === k))
      missingAccounts.push({ platform: o.platform, name: o.selling_account_name });
  }
  if (missingAccounts.length && canWriteRef) {
    const { data: ins } = await supabase
      .from("selling_accounts")
      .upsert(missingAccounts.map((m) => ({ platform: m.platform, name: m.name })),
        { onConflict: "platform,name", ignoreDuplicates: true })
      .select("id, platform, name");
    (ins ?? []).forEach((a) => accMap.set(key(a.platform, (a.name ?? "").toLowerCase()), a.id));
    // lấy lại các dòng đã tồn tại nhưng upsert bỏ qua
    const { data: re } = await supabase.from("selling_accounts").select("id, platform, name");
    (re ?? []).forEach((a) => accMap.set(key(a.platform, (a.name ?? "").toLowerCase()), a.id));
  } else {
    missingAccounts.forEach((m) => unmatchedAccounts.add(`${m.platform} ${m.name}`));
  }

  // ---------------- lookup: factories ----------------
  const { data: facRows } = await supabase.from("factories").select("id, name");
  const facMap = new Map<string, string>();
  (facRows ?? []).forEach((f) => facMap.set((f.name ?? "").toLowerCase(), f.id));

  const unmatchedFactories = new Set<string>();
  const missingFactories = new Set<string>();
  for (const o of valid)
    for (const it of o.items)
      if (it.factory_name && !facMap.has(it.factory_name.toLowerCase()))
        missingFactories.add(it.factory_name);

  if (missingFactories.size && canWriteRef) {
    const { data: ins } = await supabase
      .from("factories")
      .upsert([...missingFactories].map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true })
      .select("id, name");
    (ins ?? []).forEach((f) => facMap.set((f.name ?? "").toLowerCase(), f.id));
    const { data: re } = await supabase.from("factories").select("id, name");
    (re ?? []).forEach((f) => facMap.set((f.name ?? "").toLowerCase(), f.id));
  } else {
    missingFactories.forEach((n) => unmatchedFactories.add(n));
  }

  // ---------------- lookup: profiles (seller theo tên) ----------------
  const { data: profRows } = await supabase.from("profiles").select("id, full_name");
  const profMap = new Map<string, string>();
  (profRows ?? []).forEach((p) => { if (p.full_name) profMap.set(p.full_name.trim().toLowerCase(), p.id); });
  const sellerIdFor = (name: string | null): string | null => {
    if (name) { const hit = profMap.get(name.trim().toLowerCase()); if (hit) return hit; }
    return myRole === "seller" ? user.id : null; // seller import -> đơn về chính mình khi không map được
  };

  // ---------------- đơn nào ĐÃ tồn tại (để không đụng item) ----------------
  const ids = valid.map((o) => o.platform_order_id);
  const { data: existRows } = await supabase
    .from("orders").select("platform, platform_order_id").in("platform_order_id", ids);
  const existed = new Set<string>((existRows ?? []).map((e) => key(e.platform, e.platform_order_id)));

  // ---------------- upsert orders ----------------
  const orderPayload = valid.map((o) => ({
    platform: o.platform,
    platform_order_id: o.platform_order_id,
    selling_account_id: o.selling_account_name
      ? accMap.get(key(o.platform, o.selling_account_name.toLowerCase())) ?? null : null,
    seller_id: sellerIdFor(o.seller_name),
    seller_name_import: o.seller_name,
    order_date: o.order_date,
    shipped_by: o.shipped_by,
    label_link: o.label_link,
    label_fee: o.label_fee,
    tracking_number: o.tracking_number,
    platform_status: o.platform_status,
    order_value: o.order_value,
    customer_name: o.customer_name,
    customer_contact: o.customer_contact,
    customer_address: o.customer_address,
    buyer_note: o.buyer_note,
    seller_note: o.seller_note,
    import_source: source,
    source_raw: o.source_raw,
    updated_by: user.id,
  }));

  const { data: upserted, error: upErr } = await supabase
    .from("orders")
    .upsert(orderPayload, { onConflict: "platform,platform_order_id" })
    .select("id, platform, platform_order_id");
  if (upErr) return { ok: false, error: `Nạp đơn lỗi: ${upErr.message}` };

  const idMap = new Map<string, string>();
  (upserted ?? []).forEach((o) => idMap.set(key(o.platform, o.platform_order_id), o.id));

  // ---------------- insert items cho ĐƠN MỚI ----------------
  let skippedExistingOrders = 0;
  const itemPayload: Record<string, unknown>[] = [];
  for (const o of valid) {
    const k = key(o.platform, o.platform_order_id);
    if (existed.has(k)) { skippedExistingOrders++; continue; } // đơn cũ -> giữ item
    const orderId = idMap.get(k);
    if (!orderId) continue;
    for (const it of o.items) {
      itemPayload.push({
        order_id: orderId,
        source_line: it.source_line,
        product_title: it.product_title,
        template_code: it.template_code,
        product_type: it.product_type,
        factory_id: it.factory_name ? facMap.get(it.factory_name.toLowerCase()) ?? null : null,
        dimension: it.dimension,
        sku_phoi: it.sku_phoi,
        skus_raw: it.skus_raw,
        size: it.size,
        color: it.color,
        quantity: it.quantity,
        design_link: it.design_link,
        confirm_design: it.confirm_design,
        listing_link: it.listing_link,
        order_design_code: it.order_design_code,
        factory_order_id: it.factory_order_id,
        tracking_number: it.tracking_number,
        tracking_status: it.tracking_status,
        item_status: it.item_status,
        carrier: it.carrier,
        pushed_at: it.pushed_at,
        deadline_ship: it.deadline_ship,
        fulfillment_cost: it.fulfillment_cost,
        shipping_cost: it.shipping_cost,
        note: it.note,
        import_source: source,
        source_raw: it.source_raw,
      });
    }
  }

  // Chỉ chèn item cho ĐƠN MỚI (đơn cũ đã 'continue' ở trên) -> insert thẳng, không cần onConflict
  // (unique index (order_id,source_line) là partial nên không dùng làm arbiter cho upsert được).
  let itemsInserted = 0;
  if (itemPayload.length) {
    const { error: itErr } = await supabase.from("order_items").insert(itemPayload);
    if (itErr) return { ok: false, error: `Nạp sản phẩm lỗi: ${itErr.message}` };
    itemsInserted = itemPayload.length;
  }

  revalidatePath("/orders");
  return {
    ok: true,
    ordersUpserted: upserted?.length ?? valid.length,
    itemsInserted,
    skippedExistingOrders,
    unmatchedAccounts: [...unmatchedAccounts],
    unmatchedFactories: [...unmatchedFactories],
  };
}
