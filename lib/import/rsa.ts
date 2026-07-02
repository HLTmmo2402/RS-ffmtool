// Parser nguồn RSA-FFM (sheet "Đơn đang đi" của từng seller, hoặc "Tổng hợp đơn").
// Nhận array-of-arrays (aoa) từ SheetJS. Dò header + map cột theo TÊN (chịu được sheet lệch cột).
import {
  ParsedOrder, ParsedItem, ParseResult, ParseWarning,
  cellStr, cleanZero, orNull, parseNum, parseDateFlexible, cleanSize, splitCustomer, compactRaw,
  ItemStatus, TrackingStatus, Platform, ShippedBy,
} from "./shared";

const norm = (s: unknown) =>
  cellStr(s).toLowerCase().replace(/[()]/g, "").replace(/[\s\n\r]/g, "");

/** Dò dòng header = dòng có ô chứa "orderid". Trả -1 nếu không thấy. */
function findHeaderRow(aoa: unknown[][]): number {
  for (let r = 0; r < Math.min(10, aoa.length); r++) {
    const row = aoa[r] || [];
    if (row.some((c) => norm(c).includes("orderid"))) return r;
  }
  return -1;
}

type ColMap = Record<string, number>;
function buildCols(header: unknown[]): ColMap {
  const H = header.map(norm);
  const find = (pred: (h: string) => boolean) => H.findIndex(pred);
  return {
    orderDate: find((h) => h.startsWith("ngàyorder") || h.startsWith("ngayorder")),
    orderId: find((h) => h.includes("orderid")),
    platform: find((h) => h === "platform"),
    account: find((h) => h.includes("tàikhoảnbán") || h.includes("taikhoanban")),
    shippedBy: find((h) => h.includes("shippedby")),
    label: find((h) => h.includes("linklabel")),
    labelFee: find((h) => h.includes("labelfee")),
    sellerName: find((h) => h.includes("sellername")),
    sellerNote: find((h) => h.includes("sellernote")),
    customer: find((h) => h.includes("customerinfo")),
    template: find((h) => h === "template"),
    productType: find((h) => h.includes("producttype")),
    factoryAuto: find((h) => h.includes("nhàin") || h.includes("nhain")),
    dimension: find((h) => h.includes("dimension")),
    phoi: find((h) => h.startsWith("phôi") || h.startsWith("phoi")),
    size: find((h) => h === "size"),
    color: find((h) => h === "color"),
    quantity: find((h) => h.includes("quantity")),
    linkSP: find((h) => h.includes("linksảnphẩm") || h.includes("linksanpham")),
    listing: find((h) => h.includes("listingmockup") || h.includes("listingdesign")),
    orderDesign: find((h) => h.includes("orderdesign")),
    fileDesign: find((h) => h.includes("filedesign")),
    confirmDesign: find((h) => h.includes("confirmdesign")),
    xuong: find((h) => h === "xưởng" || h === "xuong"),
    carrier: find((h) => h.includes("carrier")),
    pushedAt: find((h) => h.includes("ngàyđẩy") || h.includes("ngayday")),
    orderFFM: find((h) => h.includes("orderffm")),
    tracking: find((h) => h.includes("trackingnumber")),
    deadline: find((h) => h.includes("deadline")),
    trackingStatus: find((h) => h.includes("trackingstatus")),
    shippingCost: find((h) => h.includes("shippingcost")),
    itemsCost: find((h) => h.includes("itemscost")),
    totalAmount: find((h) => h.includes("totalamount")),
    note: find((h) => h === "note"),
  };
}

function rsaStatus(f: {
  trackingStatusText: string; tracking: string | null; orderFFM: string | null;
  pushedAt: string | null; carrier: string | null; confirm: boolean;
  label: string | null; design: string | null; note: string;
}): { item: ItemStatus; track: TrackingStatus } {
  const ts = f.trackingStatusText.toLowerCase();
  let track: TrackingStatus = "none";
  if (/return|hoàn|hoan/.test(ts)) track = "returned";
  else if (/deliver|đã giao|da giao/.test(ts)) track = "delivered";
  else if (/transit|đang giao|dang giao|shipped/.test(ts)) track = "in_transit";

  if (/cancel|hủy|huy|refund/.test((f.note + " " + ts).toLowerCase())) return { item: "cancelled", track };
  if (track === "delivered") return { item: "delivered", track };
  if (f.tracking) return { item: "has_tracking", track: track === "none" ? "in_transit" : track };
  if (f.pushedAt && f.carrier) return { item: "in_production", track };
  if (f.orderFFM) return { item: "ordered", track };
  if (f.confirm && f.label) return { item: "design_ok", track };
  if (f.design || f.confirm) return { item: "waiting_design", track };
  return { item: "new", track };
}

export function parseRsaSheet(aoa: unknown[][], sheetName = ""): ParseResult {
  const warnings: ParseWarning[] = [];
  const hr = findHeaderRow(aoa);
  if (hr < 0) {
    return { orders: [], warnings: [{ row: sheetName || "?", message: "Không tìm thấy dòng header (cột Order ID)." }],
      stats: { totalRows: 0, orders: 0, items: 0, multiItemOrders: 0 } };
  }
  const C = buildCols(aoa[hr]);
  const header = aoa[hr].map((h) => cellStr(h) || "");
  const map = new Map<string, ParsedOrder>();
  let dataRows = 0;

  const get = (row: unknown[], idx: number) => (idx >= 0 ? row[idx] : undefined);

  for (let r = hr + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const id = cleanZero(get(row, C.orderId)).replace(/\s+$/, "").trim();
    if (!id) continue;                                   // bỏ dòng trống / "Grand Total"
    if (/grand\s*total|tổng/i.test(id)) continue;
    dataRows++;

    // platform
    let plat = cleanZero(get(row, C.platform)).toUpperCase() as Platform;
    if (plat !== "TTS" && plat !== "AMZ") plat = /^\d{3}-\d{7}-\d{7}$/.test(id) ? "AMZ" : "TTS";

    // shipped_by
    const sbRaw = cleanZero(get(row, C.shippedBy)).toLowerCase();
    let shipped: ShippedBy | null = null;
    if (sbRaw.includes("tiktok")) shipped = "tiktok_shipping";
    else if (sbRaw.includes("seller")) shipped = "seller_shipping";
    else if (plat === "TTS") shipped = "tiktok_shipping";

    // raw object có key = tên cột (cho source_raw & tra cứu)
    const rawObj: Record<string, unknown> = {};
    header.forEach((h, i) => { if (h) rawObj[h] = row[i]; });

    let order = map.get(id);
    if (!order) {
      const cust = splitCustomer(cleanZero(get(row, C.customer)));
      order = {
        platform: plat,
        platform_order_id: id,
        selling_account_name: orNull(cleanZero(get(row, C.account))),
        seller_name: orNull(cleanZero(get(row, C.sellerName))) || orNull(sheetName.trim()),
        order_date: parseDateFlexible(get(row, C.orderDate)),
        shipped_by: shipped,
        label_link: orNull(cleanZero(get(row, C.label))),
        label_fee: parseNum(get(row, C.labelFee)),
        tracking_number: orNull(cleanZero(get(row, C.tracking))),
        platform_status: null,
        order_value: null,                                 // RSA không có doanh thu (Total = chi phí)
        customer_name: cust.name,
        customer_contact: cust.phone,
        customer_address: cust.address,
        buyer_note: null,
        seller_note: orNull(cleanZero(get(row, C.sellerNote))),
        source_raw: compactRaw(rawObj),
        items: [],
      };
      map.set(id, order);
    } else {
      // dòng phụ cùng đơn: bổ sung field còn trống
      if (!order.customer_name) {
        const cust = splitCustomer(cleanZero(get(row, C.customer)));
        order.customer_name ??= cust.name;
        order.customer_contact ??= cust.phone;
        order.customer_address ??= cust.address;
      }
      order.label_link ??= orNull(cleanZero(get(row, C.label)));
      order.tracking_number ??= orNull(cleanZero(get(row, C.tracking)));
      order.order_date ??= parseDateFlexible(get(row, C.orderDate));
    }

    // ----- item -----
    const confirm = cleanZero(get(row, C.confirmDesign)) !== "";
    const tracking = orNull(cleanZero(get(row, C.tracking)));
    const orderFFM = orNull(cleanZero(get(row, C.orderFFM)));
    const pushedAt = parseDateFlexible(get(row, C.pushedAt));
    const carrier = orNull(cleanZero(get(row, C.carrier)));
    const design = orNull(cleanZero(get(row, C.fileDesign)));
    const label = order.label_link;
    const noteText = cleanZero(get(row, C.note));
    const st = rsaStatus({
      trackingStatusText: cleanZero(get(row, C.trackingStatus)),
      tracking, orderFFM, pushedAt, carrier, confirm, label, design, note: noteText,
    });

    const factory = orNull(cleanZero(get(row, C.xuong))) || orNull(cleanZero(get(row, C.factoryAuto)));

    const item: ParsedItem = {
      source_line: order.items.length + 1,
      product_title: orNull(cleanZero(get(row, C.listing))) || orNull(cleanZero(get(row, C.template))),
      template_code: orNull(cleanZero(get(row, C.template))),
      product_type: orNull(cleanZero(get(row, C.productType))),
      factory_name: factory,
      dimension: orNull(cleanZero(get(row, C.dimension))),
      sku_phoi: orNull(cleanZero(get(row, C.phoi))),
      skus_raw: orNull(cleanZero(get(row, C.phoi))),
      size: cleanSize(get(row, C.size)),
      color: orNull(cleanZero(get(row, C.color))),
      quantity: parseNum(get(row, C.quantity)) ?? 1,
      design_link: design,
      confirm_design: confirm,
      listing_link: orNull(cleanZero(get(row, C.linkSP))) || orNull(cleanZero(get(row, C.listing))),
      order_design_code: orNull(cleanZero(get(row, C.orderDesign))),
      factory_order_id: orderFFM,
      tracking_number: tracking,
      tracking_status: st.track,
      item_status: st.item,
      carrier,
      pushed_at: pushedAt,
      deadline_ship: parseDateFlexible(get(row, C.deadline)),
      fulfillment_cost: parseNum(get(row, C.itemsCost)),
      shipping_cost: parseNum(get(row, C.shippingCost)),
      note: orNull(noteText),
      source_raw: compactRaw(rawObj),
    };
    order.items.push(item);
  }

  const orders = [...map.values()];
  return {
    orders,
    warnings,
    stats: {
      totalRows: dataRows,
      orders: orders.length,
      items: orders.reduce((n, o) => n + o.items.length, 0),
      multiItemOrders: orders.filter((o) => o.items.length > 1).length,
    },
  };
}
