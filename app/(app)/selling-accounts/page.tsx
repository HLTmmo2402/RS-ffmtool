import { createClient } from "@/lib/supabase/server";
import { CrudTable, type Col } from "@/components/crud-table";

export const dynamic = "force-dynamic";

const columns: Col[] = [
  {
    key: "platform",
    label: "Sàn",
    type: "select",
    options: [
      { value: "AMZ", label: "AMZ" },
      { value: "TTS", label: "TTS" },
    ],
  },
  { key: "name", label: "Tên tài khoản" },
  { key: "note", label: "Ghi chú" },
];

export default async function Page() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("selling_accounts")
    .select("id, platform, name, note")
    .order("platform")
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Tài khoản bán hàng</h1>
      <p className="text-sm text-slate-500">
        Danh sách chuẩn để chọn dropdown khi nhập đơn — tránh gõ sai (TTS33, AMZ Vân Anh…).
      </p>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {error.message}
        </div>
      ) : (
        <CrudTable table="selling_accounts" columns={columns} initial={data ?? []} />
      )}
    </div>
  );
}
