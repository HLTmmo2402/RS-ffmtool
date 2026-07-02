// ============================================================
// Lõi IMPORT dùng chung cho 2 nguồn: Cotik (CSV) & RSA-FFM (Excel).
// Chuẩn hoá cả 2 về cùng cấu trúc ParsedOrder[] để 1 server action nạp thẳng.
// Thuần TypeScript (chạy được ở client component). KHÔNG import gì từ server.
// ============================================================

export type ItemStatus =
  | "new" | "waiting_design" | "design_ok" | "ordered" | "in_production"
  | "has_tracking" | "synced" | "delivered" | "issue" | "cancelled";

export type TrackingStatus = "none" | "in_transit" | "delivered" | "returned";
export type Platform = "TTS" | "AMZ";
export type ShippedBy = "tiktok_shipping" | "seller_shipping";

export type ParsedItem = {
  source_line: number;                 // thứ tự dòng trong đơn (1..n) — khoá ổn định để re-import
  product_title: string | null;
  template_code: string | null;
  product_type: string | null;
  factory_name: string | null;         // tên xưởng thô -> action map ra factory_id
  dimension: string | null;
  sku_phoi: string | null;
  skus_raw: string | null;             // chuỗi SKU gốc (Cotik trộn size+lời nhắn / RSA Phôi)
  size: string | null;
  color: string | null;
  quantity: number;
  design_link: string | null;
  confirm_design: boolean;
  listing_link: string | null;
  order_design_code: string | null;
  factory_order_id: string | null;
  tracking_number: string | null;
  tracking_status: TrackingStatus;
  item_status: ItemStatus;
  carrier: string | null;
  pushed_at: string | null;
  deadline_ship: string | null;
  fulfillment_cost: number | null;
  shipping_cost: number | null;
  note: string | null;
  source_raw: Record<string, string>;
};

export type ParsedOrder = {
  platform: Platform;
  platform_order_id: string;
  selling_account_name: string | null; // TTS7 / AMZ Vân Anh -> action map ra selling_account_id
  seller_name: string | null;          // Tú / Hằng -> action map ra seller_id
  order_date: string | null;           // yyyy-mm-dd
  shipped_by: ShippedBy | null;
  label_link: string | null;
  label_fee: number | null;
  tracking_number: string | null;
  platform_status: string | null;
  order_value: number | null;          // Cotik `price` (tham khảo, không tính lãi-lỗ)
  customer_name: string | null;
  customer_contact: string | null;
  customer_address: string | null;
  buyer_note: string | null;
  seller_note: string | null;
  source_raw: Record<string, string>;
  items: ParsedItem[];
};

export type ParseWarning = { row: number | string; message: string };

export type ParseResult = {
  orders: ParsedOrder[];
  warnings: ParseWarning[];
  stats: {
    totalRows: number;      // số dòng dữ liệu đọc được
    orders: number;         // số đơn sau khi gộp
    items: number;          // số item
    multiItemOrders: number;// số đơn nhiều item
  };
};

// ---------------------- helpers làm sạch ----------------------

/** Ép mọi kiểu ô (string|number|Date|bool|null) về chuỗi đã trim. */
export function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Bỏ prefix ' (Excel text-guard của Cotik) + trim. */
export function stripQuote(v: unknown): string {
  let s = cellStr(v);
  if (s.startsWith("'")) s = s.slice(1).trim();
  return s;
}

/**
 * Làm sạch ô text: bỏ prefix ', và coi "0" đơn độc là RỖNG
 * (RSA để 0 ở nhiều cột nghĩa là chưa có: Phôi=0, Color=0, Link=0, fee=0…).
 */
export function cleanZero(v: unknown): string {
  const s = stripQuote(v);
  return s === "0" ? "" : s;
}

export function orNull(s: string): string | null {
  return s === "" ? null : s;
}

/** Parse số tiền/số lượng: bỏ ký tự lạ, chấp nhận Date-serial của Excel là không hợp lệ. */
export function parseNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = stripQuote(v).replace(/[^0-9.\-]/g, "");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse ngày linh hoạt -> 'yyyy-mm-dd' | null.
 * Nhận: Date (xlsx cellDates), serial Excel (số), 'dd-mm-yyyy [HH:MM:SS]' (Cotik),
 * 'yyyy-mm-dd[...]' (ISO/RSA), 'dd/mm/yyyy'.
 */
export function parseDateFlexible(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return isoDate(v);

  // serial Excel (số ngày kể từ 1899-12-30). Chỉ nhận khoảng hợp lý (> 30000 ~ 1982).
  if (typeof v === "number" && v > 30000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : isoDate(d);
  }

  const t = stripQuote(v);
  if (!t || t === "0") return null;

  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); // yyyy-mm-dd
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // dd-mm-yyyy hoặc dd/mm/yyyy (Cotik)
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;

  return null;
}

function pad(s: string): string { return s.padStart(2, "0"); }
function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(String(d.getUTCMonth() + 1))}-${pad(String(d.getUTCDate()))}`;
}

const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/i;

/**
 * Bóc SIZE từ chuỗi skus/variant Cotik (ngăn bởi dấu phẩy, phần cuối thường là size).
 * Trả { size, sku } best-effort — phần không nhận ra vẫn giữ trong skus_raw.
 */
export function extractSize(raw: string): { size: string | null; sku: string | null } {
  const s = raw.trim();
  if (!s) return { size: null, sku: null };
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { size: null, sku: null };
  const last = parts[parts.length - 1];
  if (SIZE_RE.test(last)) {
    const rest = parts.slice(0, -1).join(", ");
    return { size: last.toUpperCase(), sku: rest || null };
  }
  // 1 phần & là size (vd "M")
  if (parts.length === 1 && SIZE_RE.test(parts[0])) return { size: parts[0].toUpperCase(), sku: null };
  return { size: null, sku: parts[0] || null };
}

/** Chuẩn hoá size RSA: '4x50in - Pointed', 's' -> giữ nguyên nhưng bỏ khoảng thừa. */
export function cleanSize(v: unknown): string | null {
  const s = cleanZero(v).replace(/\s+/g, " ").trim();
  return s || null;
}

/**
 * Tách "Customer Info" gộp 1 ô (RSA) thành name / phone / address.
 * Xử lý: nhiều dòng, 'Name - (+1)phone', phone lẫn trong text.
 */
export function splitCustomer(raw: string): {
  name: string | null; phone: string | null; address: string | null;
} {
  const s = cleanZero(raw);
  if (!s) return { name: null, phone: null, address: null };
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const phoneRe = /(\+?\d[\d\s().-]{6,}\d)/;

  // dùng object holder để TS không thu hẹp nhầm về null (CFA bỏ qua gán trong closure)
  const res: { name: string | null; phone: string | null } = { name: null, phone: null };
  const addrLines: string[] = [];

  lines.forEach((line, i) => {
    const pm = line.match(phoneRe);
    if (i === 0) {
      // dòng đầu: có thể "Name - (+1)phone"
      const dash = line.split(/\s[-–]\s/);
      if (dash.length > 1 && phoneRe.test(dash[dash.length - 1])) {
        res.name = dash.slice(0, -1).join(" - ").trim();
        const pmm = dash[dash.length - 1].match(phoneRe);
        res.phone = pmm ? pmm[1] : null;
      } else if (pm && line.replace(phoneRe, "").trim().length < 3) {
        res.phone = pm[1];
      } else {
        res.name = line;
      }
    } else if (pm && !res.phone) {
      res.phone = pm[1];
      const leftover = line.replace(phoneRe, "").trim();
      if (leftover) addrLines.push(leftover);
    } else {
      addrLines.push(line);
    }
  });

  return {
    name: res.name || null,
    phone: res.phone ? res.phone.trim() : null,
    address: addrLines.length ? addrLines.join(", ") : null,
  };
}

/** Chỉ giữ các cột non-empty của 1 dòng gốc -> jsonb source_raw (không phình rác). */
export function compactRaw(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    const v = cellStr(row[k]);
    if (v && k) out[k] = v.length > 500 ? v.slice(0, 500) : v;
  }
  return out;
}
