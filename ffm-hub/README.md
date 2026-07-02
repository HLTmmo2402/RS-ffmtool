# RSA FFM Hub — bản 1 file HTML (style rs-channel-hub / rsa-qltk)

Web quản lý đơn & fulfillment POD cho nhân sự RSA. **1 file `index.html`** + Supabase
(dùng chung database với bản Next.js — cùng schema, cùng dữ liệu ~1500 đơn seed).

## Cách đưa vào dùng (3 bước)

### 1. Chạy migration duyệt user (1 lần)
Supabase Dashboard → SQL Editor → dán & Run: `supabase/migrations/0003_user_approval.sql`
(User tạo tay trước đó tự được duyệt; user đăng ký mới sẽ chờ SD duyệt.)

### 2. Cho phép đăng ký
Supabase → Authentication → Providers → Email: bật **Enable Sign up**.
Gợi ý: tắt "Confirm email" để nhân sự đăng ký xong đăng nhập được ngay
(an toàn vì chưa duyệt thì không thấy dữ liệu gì — RLS chặn từ tầng DB).

### 3. Deploy Vercel (site tĩnh)
- Cách nhanh: vercel.com → Add New → Project → import repo, **Root Directory = `ffm-hub`**,
  Framework = Other. Hoặc kéo-thả folder `ffm-hub` vào vercel.com/new.
- Supabase → Authentication → URL Configuration → thêm domain Vercel vào Redirect URLs.

## Luồng nhân sự mới
Đăng ký → màn "chờ duyệt" → SD vào **Phân quyền**: gán Vai trò + 3 phạm vi (Xem/Sửa/Xoá)
+ chọn **Seller cũ** (Hằng/Yến/Tú/…) → bấm Duyệt → hệ thống tự gán toàn bộ đơn seed cũ
của tên đó cho tài khoản (RPC `claim_seller_orders`).

## Menu
Tổng quan (KPI + hàng chờ xưởng + cảnh báo) · Việc hôm nay (theo vai trò) · Đơn hàng
(bố cục cột như Excel, tra cứu mọi từ khoá, SLA đếm ngược màu, checklist L/D/T) ·
Nhập đơn (sheet giữ đúng thứ tự cột Excel, Template auto-fill, 2 dòng trống tự sinh) ·
Import Cotik (.csv, không sửa file) · Đẩy xưởng (batch + xuất CSV + đánh dấu đã đẩy) ·
Tài chính (topup/hoàn/thanh toán + số dư xưởng) · Danh mục · Cảnh báo · Phân quyền ·
Nhật ký · Hồ sơ · Dark mode.

## Lưu ý bảo mật
- Bảo mật thật nằm ở **database**: RLS theo Role × 3 scope, trigger chặn seller sửa cột FFM,
  activity_log bất biến. Giao diện chỉ ẩn/hiện cho tiện — có sửa HTML cũng không vượt quyền.
- Anon key trong file là key công khai (như mọi app Supabase client-side), không phải secret.
