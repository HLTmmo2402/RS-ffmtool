# FFM Tool

Web app thay 3 file Excel vận hành **Fulfillment POD** (TikTok/Amazon → design → xưởng in → tracking).
Stack: **Next.js 14 (App Router) + Supabase (Postgres/Auth/RLS) + Vercel**. Grid nhập liệu kiểu Excel,
phân quyền Role × 3 scope (view/edit/delete), nhật ký hoạt động.

> Thiết kế dữ liệu: [docs/data-model.md](docs/data-model.md) · Schema gốc: [docs/schema.sql](docs/schema.sql)
> · Mô tả sản phẩm: `Mô tả xây dựng web FFM.docx`

## Tính năng đã có
- **Đăng nhập** + middleware bảo vệ route + **RLS** (Role seller/ffm/admin × scope view/edit/delete độc lập/người).
- **Nhập đơn (sheet)** `/orders/new`: grid giống Excel — chọn **Template** tự điền Product Type / Nhà in / Dimension
  (ô xanh = auto); Platform=TTS, Shipped by=TikTok Shipping, Seller = người đăng nhập (tự gán, không phải điền);
  luôn có 2 dòng trống, gõ gần hết tự thêm dòng.
- **Import** `/orders/import` — nạp **không cần sửa file**:
  - **Cotik export (.csv)** — đơn từ Cotik.
  - **Sheet RSA-FFM (.xlsx)** — sheet "Đơn đang đi" của từng seller (hoặc chọn *tất cả sheet*).
  - Tự gộp đơn nhiều sản phẩm (theo Order ID), tách TK bán / seller / xưởng, bóc size, suy trạng thái.
    Đơn đã có → cập nhật thông tin, **giữ nguyên** sản phẩm & dữ liệu FFM đã nhập.
- **Đơn hàng** `/orders`: danh sách + **tiến độ tự động** (rollup từ sản phẩm), tìm kiếm (Order ID/khách/note/color/tracking),
  đánh dấu **đơn nhiều SP**, sửa ghi chú inline; bấm Order ID mở **chi tiết**.
- **Chi tiết đơn** `/orders/[id]`: sửa thông tin đơn + từng sản phẩm; tách rõ **🔵 Seller nhập** và **🟢 FFM cập nhật**
  (Xưởng, TK xưởng, Order FFM, Tracking, trạng thái, chi phí) — cột FFM chỉ FFM/Admin sửa (RLS + trigger chặn). Thêm/xoá SP.
- **Dashboard** `/dashboard`: đơn theo tiến độ (chờ seller / chờ FFM / đang SX / đã giao / sự cố), **cảnh báo quá hạn SLA**,
  **hàng chờ theo xưởng**, xưởng **âm số dư** cần topup.
- **Tài chính** `/finance` (FFM/Admin): Topup / Hoàn tiền / Thanh toán (CRUD) + **Số dư xưởng** (nạp − tiêu + hoàn).
- **Nhật ký** `/activity` (xem-toàn-bộ): ai INSERT/UPDATE/DELETE gì, khi nào.
- **Danh mục**: Xưởng `/factories`, Template `/templates`, TK bán `/selling-accounts` (thêm/sửa/xoá inline).
- **Admin › Người dùng** `/admin/users`: chỉnh Vai trò + 3 phạm vi quyền cho từng người.

---

## A. Chạy trên máy (local)

### 1. Tạo Supabase project
- Vào <https://supabase.com> → **New project**. Lưu **Project URL** và **anon public key**
  (Project Settings → API).

### 2. Chạy schema + dữ liệu (Supabase Dashboard → **SQL Editor** → dán & Run, theo thứ tự)
| Thứ tự | File | Tác dụng |
|--------|------|----------|
| 1 | [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) | Bảng, view, RLS, trigger, activity_log |
| 2 | [`supabase/migrations/0002_import_fields.sql`](supabase/migrations/0002_import_fields.sql) | Cột phục vụ import + sheet nhập |
| 3 | [`supabase/migrations/0003_fix_rls_recursion.sql`](supabase/migrations/0003_fix_rls_recursion.sql) | **Bắt buộc** — sửa RLS đệ quy (không có bước này user đăng nhập mất quyền + không đọc được đơn) |
| 4 | [`supabase/seed_templates.sql`](supabase/seed_templates.sql) | 85 Template + 12 xưởng (để auto-fill) |
| 5 *(tuỳ chọn)* | `supabase/seed_data.sql` | (nâng cao) nạp qua `psql`; thường **nạp đơn bằng nút Import trên web** cho nhẹ |

### 3. Biến môi trường
```bash
cp .env.example .env.local
```
Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. Cài & chạy
```bash
npm install
npm run dev
```
Mở <http://localhost:3000> → chuyển tới `/login`.

### 5. Tạo user & nâng quyền admin
- Supabase → Authentication → **Add user** (hoặc bật Email signup). Đăng nhập lần đầu → trigger tự tạo profile (role `seller`).
- Nâng chính bạn lên admin (SQL Editor):
```sql
update profiles set role='admin', view_scope='all', edit_scope='all', delete_scope='all'
where id = (select id from auth.users where email='ban@example.com');
```
- Sau đó vào **Admin › Người dùng** để set quyền cho từng seller. VD seller mới để **Xem = own**;
  seller tin tưởng / trưởng nhóm set **Xem = all** (tra cứu & care hộ). *Xem-toàn-bộ ≠ Sửa-toàn-bộ.*

---

## B. Đưa lên GitHub & Public web (Vercel)

### 1. Đẩy code lên GitHub
> `.gitignore` đã chặn `_private/`, `.env*`, `*.xlsx`, `supabase/seed_data.sql` — dữ liệu nhạy cảm KHÔNG bị đẩy lên.
```bash
git init
git add .
git commit -m "FFM Tool: import Cotik/RSA + sheet nhập đơn"
# Tạo repo rỗng trên github.com (KHÔNG thêm README), rồi:
git remote add origin https://github.com/<tài-khoản>/<tên-repo>.git
git branch -M main
git push -u origin main
```
> Có sẵn `gh` CLI thì nhanh hơn: `gh repo create <tên-repo> --private --source=. --push`.

### 2. Deploy Vercel
1. Vào <https://vercel.com> → **Add New… → Project** → **Import** repo GitHub vừa tạo.
2. Framework tự nhận **Next.js**. Ở **Environment Variables** thêm 2 biến (giống `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Deploy**. Xong sẽ có link công khai dạng `https://<tên-repo>.vercel.app`.
4. Supabase → Authentication → **URL Configuration**: thêm domain Vercel vào **Site URL / Redirect URLs**
   để đăng nhập hoạt động trên web thật.

> Mỗi lần `git push` lên `main`, Vercel tự build lại và cập nhật web.

---

## C. Nạp sẵn dữ liệu thật từ 3 file Excel (`_private/`)

Muốn web có sẵn đơn/topup thật để dùng ngay (không phải import tay):

```bash
python scripts/gen_template_seed.py   # -> supabase/seed_templates.sql  (Template + xưởng)
python scripts/gen_seed_data.py       # -> supabase/seed_data.sql       (~1500 đơn, 1696 SP, 148 topup)
```
Rồi dán 2 file `.sql` vào **Supabase SQL Editor → Run** (sau 0001, 0002).

⚠ **Bảo mật:** `seed_data.sql` chứa **tên/địa chỉ/SĐT khách** → đã `.gitignore`, **không commit**.
File Excel gốc (có mật khẩu xưởng) để trong `_private/` — cũng đã `.gitignore`.
Đơn seed để `seller_id` trống (chưa có user); tên seller giữ ở `seller_name_import` để gán sau.

---

## Lệnh
```bash
npm run dev        # chạy dev
npm run build      # build production
npm run typecheck  # kiểm tra type
npm run lint       # eslint
```

Khảo sát dữ liệu (Python + openpyxl/pandas):
```bash
python scripts/analyze_orders.py        # phân tích file Cotik export
python scripts/inspect_rsa.py           # xem cấu trúc RSA-FFM.xlsx
```

## Lộ trình còn lại (cần credentials / hạ tầng ngoài — chưa làm)
Các phần này cần đăng ký/duyệt bên thứ ba nên chưa bật:
- **TikTok Shop Partner API** — tự điền Customer Info khi gõ Order ID (OAuth2, duyệt 2–3 ngày).
- **Cotik** webhook/realtime — hiện Cotik chưa có API công khai; tạm thời dùng Import CSV.
- **Telegram bot** nhắc việc / cảnh báo số dư (cần bot token + cron).
- **Realtime WebSocket** đồng bộ tức thời giữa Seller ↔ FFM · "nhận hỗ trợ" (care hộ) cấp quyền tạm.
- rule-engine tự chuyển trạng thái ở tầng DB (hiện trạng thái được suy khi import/nhập + rollup hiển thị).
