import { createClient } from "@/lib/supabase/server";
import { OrderSheet, type TemplateOpt, type AccountOpt } from "./order-sheet";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [tplRes, accRes, profRes] = await Promise.all([
    supabase
      .from("templates")
      .select("id, code, name, product_type, dimension, factory_id, factories(name)")
      .eq("active", true)
      .order("code"),
    supabase.from("selling_accounts").select("id, name, platform").eq("active", true).order("name"),
    supabase.from("profiles").select("full_name, role").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const isFFM = profRes.data?.role === "ffm" || profRes.data?.role === "admin";

  const templates: TemplateOpt[] = (tplRes.data ?? []).map((t) => {
    const fac = t.factories as unknown as { name: string } | { name: string }[] | null;
    const factory_name = Array.isArray(fac) ? fac[0]?.name ?? null : fac?.name ?? null;
    return {
      id: t.id, code: t.code, name: t.name,
      product_type: t.product_type, dimension: t.dimension, factory_id: t.factory_id,
      factory_name,
    };
  });
  const accounts: AccountOpt[] = (accRes.data ?? [])
    .filter((a) => a.platform === "TTS")
    .map((a) => ({ id: a.id, name: a.name }));
  const sellerName = profRes.data?.full_name ?? user?.email ?? "bạn";

  const configError = tplRes.error || accRes.error;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Nhập đơn (sheet)</h1>
      {configError ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {configError.message}. Kiểm tra đã chạy migration + seed_templates.sql chưa.
        </div>
      ) : (
        <>
          {templates.length === 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Chưa có Template nào — chạy <b>supabase/seed_templates.sql</b> để bật auto-fill (hoặc thêm ở mục Template).
            </div>
          )}
          <OrderSheet templates={templates} accounts={accounts} sellerName={sellerName} isFFM={isFFM} />
        </>
      )}
    </div>
  );
}
