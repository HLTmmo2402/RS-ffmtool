# RSA FFM Hub — Web quản lý đơn & Fulfillment POD

**Folder này là 1 nơi độc lập hoàn toàn** — đủ mọi thứ để chạy, không phụ thuộc file nào khác:

| File | Là gì |
|------|-------|
| `index.html` | Toàn bộ web app (1 file duy nhất, style giống rs-channel-hub / rsa-qltk) |
| `supabase-setup.sql` | Setup trọn bộ database (bảng + RLS + nhật ký + luồng duyệt user) |
| `seed_templates.sql` | 85 Template + 12 xưởng (nguồn auto-fill) |
| `README.md` | File này |

---

## A. Setup Supabase

**Nếu dùng lại project Supabase cũ** (đã có ~1500 đơn từ bản Next.js):
chỉ chạy **PHẦN 3/3** trong `supabase-setup.sql` (SQL Editor → Run). Xong mục A.

**Nếu tạo project MỚI:**
1. <https://supabase.com> → New project → lưu **Project URL** + **anon key** (Settings → API).
2. SQL Editor → dán **toàn bộ** `supabase-setup.sql` → Run.
3. SQL Editor → dán `seed_templates.sql` → Run (để có Template auto-fill).
4. Mở `index.html`, sửa 2 dòng đầu script: `SUPA_URL` và `SUPA_KEY` theo project mới.
5. (Tuỳ chọn) Nạp 1500 đơn cũ: chạy `seed_data.sql` từ project gốc — file này chứa
   tên/địa chỉ khách (PII), **không được commit lên GitHub**.

**Bật đăng ký:** Authentication → Sign In / Up → bật **Enable Email Sign up**.
Nên tắt "Confirm email" để nhân sự đăng nhập ngay — an toàn vì chưa được SD duyệt
thì RLS chặn toàn bộ dữ liệu từ tầng database.

**Tạo tài khoản SD (admin) đầu tiên:** đăng ký trên web, rồi chạy SQL:
```sql
update profiles set role='admin', approved=true,
  view_scope='all', edit_scope='all', delete_scope='all'
where email = 'lehieu1497@gmail.com';
```

## B. Đưa lên GitHub + Vercel

```bash
cd ffm-hub
git init
git add index.html README.md supabase-setup.sql seed_templates.sql
git commit -m "RSA FFM Hub v1.0"
# tạo repo rỗng trên github.com rồi:
git remote add origin https://github.com/<tai-khoan>/rsa-ffm-hub.git
git branch -M main && git push -u origin main
```

Vercel: **Add New → Project → Import** repo → Framework = **Other** (site tĩnh) → Deploy.
Xong vào Supabase → Authentication → URL Configuration → thêm `https://<ten-repo>.vercel.app`
vào **Site URL / Redirect URLs**.

Mỗi lần sửa `index.html` + `git push` → Vercel tự cập nhật.

⚠ **Không** copy `seed_data.sql` hay file Excel gốc vào folder này — chúng chứa PII/mật khẩu.

## C. Luồng vận hành

1. **Nhân sự đăng ký** → chờ duyệt. SD vào **Phân quyền**: gán Vai trò (Seller/FFM/Admin)
   + 3 phạm vi Xem/Sửa/Xoá + **Seller cũ** → Duyệt → tự nhận lại toàn bộ đơn seed theo tên.
2. **Seller nhập đơn** ở *Nhập đơn* (bố cục cột giữ như Excel; Platform/Shipped by/Seller tự gán;
   chọn Template → auto-fill 3 cột xanh; 2 dòng trống luôn sẵn).
3. **Import dữ liệu**: Cotik `.csv` hoặc RSA-FFM `.xlsx` (chọn sheet) — đơn trùng chỉ cập nhật
   cấp đơn, không phá dữ liệu FFM.
4. **FFM đẩy xưởng**: màn *Đẩy xưởng* gom đơn đủ 3 điều kiện (Label ✅ Design ✅ Tracking ✅)
   theo từng xưởng → xuất CSV batch → "Đánh dấu đã đẩy".
5. **Tài chính**: topup/hoàn/thanh toán theo xưởng, số dư = nạp − tiêu + hoàn, âm thì cảnh báo.
6. **Tổng quan / Việc hôm nay / Cảnh báo**: SLA đếm ngược màu, đơn thiếu điều kiện, xưởng âm dư.
7. **Nhật ký**: mọi thao tác ghi tự động ở DB, không sửa/xoá được.

## D. Phân quyền (2 lớp, DB enforce)

- **Role** = làm được cột nào: `seller` (cột 🔵) / `ffm` (cột 🟢 + tài chính) / `admin`.
- **3 scope độc lập** Xem/Sửa/Xoá: `none / own / all` — *xem-toàn-bộ ≠ sửa-toàn-bộ*.
- Seller không sửa được cột FFM kể cả khi có edit=all (trigger DB chặn).
- Mật khẩu xưởng ở bảng `factory_secrets` riêng, chỉ FFM/Admin đọc, không vào nhật ký.

## Lộ trình sau (cần duyệt bên thứ ba, chưa làm)
TikTok Shop Partner API (tự điền Customer Info) · Cotik webhook · Telegram bot nhắc việc ·
Realtime sync · nút "Nhận hỗ trợ" care hộ cấp quyền tạm.
