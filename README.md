# FFM Tool

Web app thay 3 file Excel vận hành **Fulfillment POD** (TikTok/Amazon → design → xưởng in → tracking).
Stack: **Next.js 14 + Supabase + Vercel**. Grid nhập liệu kiểu Excel, phân quyền theo Role × scope, có nhật ký hoạt động.

> Tài liệu thiết kế: [docs/data-model.md](docs/data-model.md) · Schema: [docs/schema.sql](docs/schema.sql)

## Đã có (Phase 0 + Phase 1 một phần)
- Đăng nhập + middleware bảo vệ route + phân quyền RLS (Role × view/edit/delete scope).
- Catalog: **Xưởng** (`/factories`), **Template** (`/templates`), **TK bán hàng** (`/selling-accounts`) — thêm/sửa/xoá inline.
- **Import Cotik** (`/orders/import`): upload file Export (.csv) → tự đoán & map cột → nạp đơn (khách, tracking, link label, trạng thái). Đơn trùng Order ID sẽ được cập nhật.
- **Đơn hàng** (`/orders`): danh sách hiển thị trạng thái sàn, khách, tracking, label; sửa ghi chú inline.

## Cài đặt & chạy local

### 1. Tạo Supabase project
- Vào https://supabase.com → New project. Lưu **Project URL** và **anon public key** (Project Settings → API).

### 2. Chạy schema
- Supabase Dashboard → **SQL Editor** → dán toàn bộ nội dung [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → Run.
  (Tạo bảng, view, RLS, trigger, activity_log, và trigger tự tạo profile khi có user mới.)

### 3. Cấu hình biến môi trường
```bash
cp .env.example .env.local
```
Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. Chạy
```bash
npm install
npm run dev
```
Mở http://localhost:3000 → sẽ chuyển tới `/login`.

### 5. Tạo user & nâng quyền admin
- Tạo user: Supabase Dashboard → Authentication → Add user (hoặc bật Email signup). Trigger sẽ tự tạo profile (role `seller`).
- Nâng chính bạn lên admin (SQL Editor):
```sql
update profiles
set role='admin', view_scope='all', edit_scope='all', delete_scope='all'
where id = (select id from auth.users where email='ban@example.com');
```

### 6. Dùng thử
1. Vào **Xưởng / Template / TK bán** thêm vài dòng.
2. Vào **Import Cotik** → upload file Export từ Cotik → map cột → Import.
3. Vào **Đơn hàng** xem đơn đã nạp (khách, tracking, label).

## Deploy Vercel
- Push repo lên GitHub → Vercel → Import project.
- Thêm env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong Vercel → Settings → Environment Variables.
- Deploy.

## Bảo mật
- File Excel gốc (chứa mật khẩu xưởng) để trong `_private/` và **đã bị .gitignore** — không commit.
- Không commit `.env.local`.

## Lệnh
```bash
npm run dev        # chạy dev
npm run build      # build production
npm run typecheck  # kiểm tra type
npm run lint       # eslint
```

## Lộ trình còn lại (xem plan)
Tạo đơn thủ công + `order_items` + auto-fill template · Pipeline fulfillment (trạng thái/tracking/cost) ·
Tài chính (topup/số dư) · Admin phân quyền UI · Nhật ký · Dashboard · Cotik real-time (token extension) · Telegram/SLA.
