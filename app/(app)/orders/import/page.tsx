import { Importer } from "./importer";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Import đơn từ Cotik</h1>
      <p className="text-sm text-slate-500">
        Vào Cotik → Orders → <b>Export</b> → tải file .csv rồi upload ở đây. Hệ thống tự
        đoán cột (Order ID, khách, tracking, link label…); đơn trùng Order ID sẽ được cập nhật.
      </p>
      <Importer />
    </div>
  );
}
