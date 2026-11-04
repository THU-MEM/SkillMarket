#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_atoms.py — 原子数据质量校验

检查项:
  - 对应案例 / 对应习题 不得残留“待补充”
  - 对应案例必须含【来源：或【AI生成】标注
  - 对应习题1/2 必须以【AI生成】结尾
  - 不得出现标点误接（。， 或 ，。）
  - 老师认定盖戳必须为空
  - 案例长度建议 >= 120 字

用法:
  python validate_atoms.py <atoms.json>
"""
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write("用法: python validate_atoms.py <atoms.json>\n")
        sys.exit(1)
    rows = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    bad = []
    src = ai = 0
    lens = []
    for i, r in enumerate(rows, 1):
        c = r.get("对应案例", "")
        lens.append(len(c))
        if "。，" in c or "，。" in c:
            bad.append((i, "标点误接"))
        if "【来源：" in c:
            src += 1
        elif c.endswith("【AI生成】"):
            ai += 1
        else:
            bad.append((i, "案例缺少标注"))
        for k in ("对应习题1", "对应习题2"):
            if not r.get(k, "").endswith("【AI生成】"):
                bad.append((i, k + "缺AI标注"))
        if "待补充" in (c, r.get("对应习题1", ""), r.get("对应习题2", "")):
            bad.append((i, "残留待补充"))
        if r.get("老师认定盖戳", "") != "":
            bad.append((i, "盖戳非空"))
    print(f"总数 {len(rows)} | 来源标注 {src} | AI生成 {ai}")
    print(f"最短案例 {min(lens)} | 最长案例 {max(lens)}")
    print(f"异常总数 {len(bad)}")
    for b in bad[:30]:
        print("  -", b)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
