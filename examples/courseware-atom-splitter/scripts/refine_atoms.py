#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
refine_atoms.py — 可选的大模型精修步骤（将首稿 atoms.json 打磨为"精修"质量）

设计原则（与整个 skill 一致：零大模型依赖是底线）:
  - 仅当检测到可用的大模型端点（环境变量 KB_LLM_API_KEY 或命令行 --api-key）时才真正精修；
  - 任何异常（无网络/超时/鉴权失败/返回无法解析）都会**保留原首稿并告警**，绝不中断主流程；
  - 因此把它串进 from_pdf_to_kb.py 的 --refine 时，无密钥环境自动退化为"首稿八表"，有密钥环境得到"精修八表"。

打磨字段: 概念定义 / 概念解释 / 对应案例 / 对应习题1 / 对应习题2
约束: 保留知识点名称与章节结构；案例与习题必须落地到本课程真实语境；所有内容标注 AI候选 / 待教师确认。

环境变量（可选，优先级低于命令行参数）:
  KB_LLM_BASE_URL   默认 https://api.openai.com/v1
  KB_LLM_API_KEY    必填（不填则跳过精修）
  KB_LLM_MODEL      默认 gpt-4o-mini

依赖: openai (pip install openai)，未安装时仅告警跳过。
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

SYSTEM_PROMPT = (
    "你是高校课程知识工程的教研助手。下面会给你一条课程原子知识点（首稿），"
    "以及它在课件原文中的证据摘录。请把它打磨成可直接进入教学知识库的高质量内容：\n"
    "1) 概念定义：用一句准确、无歧义的话概括，避免同义复述；\n"
    "2) 概念解释：2-4 句，说明要点、适用条件与常见误区；\n"
    "3) 对应案例：写一个与本课程/本专业真实情境贴合的简短教学案例（不要泛泛而谈的占位句）；\n"
    "4) 对应习题1：理解型，要求学生解释机制并辨析一个误区；\n"
    "5) 对应习题2：应用型，要求学生用该知识分析或解决一个具体情境问题。\n"
    "只返回 JSON，结构为："
    '{"概念定义":str,"概念解释":str,"对应案例":str,"对应习题1":str,"对应习题2":str}'
    "，不要任何额外说明。案例与习题以【AI生成】开头，明确标注待教师确认。"
)

REFINE_FIELDS = ["概念定义", "概念解释", "对应案例", "对应习题1", "对应习题2"]


def load_page_docs(pdf_dir):
    docs = {}
    if not pdf_dir:
        return docs
    d = Path(pdf_dir)
    if not d.exists():
        return docs
    for j in d.glob("*.json"):
        try:
            data = json.loads(j.read_text(encoding="utf-8"))
            if isinstance(data, dict) and "pages" in data:
                docs[j.stem] = data
        except Exception:
            continue
    return docs


def evidence_for(atom, page_docs):
    files = [x.strip() for x in atom.get("课件来源", "").split("；") if x.strip()]
    locs = [x.strip() for x in atom.get("所在章节及页码", "").split("；") if x.strip()]
    terms = [atom.get("三级标题", ""), atom.get("二级标题", "")]
    out = []
    for idx, fname in enumerate(files):
        doc = page_docs.get(fname) or page_docs.get(Path(fname).stem)
        if not doc:
            continue
        loc = locs[idx] if idx < len(locs) else atom.get("所在章节及页码", "")
        m = re.search(r"第\s*(\d+)\s*页", loc)
        p = int(m.group(1)) if m else None
        if not p or not (1 <= p <= doc["page_count"]):
            continue
        text = re.sub(r"\s+", " ", doc["pages"][p - 1].get("text", "")).strip()
        if text:
            out.append(f"【课件原文证据】{fname} 第{p}页: {text[:400]}")
        if len(out) >= 1:
            break
    return "\n".join(out)


def build_user_prompt(atom, evidence):
    lines = [
        f"知识点名称: {atom.get('三级标题','')}",
        f"所属章节: {atom.get('二级标题','')} / {atom.get('一级标题','')}",
        f"当前定义(首稿): {atom.get('概念定义','')}",
        f"当前解释(首稿): {atom.get('概念解释','')[:200]}",
    ]
    if evidence:
        lines.append("")
        lines.append(evidence)
    lines.append("")
    lines.append("请按系统要求返回打磨后的 JSON。")
    return "\n".join(lines)


def refine(atoms, page_docs, client, model):
    ok, fail = 0, 0
    for i, atom in enumerate(atoms):
        if atom.get("条目类型") != "知识点":
            continue
        evidence = evidence_for(atom, page_docs)
        user = build_user_prompt(atom, evidence)
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
                max_tokens=900,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or ""
            data = json.loads(re.search(r"\{.*\}", content, re.S).group(0))
            changed = False
            for f in REFINE_FIELDS:
                if isinstance(data.get(f), str) and data[f].strip():
                    atom[f] = data[f].strip()
                    changed = True
            atom["老师认定盖戳"] = "AI候选/待教师确认"
            if changed:
                ok += 1
        except Exception as e:  # noqa: BLE001
            fail += 1
            if fail <= 3:
                sys.stderr.write(f"[warn] 精修第{i}条失败，保留首稿: {e}\n")
    return ok, fail


def main():
    ap = argparse.ArgumentParser(description="可选：用大模型把首稿 atoms 精修为高质量版本")
    ap.add_argument("--atoms", required=True, help="首稿 atoms.json")
    ap.add_argument("--out", default=None, help="输出路径，默认覆盖输入")
    ap.add_argument("--pdf-dir", default=None, help="含 <课件>.pages.json 的目录（用于原文证据）")
    ap.add_argument("--base-url", default=os.getenv("KB_LLM_BASE_URL", "https://api.openai.com/v1"))
    ap.add_argument("--api-key", default=os.getenv("KB_LLM_API_KEY"))
    ap.add_argument("--model", default=os.getenv("KB_LLM_MODEL", "gpt-4o-mini"))
    args = ap.parse_args()

    atoms = json.loads(Path(args.atoms).read_text(encoding="utf-8"))
    out_path = Path(args.out) if args.out else Path(args.atoms)

    if not args.api_key:
        sys.stderr.write("[info] 未检测到 KB_LLM_API_KEY，跳过精修（保留首稿）。\n")
        out_path.write_text(json.dumps(atoms, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    try:
        from openai import OpenAI
    except ImportError:
        sys.stderr.write("[warn] 未安装 openai，跳过精修（保留首稿）。pip install openai\n")
        out_path.write_text(json.dumps(atoms, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    try:
        client = OpenAI(base_url=args.base_url, api_key=args.api_key)
        page_docs = load_page_docs(args.pdf_dir)
        ok, fail = refine(atoms, page_docs, client, args.model)
        out_path.write_text(json.dumps(atoms, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"refined": ok, "failed_kept_draft": fail, "out": str(out_path)},
                         ensure_ascii=False, indent=2))
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"[warn] 精修调用异常，保留首稿: {e}\n")
        out_path.write_text(json.dumps(atoms, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
