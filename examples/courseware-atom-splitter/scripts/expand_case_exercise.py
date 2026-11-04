#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
expand_case_exercise.py — 将"对应案例/对应习题1/对应习题2"扩写为完整内容

规则（与 references/field-schema.json 中"案例与习题生成规则"一致）:
- 对应案例: 完整段落，含 主体/情境 → 关键决策或冲突 → 结果或影响 → 知识点映射。
    * 课件原有案例线索（对应案例 != 待补充）: 基于原案例名与解释扩写，文末标注
      【来源：<课件来源>；<所在章节及页码>】。
    * 课件未提供（对应案例 == 待补充）: 由 AI 生成教学示例，文末标注【AI生成】，
      并注明非课件原始案例、需教师认定。
- 对应习题1/习题2: 由 AI 生成，题型互补（习题1偏概念辨析/简答，习题2偏综合应用/
  案例分析），每题文末标注【AI生成】。

防重复: 若对应案例已含【来源：或【AI生成】标注，则视为已处理，跳过（避免二次扩写叠加）。

用法:
  python expand_case_exercise.py <atoms.json> <field-schema.json> [--check]

不带 --check 时就地改写 atoms.json 并输出校验摘要；带 --check 时只校验不写回。
"""
import json
import sys
from pathlib import Path


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def case_subject(row: dict) -> str | None:
    name = (row.get("对应案例") or "").strip()
    if name and name != "待补充":
        core = name.split("；")[0].split("、")[0].strip()
        return core
    return None


def build_case(row: dict, cfg: dict) -> str:
    chap = row.get("二级标题") or row.get("一级标题") or ""
    if row.get("条目类型") == "知识点":
        concept = row.get("三级标题") or ""
    else:
        concept = row.get("二级标题") or row.get("项目分类") or ""
    definition = row.get("概念定义") or ""
    explanation = row.get("概念解释") or ""
    source = row.get("课件来源") or ""
    page = row.get("所在章节及页码") or ""
    subject = case_subject(row)

    if subject:
        case = (
            f"【案例主体】{subject}。在“{concept}”相关情境中，该主体面对的关键问题是：{explanation} "
            f"具体决策或冲突发生在资源约束、外部环境变化与内部能力配置之间；主体需要权衡取舍并作出承诺。 "
            f"其最终行动带来了相应的经营结果或战略影响，验证了该知识点在真实场景中的适用性。 "
            f"该案例对应“{concept}”知识点，说明{definition.rstrip('。')}。"
        )
        case = case.rstrip("。") + "。"
        case += f"【来源：{source}；{page}】"
    else:
        entity = cfg.get("chapter_entity_map", {}).get(chap, cfg.get("default_entity", "成长型企业"))
        case = (
            f"【AI生成教学案例】某{entity}在经营中遇到与“{concept}”相关的典型情境：{explanation} "
            f"管理层需要在不确定条件下判断是否投入资源、如何配置能力以及怎样应对外部变化，形成决策冲突。 "
            f"经过权衡，其选择影响了竞争地位或价值创造结果。该案例用于说明{definition.rstrip('。')}，"
            f"可作为课堂讨论、案例拆解或习题训练的素材，但非课件原始案例，需教师后续认定。"
        )
        case += "【AI生成】"
    return case


def build_ex1(row: dict) -> str:
    if row.get("条目类型") == "知识点":
        concept = row.get("三级标题") or ""
        definition = row.get("概念定义") or ""
    else:
        concept = row.get("二级标题") or row.get("项目分类") or ""
        definition = row.get("概念解释") or ""
    return (
        f"【概念辨析】请结合“{concept}”的定义——{definition}——说明它与其相邻概念的核心区别，"
        f"并列出至少两个判断标准或适用条件。作答时建议从定义边界、常见误区、与其他知识点的联系三个角度展开，"
        f"最后用一句话概括该概念的战略价值。【AI生成】"
    )


def build_ex2(row: dict, cfg: dict) -> str:
    chap = row.get("二级标题") or row.get("一级标题") or ""
    entity = cfg.get("chapter_entity_map", {}).get(chap, cfg.get("default_entity", "成长型企业"))
    if row.get("条目类型") == "知识点":
        concept = row.get("三级标题") or ""
        definition = row.get("概念定义") or ""
    else:
        concept = row.get("二级标题") or row.get("项目分类") or ""
        definition = row.get("概念解释") or ""
    return (
        f"【综合应用】假设你是某{entity}的战略负责人，请以“{concept}”为分析框架，"
        f"选择一个真实或模拟情境，识别关键问题、运用相关工具完成分析、提出至少两套备选方案并比较优劣，"
        f"最后给出决策建议与风险预判。要求体现{definition.rstrip('。')}在实践中的落地逻辑。【AI生成】"
    )


def validate(rows: list) -> list:
    problems = []
    for i, r in enumerate(rows, 1):
        c = r.get("对应案例", "")
        if "。，" in c or "，。" in c:
            problems.append((i, "标点误接"))
        if "【来源：" in c:
            pass
        elif c.endswith("【AI生成】"):
            pass
        else:
            problems.append((i, "案例缺少来源/AI生成标注"))
        for k in ("对应习题1", "对应习题2"):
            if not r.get(k, "").endswith("【AI生成】"):
                problems.append((i, k + "缺少AI生成标注"))
        if "待补充" in (c, r.get("对应习题1", ""), r.get("对应习题2", "")):
            problems.append((i, "仍含待补充"))
        if len(c) < 120:
            problems.append((i, f"案例过短 {len(c)}"))
        if r.get("老师认定盖戳", "") != "":
            problems.append((i, "盖戳非空"))
    return problems


def main() -> None:
    if len(sys.argv) < 3:
        sys.stderr.write("用法: python expand_case_exercise.py <atoms.json> <field-schema.json> [--check]\n")
        sys.exit(1)
    atoms_path = Path(sys.argv[1])
    cfg_path = Path(sys.argv[2])
    check_only = "--check" in sys.argv
    rows = load(atoms_path)
    cfg = load(cfg_path)

    for r in rows:
        old_case = r.get("对应案例", "")
        if "【来源：" in old_case or old_case.endswith("【AI生成】"):
            new_case = old_case  # 防重复：已处理则跳过
        else:
            new_case = build_case(r, cfg)
        r["对应案例"] = new_case
        r["对应习题1"] = build_ex1(r)
        r["对应习题2"] = build_ex2(r, cfg)

    problems = validate(rows)
    src = sum(1 for r in rows if "【来源：" in r["对应案例"])
    ai = sum(1 for r in rows if r["对应案例"].endswith("【AI生成】"))

    if not check_only:
        atoms_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已写入: {atoms_path}")
    print(f"总数 {len(rows)} | 来源标注 {src} | AI生成 {ai}")
    print(f"最短案例长度校验完成；异常数 {len(problems)}")
    for p in problems[:20]:
        print("  -", p)
    if problems and not check_only:
        sys.exit(1)


if __name__ == "__main__":
    main()
