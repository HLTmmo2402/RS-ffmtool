import { createClient } from "@/lib/supabase/server";
import { CrudTable, type Col } from "@/components/crud-table";

export const dynamic = "force-dynamic";

const columns: Col[] = [
  { key: "name", label: "Tên xưởng" },
  {
    key: "status",
    label: "Trạng thái",
    type: "select",
    options: [
      { value: "active", label: "Đang dùng" },
      { value: "evaluating", label: "Đang đánh giá" },
      { value: "rejected", label: "Loại" },
    ],
  },
  { key: "website", label: "Website" },
  { key: "production_sla_days", label: "SLA SX (ngày)", type: "number" },
  { key: "ship_sla_days", label: "SLA Ship (ngày)", type: "number" },
  { key: "order_guide_url", label: "HD đi đơn" },
  { key: "notes", label: "Ghi chú" },
];

export default async function Page() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("factories")
    .select(
      "id, name, status, website, production_sla_days, ship_sla_days, order_guide_url, notes"
    )
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Xưởng in / Nhà cung cấp</h1>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {error.message}
        </div>
      ) : (
        <CrudTable table="factories" columns={columns} initial={data ?? []} />
      )}
    </div>
  );
}
