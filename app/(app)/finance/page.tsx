import { createClient } from "@/lib/supabase/server";
import { CrudTable, type Col } from "@/components/crud-table";

export const dynamic = "force-dynamic";

const CUR = [{ value: "USD", label: "USD" }, { value: "VND", label: "VND" }];

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (me?.role !== "ffm" && me?.role !== "admin") {
    return <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
      Mục Tài chính chỉ dành cho FFM / Admin.
    </div>;
  }

  const [facRes, balRes, topRes, refRes, payRes] = await Promise.all([
    supabase.from("factories").select("id, name").order("name"),
    supabase.from("v_factory_balance").select("factory_id, name, balance_usd"),
    supabase.from("topups").select("id, paid_date, amount, currency, factory_id, bank, reason, month_label").order("paid_date", { ascending: false }).limit(300),
    supabase.from("refunds").select("id, sent_date, received_date, factory_id, amount, currency, receive_account, bank").order("sent_date", { ascending: false }).limit(200),
    supabase.from("payments").select("id, paid_date, amount, currency, category, supplier, bank, month_label").order("paid_date", { ascending: false }).limit(200),
  ]);

  const facOpts = (facRes.data ?? []).map((f) => ({ value: f.id, label: f.name }));

  const topCols: Col[] = [
    { key: "paid_date", label: "Ngày TT (yyyy-mm-dd)" },
    { key: "amount", label: "Số tiền", type: "number" },
    { key: "currency", label: "Tiền tệ", type: "select", options: CUR },
    { key: "factory_id", label: "Xưởng", type: "select", options: facOpts },
    { key: "bank", label: "Ngân hàng" },
    { key: "reason", label: "Lý do" },
    { key: "month_label", label: "Tháng" },
  ];
  const refCols: Col[] = [
    { key: "sent_date", label: "Ngày gửi" },
    { key: "received_date", label: "Ngày nhận" },
    { key: "factory_id", label: "Xưởng", type: "select", options: facOpts },
    { key: "amount", label: "Số tiền", type: "number" },
    { key: "currency", label: "Tiền tệ", type: "select", options: CUR },
    { key: "receive_account", label: "TK nhận" },
    { key: "bank", label: "Ngân hàng" },
  ];
  const payCols: Col[] = [
    { key: "paid_date", label: "Ngày TT" },
    { key: "amount", label: "Số tiền", type: "number" },
    { key: "currency", label: "Tiền tệ", type: "select", options: CUR },
    { key: "category", label: "Loại" },
    { key: "supplier", label: "Nhà cung cấp" },
    { key: "bank", label: "Ngân hàng" },
    { key: "month_label", label: "Tháng" },
  ];

  const balances = (balRes.data ?? []).filter((b) => Number(b.balance_usd) !== 0)
    .sort((a, b) => Number(a.balance_usd) - Number(b.balance_usd));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Tài chính</h1>

      {/* Số dư xưởng */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Số dư xưởng (USD) = nạp − tiêu + hoàn</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left"><tr>
              <th className="px-3 py-2 font-medium text-slate-600">Xưởng</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Số dư (USD)</th>
            </tr></thead>
            <tbody>
              {balances.length === 0 ? (
                <tr><td colSpan={2} className="px-3 py-6 text-center text-slate-400">Chưa có dữ liệu số dư.</td></tr>
              ) : balances.map((b) => (
                <tr key={b.factory_id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{b.name}</td>
                  <td className={"px-3 py-1.5 text-right font-medium " + (Number(b.balance_usd) < 0 ? "text-red-600" : "text-emerald-700")}>
                    {Number(b.balance_usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Số dư âm = đã tiêu quá số nạp (cần topup). Chỉ hiển thị xưởng có phát sinh.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Topup (nạp tiền theo xưởng)</h2>
        <CrudTable table="topups" columns={topCols} initial={topRes.data ?? []} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Hoàn tiền</h2>
        <CrudTable table="refunds" columns={refCols} initial={refRes.data ?? []} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Thanh toán khác (Pink Design…)</h2>
        <CrudTable table="payments" columns={payCols} initial={payRes.data ?? []} />
      </section>
    </div>
  );
}
