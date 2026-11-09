#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prepare_sheet.py — 由 atoms.json + field-schema.json 生成双页 Excel 的写入数据

产物:
  1) results.csv        拆分结果页（15 列，逐行原子记录）
  2) instructions.csv   填写说明页（说明类别/说明项/说明内容）
  3) write_results.json     本地表格编辑 edsdk 写参（拆分结果）
  4) write_instructions.json 本地表格编辑 edsdk 写参（填写说明）

用法:
  python prepare_sheet.py <atoms.json> <field-schema.json> <输出目录> [<xlsx绝对路径>]

<xlsx绝对路径> 用于生成 edsdk 写参中的 file_id；不传则跳过写参生成。
说明内容中的 {main_title} 占位符会用配置中的 main_title 自动替换。
"""
import csv
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 4:
        sys.stderr.write(
            "用法: python prepare_sheet.py <atoms.json> <field-schema.json> <输出目录> [<xlsx绝对路径>]\n"
        )
        sys.exit(1)
    atoms_path = Path(sys.argv[1])
    cfg_path = Path(sys.argv[2])
    out_dir = Path(sys.argv[3])
    xlsx_path = Path(sys.argv[4]) if len(sys.argv) > 4 else None
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = json.loads(atoms_path.read_text(encoding="utf-8"))
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    main_title = cfg.get("main_title", "课程")
    headers = cfg["header_order"]

    # 1) 拆分结果 CSV
    results_csv = out_dir / "results.csv"
    with results_csv.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(headers)
        for r in rows:
            w.writerow([r.get(h, "") for h in headers])

    # 2) 填写说明 CSV（替换占位符）
    instructions_csv = out_dir / "instructions.csv"
    with instructions_csv.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["说明类别", "说明项", "说明内容"])
        for cat, item, content in cfg["instructions"]:
            w.writerow([cat, item, content.replace("{main_title}", main_title)])

    # 3) edsdk 写参（可选）
    if xlsx_path:
        for stem, sid, csvname in [
            ("write_results", "000001", "results.csv"),
            ("write_instructions", "000002", "instructions.csv"),
        ]:
            obj = {
                "file_id": str(xlsx_path),
                "sheet_id": sid,
                "start_row": 0,
                "start_col": 0,
                "csv_data": (out_dir / csvname).read_text(encoding="utf-8-sig"),
            }
            (out_dir / f"{stem}.json").write_text(
                json.dumps(obj, ensure_ascii=False), encoding="utf-8"
            )

    print(f"拆分结果行数: {len(rows)}")
    print(f"填写说明条数: {len(cfg['instructions'])}")
    print(f"输出目录: {out_dir}")


if __name__ == "__main__":
    main()
