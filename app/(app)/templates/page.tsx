import { createClient } from "@/lib/supabase/server";
import { CrudTable, type Col } from "@/components/crud-table";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const [{ data: factories }, { data, error }] = await Promise.all([
    supabase.from("factories").select("id, name").order("name"),
    supabase
      .from("templates")
      .select("id, code, name, factory_id, product_type, dimension, template_link")
      .order("code"),
  ]);

  const factoryOptions = ((factories ?? []) as { id: string; name: string }[]).map(
    (f) => ({ value: f.id, label: f.name })
  );

  const columns: Col[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Tên template" },
    { key: "factory_id", label: "Xưởng", type: "select", options: factoryOptions },
    { key: "product_type", label: "Product Type" },
    { key: "dimension", label: "Dimension" },
    { key: "template_link", label: "Link template" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Template Design</h1>
      <p className="text-sm text-slate-500">
        Chọn template khi nhập đơn → tự điền Product Type / Xưởng / Dimension cho sản phẩm.
      </p>
      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {error.message}
        </div>
      ) : (
        <CrudTable table="templates" columns={columns} initial={data ?? []} />
      )}
    </div>
  );
}
