-- ============================================================
-- 0005 — TỐI ƯU HIỆU NĂNG (khắc phục lag)
-- 1) RPC tổng hợp ở DB (thay việc kéo 3000-4000 dòng về rồi đếm bằng JS).
--    SECURITY DEFINER + tự áp scope theo my_scope/auth.uid (bỏ qua RLS per-row).
-- 2) Index cho deadline_ship.
-- 3) RLS o_read/oi_read viết lại inline (không gọi hàm per-row).
-- An toàn chạy lại (create or replace / if not exists / drop policy if exists).
-- ============================================================

-- ---------------- 1) RPC thống kê Dashboard ----------------
create or replace function dashboard_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (select (my_scope('view') = 'all') as all_scope, auth.uid() as uid),
  so as (
    select o.id, o.order_date, o.seller_name_import, o.platform_order_id, o.customer_name
    from orders o cross join s
    where s.all_scope or o.seller_id = s.uid
  ),
  st as (
    select so.id, so.order_date, so.seller_name_import, so.platform_order_id, so.customer_name, vs.status
    from so join v_order_status vs on vs.order_id = so.id
  ),
  si as (
    select oi.item_status, oi.deadline_ship, f.name as factory
    from order_items oi
    join so on so.id = oi.order_id
    left join factories f on f.id = oi.factory_id
  )
  select jsonb_build_object(
    'total', (select count(*) from so),
    'today', (select count(*) from so where order_date = current_date),
    'week',  (select count(*) from so where order_date >= current_date - 7),
    'stages', (select coalesce(jsonb_object_agg(status, c), '{}'::jsonb)
               from (select status, count(*) c from st group by status) a),
    'overdue', (select count(*) from si
                where deadline_ship is not null and deadline_ship < current_date
                  and deadline_ship >= current_date - 180
                  and item_status in ('new','waiting_design','design_ok','ordered','in_production','has_tracking')),
    'byFactory', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', c) order by c desc), '[]'::jsonb)
                  from (select coalesce(factory, '(chưa gán xưởng)') name, count(*) c from si
                        where item_status in ('new','waiting_design','design_ok','ordered','in_production','has_tracking')
                        group by 1 order by 2 desc limit 10) b),
    'topSeller', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', c) order by c desc), '[]'::jsonb)
                  from (select coalesce(seller_name_import, '(chưa gán)') name, count(*) c from so
                        group by 1 order by 2 desc limit 8) c),
    'byDay', (select coalesce(jsonb_agg(jsonb_build_object('d', d::text, 'n', n) order by d), '[]'::jsonb)
              from (select days.d, coalesce(dd.c, 0) n
                    from (select gs::date d from generate_series(current_date - 13, current_date, interval '1 day') gs) days
                    left join (select order_date, count(*) c from so group by order_date) dd on dd.order_date = days.d) e),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', id, 'oid', platform_order_id, 'date', order_date,
                        'seller', seller_name_import, 'customer', customer_name, 'status', status
                      ) order by order_date desc nulls last), '[]'::jsonb)
               from (select id, platform_order_id, order_date, seller_name_import, customer_name, status
                     from st order by order_date desc nulls last limit 8) r),
    'negBalance', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'balance', balance_usd) order by balance_usd), '[]'::jsonb)
                   from (select name, balance_usd from v_factory_balance where balance_usd < 0 order by balance_usd limit 8) g)
  )
$$;

-- ---------------- RPC thống kê theo Seller ----------------
create or replace function seller_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (select (my_scope('view') = 'all') as all_scope, auth.uid() as uid),
  so as (select o.id, o.seller_name_import from orders o cross join s where s.all_scope or o.seller_id = s.uid),
  st as (select so.seller_name_import, vs.status from so join v_order_status vs on vs.order_id = so.id)
  select coalesce(jsonb_agg(row order by total desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'name', coalesce(seller_name_import, '(chưa gán seller)'),
      'total', count(*),
      'design', count(*) filter (where status in ('new','waiting_design')),
      'push',   count(*) filter (where status in ('design_ok','ordered')),
      'prod',   count(*) filter (where status in ('in_production','has_tracking')),
      'done',   count(*) filter (where status in ('delivered','synced')),
      'issue',  count(*) filter (where status = 'issue')
    ) as row, count(*) as total
    from st group by seller_name_import
  ) q
$$;

-- ---------------- 2) Index cho deadline_ship ----------------
create index if not exists idx_oi_deadline on order_items (deadline_ship);
create index if not exists idx_oi_status_deadline on order_items (item_status, deadline_ship);

-- ---------------- 3) RLS đọc: inline, không gọi hàm per-row ----------------
-- Bọc (select …) để Postgres InitPlan-cache 1 lần/truy vấn thay vì chạy per-row.
-- Giữ đúng ngữ nghĩa: all -> tất cả; own -> đơn của mình; none -> không.
drop policy if exists o_read on orders;
create policy o_read on orders for select using (
  (select my_scope('view')) = 'all'
  or ((select my_scope('view')) = 'own' and seller_id = (select auth.uid()))
);

drop policy if exists oi_read on order_items;
create policy oi_read on order_items for select using (
  (select my_scope('view')) = 'all'
  or ((select my_scope('view')) = 'own'
      and exists (select 1 from orders o where o.id = order_items.order_id and o.seller_id = (select auth.uid())))
);
