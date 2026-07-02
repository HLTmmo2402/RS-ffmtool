-- ============================================================
-- 0002 — Bổ sung cột phục vụ IMPORT (Cotik export + RSA-FFM Excel)
-- An toàn chạy lại (idempotent): dùng ADD COLUMN IF NOT EXISTS.
-- Không đổi cột cũ. Mục tiêu: giữ TRỌN dữ liệu 2 nguồn, không bắt seller sửa file.
-- ============================================================

-- ---- orders ----
-- order_value: GIÁ TRỊ đơn (Cotik cột `price`). Nullable, chỉ để tham khảo/đối chiếu
--   & ưu tiên đơn — KHÔNG dùng tính lãi-lỗ (ngoài scope FFM). Bỏ cột `est`.
alter table orders add column if not exists order_value numeric(12,2);

-- import_source: nguồn nạp dòng ('cotik' | 'rsa_ffm' | thủ công=null) để truy vết.
alter table orders add column if not exists import_source text;

-- seller_name_import: TÊN seller thô từ file (Tú/Hằng…) khi chưa map được profiles.id
--   (vd seed dữ liệu lúc chưa có user, hoặc import bởi FFM). Hiển thị tạm tới khi gán seller_id.
alter table orders add column if not exists seller_name_import text;

-- source_raw: lưu NGUYÊN dòng gốc (các cột non-empty) -> không mất dữ liệu khi migrate.
alter table orders add column if not exists source_raw jsonb;

-- ---- order_items ----
-- product_title : tên listing/sản phẩm (Cotik `title` / RSA phần listing) — schema gốc thiếu chỗ chứa.
alter table order_items add column if not exists product_title text;
-- template_code : mã Template thô từ RSA (vd '024_Onos_All-Over Print') để map templates.id sau.
alter table order_items add column if not exists template_code text;
-- skus_raw      : chuỗi SKU/phôi thô (Cotik `skus` trộn size+lời nhắn / RSA `Phôi`) — giữ bản gốc.
alter table order_items add column if not exists skus_raw text;
-- carrier       : đơn vị vận chuyển (RSA `Carrier`: USPS...).
alter table order_items add column if not exists carrier text;
-- shipping_cost : chi phí ship xưởng (RSA `Shipping Cost (USD)`). `fulfillment_cost` = Items Cost.
alter table order_items add column if not exists shipping_cost numeric(12,2);
-- source_line   : thứ tự dòng-item trong đơn (1..n) — khoá ổn định để re-import không nhân bản.
alter table order_items add column if not exists source_line int;
-- import_source / source_raw: như orders.
alter table order_items add column if not exists import_source text;
alter table order_items add column if not exists source_raw jsonb;

-- pushed_at    : ngày FFM đẩy đơn xuống xưởng (RSA `Ngày đẩy đơn`) — mốc trạng thái "đã gửi xưởng".
alter table order_items add column if not exists pushed_at date;
-- deadline_ship: hạn phải ship (RSA `Deadline Ship by - US time`) — phục vụ cảnh báo SLA sau.
alter table order_items add column if not exists deadline_ship date;
-- order_design_code / listing_link: mã & link thiết kế (RSA `Order Design`, `Listing Mockup/Link SP`).
alter table order_items add column if not exists order_design_code text;
alter table order_items add column if not exists listing_link text;

-- Khoá tự nhiên cho item (để upsert idempotent khi re-import cùng đơn):
--   (order_id, source_line). Item nhập tay không có source_line (null) nên không vướng.
create unique index if not exists uq_order_items_source_line
  on order_items (order_id, source_line)
  where source_line is not null;

-- ============================================================
-- PHÂN QUYỀN XEM: KHÔNG ép cứng. Mặc định least-privilege (seller view='own' — chỉ
-- thấy đơn của mình). ADMIN tự chọn cho từng người: ai được "xem tất cả" thì set
-- view_scope='all' (vd trưởng nhóm, seller đã tin tưởng); seller mới cứ để 'own'.
-- Cấu hình per-user ở trang Admin › Người dùng, hoặc bằng SQL:
--   update profiles set view_scope='all' where full_name = 'Tên seller';
-- (schema 0001 đã có sẵn 3 scope độc lập view/edit/delete cho mỗi profile.)
-- ============================================================
