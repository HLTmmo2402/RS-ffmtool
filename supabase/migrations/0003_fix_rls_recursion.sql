-- ============================================================
-- 0003 — VÁ RLS ĐỆ QUY + GỠ CỔNG "DUYỆT TÀI KHOẢN"
-- Bug: my_role()/my_scope() đọc bảng profiles, mà policy CỦA profiles lại gọi 2 hàm này
--      -> đệ quy vô hạn -> user đăng nhập mất quyền + không đọc được đơn (dù DB là admin).
-- Fix: 2 hàm chạy SECURITY DEFINER (bỏ qua RLS khi đọc profiles) + cố định search_path.
-- Đồng thời gỡ cổng "chờ duyệt" (mô hình hiện tại: admin tạo user sẵn, không tự đăng ký).
-- An toàn chạy lại (create or replace / drop policy if exists). Chạy SAU 0001, 0002.
-- ============================================================

create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_scope(action text) returns perm_scope_t
language sql stable security definer set search_path = public as $$
  select case when p.role = 'admin' then 'all'::perm_scope_t
              else case action
                     when 'view'   then p.view_scope
                     when 'edit'   then p.edit_scope
                     when 'delete' then p.delete_scope
                   end
         end
  from profiles p where p.id = auth.uid()
$$;

-- Dữ liệu tham chiếu: đọc cho MỌI user đã đăng nhập (gỡ ràng buộc is_approved nếu từng áp).
drop policy if exists ref_read on factories;
create policy ref_read on factories        for select using (auth.role() = 'authenticated');
drop policy if exists fa_read on factory_accounts;
create policy fa_read  on factory_accounts for select using (auth.role() = 'authenticated');
drop policy if exists sa_read on selling_accounts;
create policy sa_read  on selling_accounts for select using (auth.role() = 'authenticated');
drop policy if exists tm_read on templates;
create policy tm_read  on templates        for select using (auth.role() = 'authenticated');

-- User mới đăng nhập lần đầu: tạo profile seller (view=own), dùng được ngay — KHÔNG chờ duyệt.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          'seller')
  on conflict (id) do nothing;
  return new;
end $$;
