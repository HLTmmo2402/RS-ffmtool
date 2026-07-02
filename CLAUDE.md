# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ngôn ngữ
Giao tiếp với người dùng bằng **tiếng Việt**.

## Dự án là gì
Xây **web app thay thế 3 file Excel** vận hành **Fulfillment POD (Print-on-Demand)** của team RSA:
nhận đơn TikTok Shop (TTS) / Amazon (AMZ) → xử lý design → đẩy **xưởng in/thêu** (Merchize, Onos,
Menprint, Twinklprint, ToAddit, Zootop Bear, Mango, A2K, Printway...) → xưởng sản xuất & ship →
sync tracking về sàn. 1 điều phối FFM (Ngọc) + nhiều Seller (Hằng, Yến, Tú, Chi, Huệ, Huy, Thi, Nguyên...).

## Trạng thái hiện tại: GIAI ĐOẠN THIẾT KẾ (chưa có code app)
Repo hiện chỉ có **nguồn dữ liệu Excel** + **tài liệu thiết kế**. Chưa có codebase Next.js.

- `docs/data-model.md` — thiết kế dữ liệu: ERD, vai trò từng bảng, **phân quyền**, pipeline trạng thái,
  và các **giả định cần xác nhận**. Đọc file này trước khi bàn về schema.
- `docs/schema.sql` — DDL Supabase/Postgres đầy đủ (bảng, view, RLS, trigger, activity_log). Là nguồn sự thật của mô hình dữ liệu.
- 3 file Excel gốc (`RSA - FFM.xlsx`, `Báo giá FFM_RSA.xlsx`, `RSA - YCTT Topup - 04.2026.xlsx`) — dữ liệu để migrate.
- `.claude/agents/reseacher.md` — subagent nghiên cứu (model opus).

## Stack đã chốt (khi bắt đầu code)
**Next.js (App Router) + Vercel + Supabase (Postgres/Auth/RLS/Realtime/Edge Functions) + GitHub.**
Grid nhập liệu "giống Excel" (AG Grid / Glide Data Grid). **MVP ưu tiên tự động hoá**, nhưng theo thứ tự:
dựng data spine → automation-lite không cần API duyệt (import CSV, export CSV xưởng, template auto-fill,
bot Telegram, cảnh báo số dư) → sau đó mới tới API TikTok/Amazon (cần duyệt, là rủi ro tiến độ).

## Mô hình dữ liệu — điểm cần nắm (chi tiết ở docs/)
- **`orders` 1—n `order_items`**: 1 đơn sàn nhiều sản phẩm; **pipeline fulfillment + tracking + chi phí ở cấp item**, không ở order. Trạng thái đơn là rollup (view `v_order_status`).
- **Cột auto** (product_type / factory / dimension) là **snapshot** copy từ `templates` lúc tạo item — KHÔNG phải FK sống, để sửa template không làm đổi lịch sử.
- **Topup theo XƯỞNG** (không theo email account). Số dư = view `v_factory_balance` (nạp − tiêu + hoàn).
- **KHÔNG track doanh thu/lãi-lỗ sản phẩm** (ngoài phạm vi FFM). Có sẵn `orders.ffm_fee` nullable để bật P&L của FFM sau.
- Mật khẩu xưởng ở `factory_secrets` (mã hoá, RLS chặt) — không lưu plaintext.

## Phân quyền (đọc kỹ trước khi đụng RLS)
Hai lớp độc lập, cấu hình theo từng nhân sự trong `profiles`:
- **Role** = LÀM cột nào: `seller` (cột seller) / `ffm` (cột fulfillment + tài chính) / `admin`.
- **3 scope độc lập** `view_scope` / `edit_scope` / `delete_scope`, mỗi cái `none|own|all`.
- Nguyên tắc: **xem-toàn-bộ ≠ sửa-toàn-bộ**. RLS dùng hàm `my_scope()` + `in_scope()`; column-level (seller không sửa cột FFM) do trigger `guard_item_columns()`.
- **`activity_log`** ghi tự động ai INSERT/UPDATE/DELETE gì (trigger `log_activity`, SECURITY DEFINER, bất biến).

## Đọc file Excel (khi cần khảo sát dữ liệu)
Python 3.10 + `pandas` + `openpyxl` đã cài. Đọc bằng `openpyxl.load_workbook(path, data_only=True, read_only=True)`.
**Bẫy đã gặp:** đừng đặt tên script trùng module stdlib (vd `inspect.py`) — numpy sẽ import nhầm và crash.
File 1 có 23 sheet (mỗi Seller 1 sheet cùng cấu trúc); cột "auto" trong Excel đang lỗi `#NAME?`.

## Lưu ý khi migrate dữ liệu
- `order_id` sàn KHÔNG unique trong Excel (đơn nhiều item lặp dòng; có hậu tố tay `-Point`/`-Pointed`) → gộp về `orders` + `order_items`.
- Tên tài khoản bán hàng bị gõ sai (`TTTS28`, `TT29`) → chuẩn hoá về `selling_accounts` (dropdown).
- Chuỗi "Nhà in" trong data cũ ("ONOS"/"Onos"...) phải map về `factories.id`.
