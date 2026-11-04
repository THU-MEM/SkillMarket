#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
from_pdf_to_kb.py — 一键从 PDF 生成八表教学知识基座 Excel（端到端，单命令）

串联:
  1. extract_courseware.py  -> <stem>.pages.json   （按页提取，供原文证据回填）
  2. split_pdf_to_atoms.py  -> <stem>.atoms.json   （启发式原子拆分首稿）
  3. build_knowledge_base.py-> 八表 xlsx            （原始归档/原子知识点/知识关系/
                                                    案例与项目/案例知识映射/教学评价/
                                                    审核与学习证据/填写说明）
  4. validate_knowledge_base.py -> 结构校验

用法:
  # 任意课程，零配置（自动推断关系与认知标签）
  python from_pdf_to_kb.py --pdf 课件.pdf --out 知识基座.xlsx

  # 已配置课程（如战略管理），使用专属领域配置得到更贴合的标签与关系
  python from_pdf_to_kb.py --pdf 课件.pdf --out 知识基座.xlsx \
      --config references/strategic-management-kb-config.json

  # 保留中间产物（atoms.json / pages.json）便于人工精修
  python from_pdf_to_kb.py --pdf 课件.pdf --out 知识基座.xlsx --keep

说明:
  - 原子拆分是确定性规则首稿，所有内容标注 AI候选 / 待教师确认；教师可在
    导出的 atoms.json 上精修后，用 build_knowledge_base.py 单独重跑 Step 8。
  - 已有高质量 atoms.json 时，可跳过本脚本，直接调用 build_knowledge_base.py。
"""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(py, script, *cli_args):
    cmd = [py, str(HERE / script), *cli_args]
    print(f"\n[step] {script} {' '.join(cli_args)}")
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser(description="一键从 PDF 生成八表教学知识基座 Excel")
    ap.add_argument("--pdf", required=True, help="课件 PDF 路径")
    ap.add_argument("--out", required=True, help="输出八表 xlsx 路径")
    ap.add_argument("--config", default=None, help="领域配置文件（可选；不传则通用模式）")
    ap.add_argument("--work-dir", default=None, help="中间产物目录，默认与 --out 同目录")
    ap.add_argument("--keep", action="store_true", help="保留中间产物 atoms.json / pages.json")
    ap.add_argument("--no-projects", action="store_true", help="拆分时不抽取具体项目条目（默认抽取，以填满项目表）")
    ap.add_argument("--refine", action="store_true",
                    help="拆分后调用大模型精修首稿（需配置 KB_LLM_API_KEY；无密钥则自动跳过，保留首稿）")
    args = ap.parse_args()

    py = sys.executable
    pdf = Path(args.pdf)
    if not pdf.exists():
        sys.stderr.write(f"PDF 不存在: {pdf}\n")
        sys.exit(1)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    work = Path(args.work_dir) if args.work_dir else out.parent
    work.mkdir(parents=True, exist_ok=True)
    stem = pdf.stem

    pages_json = work / f"{stem}.pages.json"
    atoms_json = work / f"{stem}.atoms.json"

    # 1) 提取
    run(py, "extract_courseware.py", str(pdf), str(pages_json))

    # 2) 拆分
    split_args = ["--pdf", str(pdf), "--out", str(atoms_json)]
    if not args.no_projects:
        split_args.append("--keep-projects")
    run(py, "split_pdf_to_atoms.py", *split_args)

    # 2.5) 可选：大模型精修（无密钥/失败时自动保留首稿，不中断）
    if args.refine:
        run(py, "refine_atoms.py", "--atoms", str(atoms_json),
            "--pdf-dir", str(work), "--out", str(atoms_json))

    # 3) 构建八表
    build_args = ["--atoms", str(atoms_json), "--pdf-dir", str(work), "--out", str(out)]
    if args.config:
        build_args += ["--config", args.config]
    run(py, "build_knowledge_base.py", *build_args)

    # 4) 校验
    run(py, "validate_knowledge_base.py", str(out))

    if not args.keep:
        pages_json.unlink(missing_ok=True)
        atoms_json.unlink(missing_ok=True)
        print(f"\n[clean] 已清理中间产物（如需精修请加 --keep）")

    print(f"\n[done] 知识基座生成完成: {out}")


if __name__ == "__main__":
    main()
