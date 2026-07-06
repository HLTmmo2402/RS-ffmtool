// NGUỒN DUY NHẤT cho màu + nhãn trạng thái. Mọi màn (dashboard, orders, today, by-seller)
// import từ đây -> không còn 4 bảng màu lệch nhãn nhau. Chỉ dùng emerald (bỏ green), bỏ purple.

export type StatusKey =
  | "new" | "waiting_design" | "design_ok" | "ordered" | "in_production"
  | "has_tracking" | "synced" | "delivered" | "issue" | "cancelled";

export const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  new:            { label: "Mới",         badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-400" },
  waiting_design: { label: "Chờ design",  badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
  design_ok:      { label: "Design OK",   badge: "bg-lime-100 text-lime-700",     dot: "bg-lime-400" },
  ordered:        { label: "Chờ đẩy",     badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-400" },
  in_production:  { label: "Đang SX",     badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-400" },
  has_tracking:   { label: "Có tracking", badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-400" },
  synced:         { label: "Đã sync",     badge: "bg-teal-100 text-teal-700",     dot: "bg-teal-400" },
  delivered:      { label: "Đã giao",     badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  issue:          { label: "Sự cố",       badge: "bg-red-100 text-red-700",       dot: "bg-red-400" },
  cancelled:      { label: "Đã huỷ",      badge: "bg-slate-200 text-slate-600",   dot: "bg-slate-300" },
};

export function statusMeta(s?: string) {
  return STATUS_META[s ?? "new"] ?? STATUS_META.new;
}

// Danh sách trạng thái cho dropdown (nhãn tiếng Việt thay vì enum thô)
export const STATUS_OPTIONS = (Object.keys(STATUS_META) as string[]).map((v) => ({ v, label: STATUS_META[v].label }));

// Rollup trạng thái đơn từ các item (khớp logic view v_order_status)
export function stageOf(items: { item_status: string }[]): string {
  if (!items.length) return "new";
  const has = (s: string) => items.some((i) => i.item_status === s);
  const all = (s: string) => items.every((i) => i.item_status === s);
  if (has("issue")) return "issue";
  if (all("cancelled")) return "cancelled";
  if (all("delivered")) return "delivered";
  if (has("synced")) return "synced";
  if (has("has_tracking")) return "has_tracking";
  if (has("in_production")) return "in_production";
  if (has("ordered")) return "ordered";
  if (has("design_ok")) return "design_ok";
  if (has("waiting_design")) return "waiting_design";
  return "new";
}

// Nhóm phân bố (dashboard bar + by-seller cột)
export const STAGE_GROUPS = [
  { key: "design", label: "Chờ design",   statuses: ["new", "waiting_design"],      bar: "bg-orange-400",  text: "text-orange-600" },
  { key: "push",   label: "Chờ FFM",       statuses: ["design_ok", "ordered"],       bar: "bg-amber-400",   text: "text-amber-600" },
  { key: "prod",   label: "Đang SX/ship",  statuses: ["in_production", "has_tracking"], bar: "bg-blue-400", text: "text-blue-600" },
  { key: "done",   label: "Đã giao",       statuses: ["delivered", "synced"],        bar: "bg-emerald-400", text: "text-emerald-600" },
  { key: "issue",  label: "Sự cố",         statuses: ["issue"],                      bar: "bg-red-400",     text: "text-red-600" },
  { key: "cancelled", label: "Huỷ",        statuses: ["cancelled"],                  bar: "bg-slate-300",   text: "text-slate-500" },
] as const;
