// Parser nguồn COTIK (file Export .csv của Cotik). Xem cấu trúc thật: scripts/analyze_orders.py
import {
  ParsedOrder, ParsedItem, ParseResult, ParseWarning,
  stripQuote, parseDateFlexible, parseNum, extractSize, orNull, compactRaw,
  ItemStatus, TrackingStatus,
} from "./shared";

type Raw = Record<string, unknown>;

/** Bỏ BOM + trim key (cột đầu "id" hay dính ﻿). */
function normKeys(row: Raw): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    const nk = k.replace(/^﻿/, "").trim();
    out[nk] = row[k] === null || row[k] === undefined ? "" : String(row[k]);
  }
  return out;
}

/** shop_note "TTS43 - IvakeRiou@gmail.com" -> "TTS43". Không chuẩn -> giữ nguyên (vd JadeExtra). */
function sellingAccount(shopNote: string): { name: string | null; nonStandard: boolean } {
  const v = stripQuote(shopNote);
  if (!v) return { name: null, nonStandard: false };
  const before = v.split(/\s-\s/)[0].trim();
  const m = before.match(/^([A-Za-z]+)\s*(\d+)$/);
  if (m) return { name: (m[1] + m[2]).toUpperCase(), nonStandard: false };
  return { name: before, nonStandard: true };
}

/** email_member "tudda21@iart.group - Tú" -> "Tú". "TTS27 - email" (lệch cột) -> null. */
function sellerName(emailMember: string): string | null {
  const v = stripQuote(emailMember);
  if (!v) return null;
  const parts = v.split(/\s-\s/);
  if (parts.length < 2) return null;
  const before = parts[0].trim();
  const after = parts.slice(1).join(" - ").trim();
  if (before.includes("@")) return after || null; // "email - Tên" -> Tên
  return null;                                     // "TTS.. - email" -> không phải seller
}

function statusOf(raw: string): { item: ItemStatus; track: TrackingStatus } {
  const s = raw.toUpperCase();
  if (s === "CANCELLED") return { item: "cancelled", track: "none" };
  if (s === "DELIVERED" || s === "COMPLETED") return { item: "delivered", track: "delivered" };
  if (s === "IN_TRANSIT") return { item: "has_tracking", track: "in_transit" };
  if (s === "AWAITING_COLLECTION") return { item: "has_tracking", track: "none" };
  if (s === "AWAITING_SHIPMENT") return { item: "ordered", track: "none" };
  return { item: "new", track: "none" };
}

export function parseCotik(rowsRaw: Raw[]): ParseResult {
  const warnings: ParseWarning[] = [];
  const map = new Map<string, ParsedOrder>();

  rowsRaw.forEach((r0, idx) => {
    const r = normKeys(r0);
    const id = stripQuote(r["id"]);
    if (!id) {
      warnings.push({ row: idx + 2, message: "Thiếu Order ID — bỏ dòng." });
      return;
    }

    const status = stripQuote(r["status"]);
    const price = parseNum(r["price"]);
    const orderValue = price !== null && price > 0 && price < 10000 ? price : null;
    if (price !== null && price >= 10000) {
      warnings.push({ row: idx + 2, message: `price=${price} bất thường (nghi tracking lọt cột) — bỏ order_value.` });
    }

    // ----- order-level (dòng chính có metadata; dòng phụ để trống) -----
    let order = map.get(id);
    if (!order) {
      const acc = sellingAccount(r["shop_note"]);
      if (acc.nonStandard && acc.name) {
        warnings.push({ row: idx + 2, message: `TK bán hàng "${acc.name}" chưa theo chuẩn TTالسxx — sẽ tạo/khớp theo tên.` });
      }
      order = {
        platform: "TTS",
        platform_order_id: id,
        selling_account_name: acc.name,
        seller_name: sellerName(r["email_member"]),
        order_date: parseDateFlexible(r["create_time"]),
        shipped_by: "tiktok_shipping",
        label_link: orNull(stripQuote(r["label"])),
        label_fee: null,
        tracking_number: orNull(stripQuote(r["tracking_number"])),
        platform_status: orNull(status),
        order_value: orderValue,
        customer_name: orNull(stripQuote(r["name"])),
        customer_contact: orNull(stripQuote(r["phone"])),
        customer_address: orNull(stripQuote(r["address"])),
        buyer_note: orNull(stripQuote(r["buyer_note"])),
        seller_note: null,
        source_raw: compactRaw(r),
        items: [],
      };
      map.set(id, order);
    } else {
      // dòng phụ: bổ sung field nào order còn trống (đề phòng dòng chính không phải dòng đầu)
      order.platform_status ??= orNull(status);
      order.customer_name ??= orNull(stripQuote(r["name"]));
      order.customer_contact ??= orNull(stripQuote(r["phone"]));
      order.customer_address ??= orNull(stripQuote(r["address"]));
      order.label_link ??= orNull(stripQuote(r["label"]));
      order.tracking_number ??= orNull(stripQuote(r["tracking_number"]));
      order.order_value ??= orderValue;
      if (!order.selling_account_name) order.selling_account_name = sellingAccount(r["shop_note"]).name;
      if (!order.seller_name) order.seller_name = sellerName(r["email_member"]);
    }

    // ----- item-level (mỗi dòng CSV = 1 item) -----
    const skusRaw = stripQuote(r["skus"]);
    const { size, sku } = extractSize(skusRaw);
    const st = statusOf(status);
    const trk = orNull(stripQuote(r["tracking_number"]));

    const item: ParsedItem = {
      source_line: order.items.length + 1,
      product_title: orNull(stripQuote(r["title"])),
      template_code: null,
      product_type: null,
      factory_name: null,
      dimension: null,
      sku_phoi: sku,
      skus_raw: orNull(skusRaw),
      size,
      color: null,
      quantity: parseNum(r["quantity"]) ?? 1,
      design_link: null,
      confirm_design: false,
      listing_link: orNull(stripQuote(r["image"])) ?? orNull(stripQuote(r["main_images"])),
      order_design_code: orNull(stripQuote(r["seller_sku"])),
      factory_order_id: null,
      tracking_number: trk,
      tracking_status: st.track,
      item_status: st.item,
      carrier: null,
      pushed_at: null,
      deadline_ship: null,
      fulfillment_cost: null,
      shipping_cost: null,
      note: null,
      source_raw: compactRaw(r),
    };
    order.items.push(item);
  });

  const orders = [...map.values()];
  return {
    orders,
    warnings,
    stats: {
      totalRows: rowsRaw.length,
      orders: orders.length,
      items: orders.reduce((n, o) => n + o.items.length, 0),
      multiItemOrders: orders.filter((o) => o.items.length > 1).length,
    },
  };
}
