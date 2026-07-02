# -*- coding: utf-8 -*-
"""Sinh supabase/seed_templates.sql từ sheet 'Template Design' của RSA-FFM.xlsx.
Chạy 1 lần: python scripts/gen_template_seed.py  -> nạp file .sql vào Supabase SQL Editor.
"""
import sys, re, openpyxl
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

SRC = r"d:\AI\Tool FFM\_private\RSA - FFM.xlsx"
OUT = r"d:\AI\Tool FFM\supabase\seed_templates.sql"

def q(v):
    """SQL literal: None/'' -> NULL, còn lại escape nháy đơn."""
    if v is None: return "null"
    s = " ".join(str(v).split()).strip()
    if s == "" or s == "0": return "null"
    return "'" + s.replace("'", "''") + "'"

def code_of(name):
    if not name: return None
    m = re.match(r"^\s*([0-9]+)\s*_", str(name))
    return m.group(1) if m else None

wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
ws = wb["Template Design"]
rows = list(ws.iter_rows(min_row=2, values_only=True))
wb.close()

factories, templates = set(), []
for r in rows:
    if not r or len(r) < 5: continue
    _, name, factory, ptype, dim = r[0], r[1], r[2], r[3], r[4]
    link = r[5] if len(r) > 5 else None
    if not name or not str(name).strip(): continue
    code = code_of(name)
    if factory and str(factory).strip() not in ("", "0"):
        factories.add(" ".join(str(factory).split()).strip())
    templates.append((code, name, factory, ptype, dim, link))

lines = [
    "-- Seed Template Design (auto-fill) — sinh bởi scripts/gen_template_seed.py",
    "-- Chạy SAU 0001_init.sql & 0002_import_fields.sql. An toàn chạy lại (upsert).",
    "",
    "-- 1) Xưởng xuất hiện trong Template Design",
]
for f in sorted(factories):
    lines.append(f"insert into factories (name) values ({q(f)}) on conflict (name) do nothing;")

lines += ["", "-- 2) Template (auto-fill product_type / factory / dimension khi seller chọn)"]
for code, name, factory, ptype, dim, link in templates:
    fac_sub = f"(select id from factories where name={q(factory)})" if q(factory) != "null" else "null"
    lines.append(
        "insert into templates (code, name, product_type, dimension, template_link, factory_id) values "
        f"({q(code)}, {q(name)}, {q(ptype)}, {q(dim)}, {q(link)}, {fac_sub}) "
        "on conflict (code) do update set name=excluded.name, product_type=excluded.product_type, "
        "dimension=excluded.dimension, template_link=excluded.template_link, factory_id=excluded.factory_id;"
    )

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"Đã ghi {OUT}")
print(f"  Xưởng: {len(factories)} · Template: {len(templates)}")
print("  Ví dụ code:", [code_of(t[1]) for t in templates[:5]])
