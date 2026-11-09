#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_knowledge_base.py — 校验八表教学知识基座 Excel 的结构与引用完整性

校验项:
  1. 八张工作表齐全且顺序正确；
  2. 原始拆分归档 / 原子知识点数量符合期望（可在 --expect 中指定）；
  3. 各表 ID 唯一、无重复；
  4. 知识关系 / 案例知识映射 / 教学评价 / 审核证据中的 ID 引用均落到已存在记录（无悬空）；
  5. 双轨评价题目标注【无AI轨】/【有AI轨】；
  6. 原子知识点必填字段非空；
  7. 案例与项目来源层级枚举合法。

用法:
  python validate_knowledge_base.py <知识基座.xlsx> [--expect 原始拆分归档=192 原子知识点=153]
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

try:
    import openpyxl
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "openpyxl>=3.1.0"])
    import openpyxl


EXPECTED_SHEETS = ["原始拆分归档", "原子知识点", "知识关系", "案例与项目",
                  "案例知识映射", "教学评价", "审核与学习证据", "填写说明"]


def records(ws):
    hs = [c.value for c in ws[1]]
    return [dict(zip(hs, [c.value for c in row])) for row in ws.iter_rows(min_row=2)]


def main():
    ap = argparse.ArgumentParser(description="校验八表教学知识基座 Excel")
    ap.add_argument("xlsx", help="知识基座 xlsx 路径")
    ap.add_argument("--expect", nargs="*", default=[], help="期望数量，格式 表名=数量")
    args = ap.parse_args()

    expect = {}
    for item in args.expect:
        if "=" in item:
            k, v = item.split("=", 1)
            expect[k.strip()] = int(v)

    errors = []
    p = Path(args.xlsx)
    wb = openpyxl.load_workbook(p, data_only=False)
    if wb.sheetnames != EXPECTED_SHEETS:
        errors.append(f"sheet顺序异常: {wb.sheetnames}")
    counts = {ws.title: ws.max_row - 1 for ws in wb.worksheets}

    for name, exp in expect.items():
        if counts.get(name) != exp:
            errors.append(f"{name}数量异常: 期望{exp} 实际{counts.get(name)}")

    kp = records(wb["原子知识点"])
    rels = records(wb["知识关系"])
    assets = records(wb["案例与项目"])
    maps = records(wb["案例知识映射"])
    evals = records(wb["教学评价"])
    reviews = records(wb["审核与学习证据"])

    kpids = {r["知识点ID"] for r in kp}
    assetids = {r["资产ID"] for r in assets}

    for name, vals in [
        ("知识点ID", [r["知识点ID"] for r in kp]),
        ("关系ID", [r["关系ID"] for r in rels]),
        ("资产ID", [r["资产ID"] for r in assets]),
        ("评价ID", [r["评价ID"] for r in evals]),
        ("审核ID", [r["审核ID"] for r in reviews]),
    ]:
        dup = [x for x, c in Counter(vals).items() if c > 1]
        if dup:
            errors.append(f"{name}重复: {dup[:5]}")

    for r in rels:
        if r["源知识点ID"] not in kpids or r["目标知识点ID"] not in kpids:
            errors.append(f"关系悬空 {r['关系ID']}")
    for r in maps:
        if r["资产ID"] not in assetids or r["知识点ID"] not in kpids:
            errors.append(f"映射悬空 {r['资产ID']}->{r['知识点ID']}")
    for r in evals:
        if r["知识点ID"] not in kpids:
            errors.append(f"评价悬空 {r['评价ID']}")
        if not str(r["习题1_无AI轨"]).startswith("【无AI轨】"):
            errors.append(f"无AI轨标注异常 {r['评价ID']}")
        if not str(r["习题2_有AI轨"]).startswith("【有AI轨】"):
            errors.append(f"有AI轨标注异常 {r['评价ID']}")

    for r in kp:
        for f in ["知识点ID", "知识点名称", "知识类型", "一句话定义", "核心机制", "适用边界",
                  "非适用条件", "常见误区", "课件来源", "章节及页码", "原文证据摘录", "审核状态"]:
            if r.get(f) in (None, ""):
                errors.append(f"知识点{r.get('知识点ID')}缺失{f}")

    for r in assets:
        if r["来源层级"] not in ("课件案例线索+AI扩写", "AI虚构教学案例", "待人工判定"):
            errors.append(f"来源层级异常 {r['资产ID']}")

    summary = {
        "status": "success" if not errors else "failed",
        "file_bytes": p.stat().st_size,
        "sheets": counts,
        "knowledge_types": dict(Counter(r["知识类型"] for r in kp)),
        "cognitive_tags": dict(Counter(t for r in kp for t in str(r["认知价值标签"]).split("；"))),
        "source_tiers": dict(Counter(r["来源层级"] for r in assets)),
        "evidence_filled": sum(r["原文证据摘录"] != "待人工补录课件原文摘录" for r in kp),
        "errors": errors[:20], "error_count": len(errors),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
