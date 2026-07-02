-- ============================================================
-- 0003 — Luồng ĐĂNG KÝ + SD PHÊ DUYỆT (giống rs-channel-hub / rsa-qltk)
-- Nhân sự tự đăng ký -> chờ duyệt -> Admin (SD) gán vai trò + phạm vi + seller_label
-- -> tự nhận lại toàn bộ đơn seed cũ theo tên (claim_seller_orders).
-- Idempotent: chạy lại an toàn.
-- ============================================================

alter table profiles add column if not exists approved boolean not null default false;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists seller_label text;

-- User đã tạo TRƯỚC migration này (tạo tay trong Supabase) coi như đã duyệt
update profiles set approved = true where approved = false;

-- Backfill email từ auth.users
update profiles p set email = u.email
from auth.users u where u.id = p.id and p.email is null;

-- handle_new_user: ghi thêm email; user mới mặc định CHƯA duyệt
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, approved)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.email,
          'seller',
          false)
  on conflict (id) do nothing;
  return new;
end $$;

-- is_approved(): user hiện tại đã được duyệt chưa
create or replace function is_approved() returns boolean language sql stable as $$
  select coalesce((select approved from profiles where id = auth.uid()), false)
$$;

-- my_scope: CHƯA duyệt => 'none' (khoá toàn bộ dữ liệu). Admin luôn 'all'.
create or replace function my_scope(action text) returns perm_scope_t language sql stable as $$
  select case
           when p.role = 'admin' then 'all'::perm_scope_t
           when not p.approved   then 'none'::perm_scope_t
           else case action
                  when 'view'   then p.view_scope
                  when 'edit'   then p.edit_scope
                  when 'delete' then p.delete_scope
                end
         end
  from profiles p where p.id = auth.uid()
$$;

-- Siết reference data: phải ĐÃ DUYỆT mới đọc
drop policy if exists ref_read on factories;
create policy ref_read on factories        for select using (is_approved());
drop policy if exists fa_read on factory_accounts;
create policy fa_read  on factory_accounts for select using (is_approved());
drop policy if exists sa_read on selling_accounts;
create policy sa_read  on selling_accounts for select using (is_approved());
drop policy if exists tm_read on templates;
create policy tm_read  on templates        for select using (is_approved());

-- Gán đơn seed cũ cho user vừa duyệt, theo seller_label. Chỉ admin gọi.
create or replace function claim_seller_orders(p_user uuid, p_label text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if my_role() <> 'admin' then
    raise exception 'Chỉ admin được gán đơn cho seller';
  end if;
  update orders set seller_id = p_user
  where seller_name_import = p_label and seller_id is null;
  get diagnostics n = row_count;
  return n;
end $$;
