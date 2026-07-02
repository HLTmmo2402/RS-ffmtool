import { Importer } from "./importer";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Import đơn hàng</h1>
      <p className="text-sm text-slate-500">
        Nạp đơn từ 2 nguồn, <b>không cần sửa file</b>: <b>Cotik export (.csv)</b> hoặc <b>Sheet RSA-FFM (.xlsx)</b>.
        Hệ thống tự gộp đơn nhiều sản phẩm (theo Order ID), tách tài khoản bán / seller / xưởng, bóc size và
        suy trạng thái. Đơn đã có sẽ được cập nhật thông tin — <b>giữ nguyên</b> sản phẩm & dữ liệu FFM đã nhập.
      </p>
      <Importer />
    </div>
  );
}
