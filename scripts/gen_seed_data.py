# -*- coding: utf-8 -*-
"""
Sinh supabase/seed_data.sql — nạp SẴN dữ liệu thật từ _private vào web:
  - orders + order_items  (sheet 'Tổng hợp đơn' của RSA-FFM, gộp theo Order ID)
  - selling_accounts, factories (suy từ đơn)
  - topups / refunds / payments (file RSA-YCTT Topup)

Chạy: python scripts/gen_seed_data.py
Nạp:  Supabase SQL Editor -> dán supabase/seed_data.sql (SAU 0001,0002,seed_templates) -> Run.

LƯU Ý BẢO MẬT: file .sql chứa thông tin KHÁCH HÀNG (tên/địa chỉ/SĐT) -> đã .gitignore, KHÔNG commit.
Idempotent: orders/items dùng ON CONFLICT DO NOTHING; topup/refund/payment chỉ nạp khi bảng còn rỗng.
"""
import sys, re, datetime, openpyxl
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

RSA = r"d:\AI\Tool FFM\_private\RSA - FFM.xlsx"
TOP = r"d:\AI\Tool FFM\_private\RSA - YCTT Topup - 04.2026.xlsx"
OUT = r"d:\AI\Tool FFM\supabase\seed_data.sql"

def s0(v):
    if v is None: return ""
    if isinstance(v, datetime.datetime): return v.isoformat()
    t = " ".join(str(v).split()).strip()
    return "" if t == "0" else t

def q(v):
    """SQL literal (giữ xuống dòng cho seller_note/customer)."""
    if v is None: return "null"
    if isinstance(v, datetime.datetime): v = v.strftime("%Y-%m-%d")
    s = str(v)
    if isinstance(v, str): s = v
    s = s.strip()
    if s == "" or s == "0": return "null"
    return "'" + s.replace("'", "''") + "'"

def qmulti(v):
    """Như q nhưng KHÔNG rút gọn khoảng trắng (giữ địa chỉ nhiều dòng)."""
    if v is None: return "null"
    s = str(v).strip()
    if s == "" or s == "0": return "null"
    return "'" + s.replace("'", "''") + "'"

def dt(v):
    if v is None: return None
    if isinstance(v, datetime.datetime): return v.strftime("%Y-%m-%d")
    t = str(v).strip()
    m = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})", t)
    if m: return f"{m[1]}-{int(m[2]):02d}-{int(m[3]):02d}"
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", t)
    if m: return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    return None

def num(v):
    if v is None: return None
    if isinstance(v, (int, float)): return v if abs(v) < 1e12 else None
    t = re.sub(r"[^0-9.\-]", "", str(v))
    try: return float(t) if t not in ("", "-", ".") else None
    except: return None

PHONE = re.compile(r"(\+?\d[\d\s().\-]{6,}\d)")
def split_customer(raw):
    s = s0(raw)
    if not s: return (None, None, None)
    lines = [l.strip() for l in re.split(r"\r?\n", str(raw)) if l.strip()]
    name = phone = None; addr = []
    for i, line in enumerate(lines):
        pm = PHONE.search(line)
        if i == 0:
            parts = re.split(r"\s[-–]\s", line)
            if len(parts) > 1 and PHONE.search(parts[-1]):
                name = " - ".join(parts[:-1]).strip()
                phone = PHONE.search(parts[-1]).group(1)
            elif pm and len(PHONE.sub("", line).strip()) < 3:
                phone = pm.group(1)
            else:
                name = line
        elif pm and not phone:
            phone = pm.group(1)
            left = PHONE.sub("", line).strip()
            if left: addr.append(left)
        else:
            addr.append(line)
    return (name, phone.strip() if phone else None, ", ".join(addr) if addr else None)

def item_status(tracking, order_ffm, pushed, carrier, confirm, label, design, note, ts_text):
    ts = (ts_text or "").lower()
    track = "none"
    if "return" in ts or "hoàn" in ts or "hoan" in ts: track = "returned"
    elif "deliver" in ts: track = "delivered"
    elif "transit" in ts or "shipped" in ts: track = "in_transit"
    n = (note or "").lower()
    if "cancel" in n or "hủy" in n or "huy" in n or "refund" in n: return ("cancelled", track)
    if track == "delivered": return ("delivered", track)
    if tracking: return ("has_tracking", track if track != "none" else "in_transit")
    if pushed and carrier: return ("in_production", track)
    if order_ffm: return ("ordered", track)
    if confirm and label: return ("design_ok", track)
    if design or confirm: return ("waiting_design", track)
    return ("new", track)

# ------------------------------------------------------------------
# 1) ĐỌC ĐƠN
# ------------------------------------------------------------------
wb = openpyxl.load_workbook(RSA, data_only=True, read_only=True)
ws = wb["Tổng hợp đơn"]
rows = list(ws.iter_rows(min_row=2, values_only=True))
wb.close()

C = dict(date=0, oid=1, plat=2, acc=3, ship=4, label=5, fee=6, seller=7, snote=8,
         cust=9, tpl=10, ptype=11, facauto=12, dim=13, phoi=14, size=15, color=16,
         qty=17, linksp=18, listing=19, dsdate=20, odesign=21, fdesign=22, confirm=23,
         xuong=24, carrier=25, pushed=26, offm=27, track=28, deadline=29, cont=30,
         tstat=31, lastup=32, shipcost=33, itemcost=34, total=35, note=36)

def cell(r, k):
    i = C[k]
    return r[i] if i < len(r) else None

orders = {}   # order_key -> dict
order_seq = []
selling = set()
factories = set()

for r in rows:
    oid = s0(cell(r, "oid")).strip()
    if not oid or re.search(r"grand\s*total|tổng", oid, re.I): continue
    plat = s0(cell(r, "plat")).upper()
    if plat not in ("TTS", "AMZ"):
        plat = "AMZ" if re.match(r"^\d{3}-\d{7}-\d{7}$", oid) else "TTS"
    okey = (plat, oid)

    acc = s0(cell(r, "acc"))
    if acc: selling.add((plat, acc))
    fac = s0(cell(r, "xuong")) or s0(cell(r, "facauto"))
    if fac: factories.add(fac)

    if okey not in orders:
        name, phone, addr = split_customer(cell(r, "cust"))
        sb = s0(cell(r, "ship")).lower()
        shipped = "tiktok_shipping" if "tiktok" in sb else ("seller_shipping" if "seller" in sb else ("tiktok_shipping" if plat == "TTS" else None))
        orders[okey] = dict(
            platform=plat, oid=oid, acc=acc or None, seller=s0(cell(r, "seller")) or None,
            date=dt(cell(r, "date")), shipped=shipped, label=s0(cell(r, "label")) or None,
            fee=num(cell(r, "fee")), track=s0(cell(r, "track")) or None,
            cname=name, cphone=phone, caddr=addr, snote=s0(cell(r, "snote")) or None, items=[])
        order_seq.append(okey)

    o = orders[okey]
    if not o["cname"]:
        name, phone, addr = split_customer(cell(r, "cust"))
        o["cname"], o["cphone"], o["caddr"] = name, phone, addr

    confirm = s0(cell(r, "confirm")) != ""
    tracking = s0(cell(r, "track")) or None
    offm = s0(cell(r, "offm")) or None
    pushed = dt(cell(r, "pushed"))
    carrier = s0(cell(r, "carrier")) or None
    design = s0(cell(r, "fdesign")) or None
    istatus, tstatus = item_status(tracking, offm, pushed, carrier, confirm,
                                    o["label"], design, s0(cell(r, "note")), s0(cell(r, "tstat")))
    o["items"].append(dict(
        line=len(o["items"]) + 1, title=(s0(cell(r, "listing")) or s0(cell(r, "tpl")) or None),
        tpl=s0(cell(r, "tpl")) or None, ptype=s0(cell(r, "ptype")) or None, factory=fac or None,
        dim=s0(cell(r, "dim")) or None, phoi=s0(cell(r, "phoi")) or None, size=s0(cell(r, "size")) or None,
        color=s0(cell(r, "color")) or None, qty=int(num(cell(r, "qty")) or 1),
        design=design, confirm=confirm, linksp=(s0(cell(r, "linksp")) or None),
        odesign=s0(cell(r, "odesign")) or None, offm=offm, track=tracking, tstatus=tstatus,
        istatus=istatus, carrier=carrier, pushed=pushed, deadline=dt(cell(r, "deadline")),
        itemcost=num(cell(r, "itemcost")), shipcost=num(cell(r, "shipcost")), note=s0(cell(r, "note")) or None))

# ------------------------------------------------------------------
# 2) ĐỌC TÀI CHÍNH (topup / hoàn / pink)
# ------------------------------------------------------------------
wt = openpyxl.load_workbook(TOP, data_only=True, read_only=True)
def read_rows(sheet, start=2):
    ws = wt[sheet]
    return [r for r in ws.iter_rows(min_row=start, values_only=True) if any(c is not None for c in r)]

topups = []
for r in read_rows("FFM"):
    # Tháng, Ngày TT, Số tiền, Đơn vị, Lý do, TT NH, Tên NH, Nhà cung cấp
    if not r[2]: continue
    fac = s0(r[7])
    if fac: factories.add(fac)
    topups.append(dict(month=s0(r[0]) or None, date=dt(r[1]), amount=num(r[2]),
                       cur=(s0(r[3]) or "USD"), reason=s0(r[4]) or None, bank=s0(r[6]) or None, factory=fac or None))
refunds = []
for r in read_rows("Hoàn tiền"):
    if not r[3]: continue
    fac = s0(r[2])
    if fac: factories.add(fac)
    refunds.append(dict(sent=dt(r[0]), recv=dt(r[1]), factory=fac or None, amount=num(r[3]),
                        acc=s0(r[4]) or None, bank=s0(r[5]) or None))
payments = []
for r in read_rows("Pink DS"):
    if not r[2]: continue
    payments.append(dict(month=s0(r[0]) or None, date=dt(r[1]), amount=num(r[2]),
                         cur=(s0(r[3]) or "VND"), supplier=s0(r[7]) or "Pink Design",
                         bank=s0(r[6]) or None, note=s0(r[4]) or None))
wt.close()

# ------------------------------------------------------------------
# 3) XUẤT SQL
# ------------------------------------------------------------------
BAD_FAC = {"?", "cancel", "x", "-", "n/a", "na", "0", "test"}
def valid_fac(n): return bool(n) and len(n) >= 2 and n.lower() not in BAD_FAC
def facsub(name): return f"(select id from factories where name={q(name)})" if valid_fac(name) else "null"
def accsub(plat, name): return f"(select id from selling_accounts where platform='{plat}' and name={q(name)})" if name else "null"

L = ["-- seed_data.sql — dữ liệu thật từ _private (sinh bởi scripts/gen_seed_data.py)",
     "-- Chạy SAU: 0001_init.sql, 0002_import_fields.sql, seed_templates.sql",
     "-- CHỨA THÔNG TIN KHÁCH HÀNG — KHÔNG commit (đã .gitignore).", "",
     "begin;", "",
     "-- 1) Xưởng & Tài khoản bán hàng"]
for f in sorted(factories):
    if valid_fac(f):
        L.append(f"insert into factories(name) values ({q(f)}) on conflict (name) do nothing;")
for plat, name in sorted(selling):
    L.append(f"insert into selling_accounts(platform,name) values ('{plat}',{q(name)}) on conflict (platform,name) do nothing;")

L += ["", f"-- 2) Đơn hàng ({len(order_seq)} đơn) + sản phẩm"]
for okey in order_seq:
    o = orders[okey]
    L.append(
        "insert into orders(platform,platform_order_id,order_date,shipped_by,label_link,label_fee,"
        "tracking_number,customer_name,customer_contact,customer_address,seller_note,seller_name_import,"
        "selling_account_id,import_source,platform_status) values ("
        f"'{o['platform']}',{q(o['oid'])},{q(o['date'])},"
        f"{q(o['shipped']) if o['shipped'] else 'null'},{q(o['label'])},{o['fee'] if o['fee'] is not None else 'null'},"
        f"{q(o['track'])},{q(o['cname'])},{q(o['cphone'])},{qmulti(o['caddr'])},{qmulti(o['snote'])},{q(o['seller'])},"
        f"{accsub(o['platform'], o['acc'])},'rsa_ffm',null) on conflict (platform,platform_order_id) do nothing;")
    for it in o["items"]:
        L.append(
            "insert into order_items(order_id,source_line,product_title,template_code,product_type,factory_id,"
            "dimension,sku_phoi,skus_raw,size,color,quantity,design_link,confirm_design,listing_link,"
            "order_design_code,factory_order_id,tracking_number,tracking_status,item_status,carrier,pushed_at,"
            "deadline_ship,fulfillment_cost,shipping_cost,note,import_source) select o.id,"
            f"{it['line']},{q(it['title'])},{q(it['tpl'])},{q(it['ptype'])},{facsub(it['factory'])},"
            f"{q(it['dim'])},{q(it['phoi'])},{q(it['phoi'])},{q(it['size'])},{q(it['color'])},{it['qty']},"
            f"{q(it['design'])},{str(it['confirm']).lower()},{q(it['linksp'])},{q(it['odesign'])},{q(it['offm'])},"
            f"{q(it['track'])},'{it['tstatus']}','{it['istatus']}',{q(it['carrier'])},{q(it['pushed'])},"
            f"{q(it['deadline'])},{it['itemcost'] if it['itemcost'] is not None else 'null'},"
            f"{it['shipcost'] if it['shipcost'] is not None else 'null'},{qmulti(it['note'])},'rsa_ffm' "
            f"from orders o where o.platform='{o['platform']}' and o.platform_order_id={q(o['oid'])} "
            "on conflict (order_id,source_line) do nothing;")

# tài chính — bọc DO block: CHỈ nạp khi bảng còn rỗng (idempotent kể cả chạy lại nhiều lần)
def do_block(table, inserts):
    return ([f"do $$ begin if not exists (select 1 from {table}) then"] + inserts + ["end if; end $$;"]) if inserts else []

top_ins = [
    f"  insert into topups(paid_date,amount,currency,factory_id,bank,reason,month_label) "
    f"values ({q(t['date'])},{t['amount']},'{t['cur']}',{facsub(t['factory'])},{q(t['bank'])},{q(t['reason'])},{q(t['month'])});"
    for t in topups if t["amount"] is not None and t["date"]]
L += ["", f"-- 3) Topup ({len(top_ins)}) — chỉ nạp khi topups rỗng"] + do_block("topups", top_ins)

ref_ins = [
    f"  insert into refunds(sent_date,received_date,factory_id,amount,currency,receive_account,bank) "
    f"values ({q(t['sent'])},{q(t['recv'])},{facsub(t['factory'])},{t['amount']},'USD',{q(t['acc'])},{q(t['bank'])});"
    for t in refunds if t["amount"] is not None]
L += ["", f"-- 4) Hoàn tiền ({len(ref_ins)}) — chỉ nạp khi refunds rỗng"] + do_block("refunds", ref_ins)

pay_ins = [
    f"  insert into payments(paid_date,amount,currency,category,supplier,bank,content_note,month_label) "
    f"values ({q(t['date'])},{t['amount']},'{t['cur']}','design',{q(t['supplier'])},{q(t['bank'])},{q(t['note'])},{q(t['month'])});"
    for t in payments if t["amount"] is not None and t["date"]]
L += ["", f"-- 5) Thanh toán khác / Pink Design ({len(pay_ins)}) — chỉ nạp khi payments rỗng"] + do_block("payments", pay_ins)

L += ["", "commit;"]

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")

nitems = sum(len(o["items"]) for o in orders.values())
print("Đã ghi", OUT)
print(f"  Đơn: {len(order_seq)} · Sản phẩm: {nitems} · TK bán: {len(selling)} · Xưởng: {len(factories)}")
print(f"  Topup: {len(topups)} · Hoàn: {len(refunds)} · Pink DS: {len(payments)}")
