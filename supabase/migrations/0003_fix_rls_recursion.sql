-- ============================================================
-- 0003 — SỬA RLS ĐỆ QUY (bug chặn mọi truy vấn của user đăng nhập)
-- my_role()/my_scope() đọc bảng profiles, mà policy CỦA profiles lại gọi 2 hàm này
-- -> đệ quy vô hạn -> user đăng nhập không đọc được profile (mất quyền) & không đọc được đơn.
-- Fix chuẩn: 2 hàm chạy SECURITY DEFINER (bỏ qua RLS khi đọc profiles) + cố định search_path.
-- An toàn chạy lại (create or replace). Chạy SAU 0001 (và 0002).
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

-- in_scope() chỉ gọi my_scope() (không đọc trực tiếp profiles) nên không cần đổi.
