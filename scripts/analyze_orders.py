# -*- coding: utf-8 -*-
"""
Phân tích file export đơn TikTok Shop (Cotik) -> phục vụ mapping vào schema web (Supabase).

Chạy:  python scripts/analyze_orders.py [duong_dan.csv]
Mặc định đọc: orders_02-07-2026.csv ở gốc dự án.

Mục tiêu: KHẢO SÁT dữ liệu thật để chốt cách đưa vào 2 bảng orders / order_items:
  - Độ phủ (fill rate) từng cột -> cột nào có dữ liệu, cột nào bỏ.
  - order_id có bị lặp dòng không (1 đơn nhiều item?).
  - Tách selling_account (shop_note) + seller nội bộ (email_member).
  - Chuẩn hoá status sàn, phân tích quan hệ status x tracking/label.
  - Bóc cột `skus` (SKU + size + lời nhắn cá nhân hoá bị nhét chung).
  - Soi `price`/`est`, tracking, ngày tạo.
Script CHỈ đọc + in báo cáo, KHÔNG sửa file gốc.
"""
import csv
import io
import os
import re
import sys
from collections import Counter, defaultdict

# Console Windows mặc định cp1252 -> ép UTF-8 để in được tiếng Việt.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

CSV_DEFAULT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "orders_02-07-2026.csv")

# csv có ô rất dài (danh sách URL ảnh) -> nới giới hạn field.
csv.field_size_limit(10 * 1024 * 1024)


def clean(v):
    """Bỏ prefix ' (Excel text-guard) + trim. '  -> chuỗi rỗng."""
    if v is None:
        return ""
    v = v.strip()
    if v.startswith("'"):
        v = v[1:].strip()
    return v


def load(path):
    with io.open(path, "r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    return rows


def bar(pct, width=24):
    n = int(round(pct / 100 * width))
    return "#" * n + "-" * (width - n)


def sample_vals(rows, col, k=4, maxlen=60):
    out = []
    for r in rows:
        v = clean(r.get(col, ""))
        if v:
            v = v if len(v) <= maxlen else v[:maxlen] + "…"
            if v not in out:
                out.append(v)
        if len(out) >= k:
            break
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else CSV_DEFAULT
    if not os.path.exists(path):
        print("KHÔNG thấy file:", path)
        sys.exit(1)

    rows = load(path)
    n = len(rows)
    cols = list(rows[0].keys()) if rows else []
    print("=" * 78)
    print("FILE :", os.path.basename(path))
    print("Số dòng dữ liệu :", n, "| Số cột :", len(cols))
    print("=" * 78)

    # ---------- 1. Độ phủ từng cột ----------
    print("\n[1] ĐỘ PHỦ TỪNG CỘT (fill rate) — cột nào có dữ liệu thật")
    print("-" * 78)
    fill = {}
    for c in cols:
        cnt = sum(1 for r in rows if clean(r.get(c, "")))
        fill[c] = cnt
        pct = cnt / n * 100 if n else 0
        distinct = len({clean(r.get(c, "")) for r in rows if clean(r.get(c, ""))})
        ex = sample_vals(rows, c, k=2, maxlen=42)
        print("  {:<15} {:>5}/{:<4} {:>5.1f}% |{}| distinct={:<5} vd: {}"
              .format(c[:15], cnt, n, pct, bar(pct), distinct, " · ".join(ex)))

    # ---------- 2. order_id: có lặp dòng không ----------
    print("\n[2] ORDER_ID — 1 đơn = 1 dòng hay lặp dòng (nhiều item)?")
    print("-" * 78)
    ids = [clean(r.get("id", "")) for r in rows]
    id_counts = Counter(i for i in ids if i)
    dup = {i: c for i, c in id_counts.items() if c > 1}
    print("  Tổng dòng có id      :", sum(1 for i in ids if i))
    print("  Số order_id KHÁC nhau:", len(id_counts))
    print("  order_id bị LẶP dòng :", len(dup))
    if dup:
        for i, c in list(dup.items())[:5]:
            print("     - {} xuất hiện {} dòng".format(i, c))
    # kiểm tra prefix ' còn sót
    raw_prefix = sum(1 for r in rows if str(r.get("id", "")).strip().startswith("'"))
    print("  (id có prefix ' cần bỏ khi import: {} dòng)".format(raw_prefix))

    # ---------- 3. status sàn ----------
    print("\n[3] STATUS (trạng thái sàn) — value counts")
    print("-" * 78)
    st = Counter(clean(r.get("status", "")) or "(rỗng)" for r in rows)
    for v, c in st.most_common():
        print("  {:<24} {:>5}  ({:>4.1f}%)".format(v, c, c / n * 100))

    # quan hệ status x tracking x label
    print("\n  → status × đã-có-tracking × đã-có-label:")
    combo = defaultdict(lambda: [0, 0, 0])  # status -> [tổng, có tracking, có label]
    for r in rows:
        s = clean(r.get("status", "")) or "(rỗng)"
        combo[s][0] += 1
        if clean(r.get("tracking_number", "")):
            combo[s][1] += 1
        if clean(r.get("label", "")):
            combo[s][2] += 1
    for s, (tot, trk, lbl) in sorted(combo.items(), key=lambda x: -x[1][0]):
        print("    {:<24} n={:<5} có_tracking={:<5} có_label={:<5}".format(s, tot, trk, lbl))

    # ---------- 4. shop_note -> selling_account + email ----------
    print("\n[4] SHOP_NOTE → tách TÀI KHOẢN BÁN HÀNG (selling_accounts) + email")
    print("-" * 78)
    acc = Counter()
    acc_bad = []
    for r in rows:
        v = clean(r.get("shop_note", ""))
        if not v:
            acc["(rỗng)"] += 1
            continue
        # dạng: "TTS43 - IvakeRiou@gmail.com"
        m = re.match(r"^\s*([A-Za-z]+\s*\d+)\s*-\s*(.+?)\s*$", v)
        if m:
            code = re.sub(r"\s+", "", m.group(1)).upper()
            acc[code] += 1
            if not re.match(r"^TTS\d+$", code):   # lệch chuẩn TTSxx
                acc_bad.append((code, v))
        else:
            acc["(không parse được)"] += 1
            acc_bad.append(("?", v))
    print("  Số tài khoản bán hàng distinct:", len([k for k in acc if k not in ("(rỗng)", "(không parse được)")]))
    for v, c in acc.most_common(30):
        flag = "" if re.match(r"^TTS\d+$", v) or v in ("(rỗng)", "(không parse được)") else "  <-- lệch chuẩn?"
        print("  {:<22} {:>5}{}".format(v, c, flag))
    if acc_bad:
        print("  ! Giá trị cần chuẩn hoá (sample):")
        for code, raw in acc_bad[:8]:
            print("     [{}] {}".format(code, raw[:60]))

    # ---------- 5. email_member -> seller nội bộ ----------
    print("\n[5] EMAIL_MEMBER → SELLER nội bộ (map profiles)")
    print("-" * 78)
    seller = Counter()
    for r in rows:
        v = clean(r.get("email_member", ""))
        if not v:
            seller["(chưa gán seller)"] += 1
            continue
        # dạng: "tudda21@iart.group - Tú"
        m = re.match(r"^\s*(\S+@\S+)\s*-\s*(.+?)\s*$", v)
        if m:
            seller[m.group(2).strip()] += 1
        else:
            seller[v] += 1
    for v, c in seller.most_common():
        print("  {:<24} {:>5}  ({:>4.1f}%)".format(v, c, c / n * 100))

    # ---------- 6. skus: SKU + size + personalization ----------
    print("\n[6] SKUS — bóc SKU / size / lời nhắn cá nhân hoá (đang bị nhét chung)")
    print("-" * 78)
    size_pat = re.compile(r"^(X\d?S|X+L|S|M|L|XL|2XL|3XL|4XL|5XL|\d?XL|S\d+|One Size)$", re.I)
    has_comma = 0
    size_last = Counter()
    empty_sku = 0
    long_note = 0
    for r in rows:
        v = clean(r.get("skus", ""))
        if not v:
            empty_sku += 1
            continue
        parts = [p.strip() for p in v.split(",") if p.strip()]
        if len(parts) > 1:
            has_comma += 1
        last = parts[-1] if parts else ""
        if size_pat.match(last):
            size_last[last.upper()] += 1
        else:
            size_last["(không rõ size)"] += 1
        if len(v) > 40:
            long_note += 1
    print("  skus rỗng                         :", empty_sku)
    print("  skus có >1 phần (ngăn bởi dấu ',') :", has_comma)
    print("  skus dài >40 ký tự (kèm lời nhắn)  :", long_note)
    print("  Suy đoán SIZE (phần tử cuối):")
    for v, c in size_last.most_common(12):
        print("     {:<16} {:>5}".format(v, c))

    # ---------- 7. quantity / total_item ----------
    print("\n[7] QUANTITY & TOTAL_ITEM")
    print("-" * 78)
    for col in ("total_item", "quantity"):
        cc = Counter(clean(r.get(col, "")) or "(rỗng)" for r in rows)
        top = " · ".join("{}={}".format(k, v) for k, v in cc.most_common(8))
        print("  {:<12}: {}".format(col, top))

    # ---------- 8. price / est ----------
    print("\n[8] PRICE / EST (giá) — nằm NGOÀI scope FFM, chỉ soi để hiểu")
    print("-" * 78)
    for col in ("price", "est"):
        vals = []
        for r in rows:
            v = clean(r.get(col, ""))
            try:
                vals.append(float(v))
            except ValueError:
                pass
        if vals:
            vals.sort()
            print("  {:<6}: n={} min={:.2f} median={:.2f} max={:.2f}"
                  .format(col, len(vals), vals[0], vals[len(vals) // 2], vals[-1]))
    # so sánh price vs est
    both = pg = 0
    for r in rows:
        try:
            p = float(clean(r.get("price", "")))
            e = float(clean(r.get("est", "")))
        except ValueError:
            continue
        both += 1
        if p > e:
            pg += 1
    if both:
        print("  So khớp {} đơn: price > est ở {} đơn ({:.0f}%)".format(both, pg, pg / both * 100))

    # ---------- 9. design/mockup ----------
    print("\n[9] DESIGN_* / MOCKUP_* — mức độ có dữ liệu")
    print("-" * 78)
    for c in cols:
        if c.startswith(("design_", "mockup_", "main_images", "image")):
            cnt = fill[c]
            print("  {:<16} {:>5}/{} ({:.1f}%)".format(c, cnt, n, cnt / n * 100))

    # ---------- 10. create_time ----------
    print("\n[10] CREATE_TIME — khoảng thời gian")
    print("-" * 78)
    times = [clean(r.get("create_time", "")) for r in rows if clean(r.get("create_time", ""))]
    if times:
        ts = sorted(times)
        print("  n =", len(times))
        print("  sớm nhất :", ts[0])
        print("  muộn nhất:", ts[-1])
        print("  (định dạng dd-mm-yyyy HH:MM:SS)")

    # ---------- 11. Tổng kết mapping ----------
    print("\n" + "=" * 78)
    print("[11] ĐỀ XUẤT MAPPING CSV → SCHEMA (dựa trên fill rate ở trên)")
    print("=" * 78)
    mapping = [
        ("id",             "orders.platform_order_id (bỏ prefix ', platform='TTS')"),
        ("status",         "orders.platform_status"),
        ("shop_note",      "→ selling_accounts.name (TTSxx) + factory/email đăng nhập TTS"),
        ("email_member",   "→ orders.seller_id (map profiles theo tên: Tú, Chi…)"),
        ("shop_name",      "orders.customer_contact? (username người MUA, KHÔNG phải shop)"),
        ("name",           "orders.customer_name"),
        ("address",        "orders.customer_address (nên tách city/state/zip/country)"),
        ("phone",          "orders.customer_contact (sđt)"),
        ("buyer_note",     "orders.buyer_note"),
        ("label",          "orders.label_link ; có label ⇒ shipped_by='tiktok_shipping'"),
        ("tracking_number","orders.tracking_number (cấp đơn)"),
        ("create_time",    "orders.order_date"),
        ("title",          "order_items → template/title (mô tả sản phẩm)"),
        ("skus",           "order_items.sku_phoi + size + note (CẦN BÓC TÁCH)"),
        ("quantity",       "order_items.quantity"),
        ("seller_sku",     "order_items.factory_order_id? / seller_sku"),
        ("design_*",       "order_items.design_link (gần như trống ⇒ seller sẽ nhập)"),
        ("mockup_*",       "(tham khảo, thường trống)"),
        ("price / est",    "BỎ khỏi MVP (ngoài scope doanh thu FFM)"),
    ]
    for a, b in mapping:
        print("  {:<16} → {}".format(a, b))

    print("\n  Ghi chú: mỗi dòng CSV = 1 đơn 1 sản phẩm ⇒ tạo 1 orders + 1 order_items.")
    print("  Nếu [2] báo order_id KHÔNG lặp ⇒ khớp giả định '1 order_id = 1 đơn'.")
    print("=" * 78)


if __name__ == "__main__":
    main()
