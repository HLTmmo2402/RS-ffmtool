-- ============================================================
-- 0004 — PHÂN QUYỀN THEO MỤC (menu) cho từng người
-- allowed_modules NULL  = theo vai trò (mặc định, như cũ).
-- allowed_modules = mảng key  = người này CHỈ thấy/vào các mục này (+ Tổng quan & Hồ sơ luôn có).
-- Không áp cho admin (admin luôn thấy hết). Cấu hình ở trang Admin › Phân quyền.
-- An toàn chạy lại.
-- ============================================================
alter table profiles add column if not exists allowed_modules text[];
