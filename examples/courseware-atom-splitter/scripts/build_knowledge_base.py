#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_knowledge_base.py — 由 atoms.json 升级为八表教学知识基座 Excel

把"原子知识点 + 具体项目"的扁平拆分结果，扩展为包含
原始归档 / 原子知识点 / 知识关系 / 案例与项目 / 案例知识映射 / 教学评价 / 审核与学习证据 / 填写说明
的八表知识网络。

两种运行模式：
  A. 课程专属模式（推荐用于已沉淀课程的复用）
     传入 --config <course-kb-config.json>，认知标签词表、组成/对比/应用关系、
     知识类型关键词、PDF 页映射均从该文件读取。
  B. 通用模式（默认，无需任何课程配置即可跑）
     不传 --config 时，使用内置通用规则：
       - 通用知识类型关键词（模型/框架/方法/流程/原则/机制/准则/概念…）；
       - 基于章节顺序自动生成"前置"关系；
       - 基于同章名称嵌套自动补"组成"关系；
       - 基于关系拓扑（出/入度）自动推断认知标签（核心/门槛/纽结/普通支撑）；
       - 课程名默认"课程"，ID 前缀、主题色等使用内置默认值。

用法:
  # 课程专属（战略管理等已配置课程）
  python build_knowledge_base.py \
      --atoms atoms.json \
      --config references/strategic-management-kb-config.json \
      --pdf-dir .workbuddy \
      --out 知识基座.xlsx

  # 通用模式（任意课程，零配置）
  python build_knowledge_base.py \
      --atoms atoms.json \
      --out 知识基座.xlsx

  # 通用模式 + 原文证据回填（把每份课件的 pages json 放一个目录，按文件名自动匹配）
  python build_knowledge_base.py \
      --atoms atoms.json \
      --pdf-dir .workbuddy \
      --out 知识基座.xlsx

说明:
  --pdf-dir 用于"原文证据摘录"自动回填。专属模式按 config.pdf_pages 映射；
  通用模式按"课件来源"文件名到 <source>.pages.json 自动匹配；不传或文件缺失时，
  证据列统一写"待人工补录课件原文摘录"（降级模式，不报错）。
  转录本（pages json）内容为 {"page_count":int, "pages":[{"text":str}, ...]}。
"""
import argparse
import json
import re
import sys
import subprocess
import unicodedata
from collections import defaultdict, OrderedDict
from pathlib import Path

try:
    import openpyxl
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "openpyxl>=3.1.0"])
    import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter


# ---------- 通用样式工具 ----------
def xl_color(css_hex: str) -> str:
    value = css_hex.removeprefix("#").upper()
    if len(value) != 6:
        raise ValueError(css_hex)
    return "FF" + value


def clean_text(text):
    return re.sub(r"\s+", "", str(text or ""))


def norm(text):
    """NFKC 归一化：统一全角/半角，避免课件原文（全角）与原子名称（半角）匹配失败。"""
    return unicodedata.normalize("NFKC", str(text or ""))


def parse_page_numbers(text):
    nums = []
    for block in re.findall(r"第([0-9]+)(?:[—\-至到]([0-9]+))?页", text or ""):
        a, b = int(block[0]), int(block[1] or block[0])
        nums.extend(range(a, b + 1))
    return sorted(set(nums))


# ---------- 通用知识模板（与课程无关，可复用） ----------
def knowledge_type(name, definition, explanation, kw):
    t = name + definition + explanation
    if any(k in name for k in kw.get("model", [])):
        return "模型/框架"
    if any(k in name for k in kw.get("method", [])):
        return "方法/流程"
    if any(k in name for k in kw.get("concept", [])):
        return "概念"
    if any(k in t for k in kw.get("mechanism", [])):
        return "原理/机制"
    if any(k in name for k in kw.get("criterion", [])):
        return "判断准则"
    return "事实/背景"


def mechanism(row):
    exp = row["概念解释"].strip("。； ")
    defi = row["概念定义"].strip("。； ")
    return (f"{exp}。其机制可从“输入条件—分析或行动—战略结果”理解：识别{defi}所涉及的"
            f"关键要素，将其转化为资源配置、竞争选择或组织行动，并通过结果反馈检验。")


def boundary(row):
    typ = row["_ktype"]
    name = row["三级标题"]
    if typ == "模型/框架":
        return (f"适用于问题边界较清楚、能够获得必要信息并需要结构化分析的场景；"
                f"使用“{name}”前应先明确分析对象、时间范围与比较基准。")
    if typ == "方法/流程":
        return (f"适用于需要把战略问题转化为连续步骤并形成可复核过程证据的场景；"
                f"需根据组织规模、数据质量和不确定程度调整“{name}”的使用深度。")
    return (f"适用于需要解释或判断“{name}”所描述现象的场景；"
            f"结论须与具体行业、组织能力、时间窗口和外部约束结合，不能脱离情境直接套用。")


def non_boundary(row):
    name = row["三级标题"]
    return (f"当关键事实缺失、概念口径不一致、分析对象跨越多个层级，或环境变化已使原假设失效时，"
            f"不宜仅凭“{name}”直接下结论；应补充数据并与其他框架交叉验证。")


def misconception(row):
    name = row["三级标题"]
    typ = row["_ktype"]
    if typ == "模型/框架":
        return (f"误区：把“{name}”当作填表工具，罗列因素后不说明证据、因果路径和战略含义；"
                f"或认为模型输出可以替代管理判断。")
    if typ == "方法/流程":
        return (f"误区：机械执行“{name}”的步骤，却不校验输入质量、适用边界和反馈结果；"
                f"把完成流程等同于问题已经解决。")
    return (f"误区：只背诵“{name}”的定义，忽略它与相邻概念的边界、成立条件和可观察证据；"
            f"或把相关关系误判为因果关系。")


def concise(text, n=120):
    value = re.sub(r"\s+", "", text or "")
    return value if len(value) <= n else value[:n] + "…"


# ---------- 内置通用配置（零配置兜底） ----------
GENERIC_CONFIG = {
    "course": "课程",
    "version": "2.0",
    "kb_id_prefixes": {
        "knowledge": "KP", "project": "PJ", "case": "CA",
        "relation": "KR", "assessment": "EV", "review": "RV"
    },
    "highlighter": "#660874",
    "knowledge_type_keywords": {
        "model": ["模型", "框架", "矩阵", "图", "图谱", "范式", "五力", "BCG", "SWOT", "价值链", "EFE", "IFE", "QSPM", "平衡计分卡"],
        "method": ["法", "流程", "步骤", "程序", "过程", "分析", "评估", "审计", "复盘", "路径", "路线图", "循环"],
        "concept": ["概念", "理论", "思想", "观点", "理念", "定义", "要素", "维度", "特征", "属性", "类型", "分类", "结构"],
        "mechanism": ["机制", "原理", "规律", "效应", "驱动", "逻辑", "因果", "作用", "影响", "演变"],
        "criterion": ["准则", "原则", "标准", "指标", "条件", "要求", "规则", "依据", "判据"]
    },
    "cognitive_tags": {},          # 空 → 触发拓扑推断
    "component_relations": {},     # 空 → 通用模式按同章名称嵌套自动补
    "contrast_relations": [],
    "application_relations": [],
    "pdf_pages": {}
}


# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser(description="由 atoms.json 生成八表教学知识基座 Excel（支持零配置通用模式）")
    ap.add_argument("--atoms", required=True, help="atoms.json 路径")
    ap.add_argument("--config", default=None, help="领域配置文件（可选；不传则进入通用模式）")
    ap.add_argument("--pdf-dir", default=None, help="存放 PDF 转录本（pages json）的目录")
    ap.add_argument("--out", required=True, help="输出 xlsx 路径")
    args = ap.parse_args()

    atoms_path = Path(args.atoms)

    # 配置加载：专属优先，缺失则通用兜底
    if args.config and Path(args.config).exists():
        cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
        cfg_source = "config"
    else:
        if args.config:
            print(f"[warn] 指定的 --config 不存在，已回退到通用模式：{args.config}")
        else:
            print("[info] 未指定 --config，进入零配置通用模式（自动推断关系与认知标签）。")
        cfg = json.loads(json.dumps(GENERIC_CONFIG))  # 深拷贝，避免污染常量
        cfg_source = "generic"

    # 课程专属认知词表（仅专属模式有效）
    tags_cfg = cfg.get("cognitive_tags", {}) or {}
    CORE = set(tags_cfg.get("core", []))
    THRESHOLD = set(tags_cfg.get("threshold", []))
    KNOT = set(tags_cfg.get("knot", []))
    ISOMORPH = set(tags_cfg.get("isomorph", []))
    has_domain_tags = bool(CORE or THRESHOLD or KNOT or ISOMORPH)

    course = cfg.get("course", "课程")
    version = cfg.get("version", "2.0")
    prefixes = cfg.get("kb_id_prefixes", {})
    PK = prefixes.get("knowledge", "KP")
    PJ = prefixes.get("project", "PJ")
    CA = prefixes.get("case", "CA")
    KR = prefixes.get("relation", "KR")
    EV = prefixes.get("assessment", "EV")
    RV = prefixes.get("review", "RV")
    highlight = cfg.get("highlighter", "#660874")

    # 知识类型关键词：专属优先，否则通用
    kw = cfg.get("knowledge_type_keywords") or GENERIC_CONFIG["knowledge_type_keywords"]

    rows = json.loads(atoms_path.read_text(encoding="utf-8"))

    # PDF 转录本（用于原文证据回填）
    page_docs = {}
    pdf_pages = dict(cfg.get("pdf_pages", {}))
    # 给了 pdf-dir：先按配置映射；配置未覆盖的"课件来源"再按文件名自动匹配 <source>.pages.json
    # （这样专属课程既能用沉淀好的转录本，也能在全新 PDF 上自动回填证据）
    if args.pdf_dir:
        pdf_dir = Path(args.pdf_dir)
        if pdf_dir.exists():
            available = {p.stem: p for p in pdf_dir.glob("*.json")}
            sources = {x.strip() for r in rows for x in r.get("课件来源", "").split("；") if x.strip()}
            for src in sources:
                base = Path(src).stem
                # 配置映射指向的转录本若在 pdf-dir 中真实存在，则优先采用
                if src in pdf_pages and (pdf_dir / pdf_pages[src]).exists():
                    continue
                cand = available.get(src) or available.get(base) or available.get(base + ".pages")
                if cand:
                    pdf_pages[src] = cand.name
    if args.pdf_dir and pdf_pages:
        pdf_dir = Path(args.pdf_dir)
        for fname, jname in pdf_pages.items():
            jpath = pdf_dir / jname
            if jpath.exists():
                page_docs[fname] = json.loads(jpath.read_text(encoding="utf-8"))

    def evidence_for(row):
        snippets = []
        files = [x.strip() for x in row.get("课件来源", "").split("；") if x.strip()]
        locs = [x.strip() for x in row.get("所在章节及页码", "").split("；") if x.strip()]
        terms = [norm(row.get("三级标题", "")), norm(row.get("二级标题", "")), norm(row.get("概念定义", ""))[:12]]
        for idx, fname in enumerate(files):
            doc = page_docs.get(fname)
            if not doc:
                continue
            loc = locs[idx] if idx < len(locs) else row.get("所在章节及页码", "")
            pages = parse_page_numbers(loc)
            for p in pages[:2]:
                if 1 <= p <= doc["page_count"]:
                    pg = doc["pages"][p - 1]
                    text = norm(clean_text(pg.get("text", "")))
                    if not text:
                        continue
                    pos = -1
                    for term in terms:
                        t = norm(clean_text(term))
                        if t and t != "不适用":
                            pos = text.find(t[: min(len(t), 10)])
                            if pos >= 0:
                                break
                    if pos < 0:
                        pos = 0
                    excerpt = text[max(0, pos - 20):pos + 180]
                    snippets.append(f"{fname} PDF第{p}页：{excerpt}")
                    break
            if len(snippets) >= 2:
                break
        return "｜".join(snippets) if snippets else "待人工补录课件原文摘录"

    def cognitive_tags(name):
        # 专属模式：依据领域词表
        if has_domain_tags:
            tags, reasons = [], []
            if name in CORE:
                tags.append("核心知识"); reasons.append("能组织或解释同章节多个概念与决策")
            if name in THRESHOLD:
                tags.append("门槛知识候选"); reasons.append("需要跨越直觉理解或处理权衡与边界")
            if name in KNOT:
                tags.append("纽结知识候选"); reasons.append("连接多个概念、步骤或因果链")
            if name in ISOMORPH:
                tags.append("同构知识候选"); reasons.append("可迁移到不同产业、组织或项目情境")
            if not tags:
                tags.append("普通支撑知识"); reasons.append("为上位模型、方法或决策提供必要支撑")
            return "；".join(tags), "；".join(reasons)
        # 通用模式：拓扑推断在关系构建后填充，此处先返回占位
        return _generic_tag_cache.get(name, ("普通支撑知识", "由知识关系拓扑自动归类，待教师确认"))

    # 案例来源分层
    def source_tier(case):
        if "【来源：" in case:
            return "课件案例线索+AI扩写"
        if "【AI生成】" in case or "【AI生成教学案例】" in case:
            return "AI虚构教学案例"
        return "待人工判定"

    def case_title(case, fallback):
        m = re.match(r"【案例主体】([^。]+)", case or "")
        return m.group(1).strip() if m else fallback

    def strip_marks(text):
        text = re.sub(r"【来源：.*?】$", "", text or "")
        return text.replace("【AI生成教学案例】", "").replace("【AI生成】", "").strip()

    knowledge_rows = [r for r in rows if r["条目类型"] == "知识点"]
    project_rows = [r for r in rows if r["条目类型"] == "具体项目"]
    kp_ids = {r["三级标题"]: f"{PK}-{i:03d}" for i, r in enumerate(knowledge_rows, 1)}
    chapter_kps = defaultdict(list)
    for r in knowledge_rows:
        chapter_kps[r["二级标题"]].append(r["三级标题"])
    name_to_chapter = {r["三级标题"]: r["二级标题"] for r in knowledge_rows}

    # 知识类型映射（通用模式认知标签推断需要，先算）
    ktype_map = {r["三级标题"]: knowledge_type(r["三级标题"], r["概念定义"], r["概念解释"], kw)
                 for r in knowledge_rows}

    # ---- 先构建关系（前置 / 组成 / 对比 / 应用），供拓扑推断使用 ----
    relations, relation_seen = [], set()
    def add_relation(src, rel, dst, basis, condition="在本课程语境下成立"):
        if src not in kp_ids or dst not in kp_ids or src == dst:
            return
        key = (src, rel, dst)
        if key in relation_seen:
            return
        relation_seen.add(key)
        relations.append([f"{KR}-{len(relations)+1:03d}", kp_ids[src], src, rel, kp_ids[dst], dst, basis, condition, "AI候选，待教师确认"])

    # 1) 同章顺序 → 前置
    for chapter, names in chapter_kps.items():
        for a, b in zip(names, names[1:]):
            add_relation(a, "前置", b, f"课件在“{chapter}”章节中按此顺序组织，前者为理解后者提供术语或分析基础。")

    # 2) 专属组成/对比/应用
    components = cfg.get("component_relations", {}) or {}
    for parent, children in components.items():
        for child in children:
            add_relation(parent, "组成", child, f"“{child}”是“{parent}”的构成维度或子类型。")
    for a, b in (cfg.get("contrast_relations", []) or []):
        add_relation(a, "对比", b, f"两者需要从目标、适用条件、资源要求与风险进行辨析。")
    for a, b in (cfg.get("application_relations", []) or []):
        add_relation(a, "应用", b, f"前者可作为分析或实施后者的工具。")

    # 3) 通用模式：同章名称嵌套 → 组成（保守：A 为 B 的子串且长度差合理）
    if cfg_source == "generic":
        names = list(kp_ids.keys())
        for a in names:
            ca = name_to_chapter.get(a)
            if len(a) < 3:
                continue
            for b in names:
                if a == b:
                    continue
                if len(b) - len(a) < 2:
                    continue
                if a in b and name_to_chapter.get(b) == ca:
                    add_relation(a, "组成", b, f"“{a}”是“{b}”的构成部分或上位概念（自动推断，待教师确认）。")

    # ---- 通用模式认知标签推断：知识类型 + 关系拓扑 ----
    _generic_tag_cache = {}
    if cfg_source == "generic" or not has_domain_tags:
        out_compose = defaultdict(int)
        in_prereq = defaultdict(int)
        out_prereq = defaultdict(int)
        for rel in relations:
            st, rt, dt = rel[2], rel[3], rel[5]
            if rt == "组成":
                out_compose[st] += 1
            elif rt == "前置":
                out_prereq[st] += 1
                in_prereq[dt] += 1
        for name in kp_ids:
            t = ktype_map.get(name, "事实/背景")
            oc, ip, op = out_compose.get(name, 0), in_prereq.get(name, 0), out_prereq.get(name, 0)
            tags, reasons = [], []
            # 1) 知识类型层面的候选判断（语义启发）
            if t == "模型/框架":
                tags.append("核心知识"); reasons.append("模型/框架类知识，用于组织分析视角与决策结构")
            elif t == "方法/流程":
                tags.append("门槛知识候选"); reasons.append("方法/流程需跨越直觉、通过练习方能稳定掌握")
            elif t == "原理/机制":
                tags.append("纽结知识候选"); reasons.append("原理/机制连接概念与应用，常作为推理枢纽")
            # 2) 关系拓扑叠加（结构启发）
            if oc >= 2:
                if "核心知识" not in tags:
                    tags.append("核心知识")
                reasons.append(f"作为{oc}个下位概念或维度的上位组织节点")
            if ip >= 2:
                if "门槛知识候选" not in tags:
                    tags.append("门槛知识候选")
                reasons.append(f"有{ip}个后续知识点以其为前置，掌握它影响后续学习")
            if oc >= 1 and ip >= 1 and "纽结知识候选" not in tags:
                tags.append("纽结知识候选"); reasons.append("既组织下位概念又被多个知识点依赖，连接多条知识链")
            if not tags:
                tags.append("普通支撑知识")
                reasons.append("在当前关系与类型特征下为局部支撑节点，待教师确认")
            _generic_tag_cache[name] = ("；".join(tags), "；".join(reasons) + "（自动推断，待教师确认）")

    # ---- 原子知识点主表 ----
    atom_data = []
    for i, r in enumerate(knowledge_rows, 1):
        name = r["三级标题"]
        ktype = knowledge_type(name, r["概念定义"], r["概念解释"], kw)
        r["_ktype"] = ktype
        tags, reason = cognitive_tags(name)
        previous = chapter_kps[r["二级标题"]]
        pos = previous.index(name)
        prereq = previous[pos - 1] if pos > 0 else "本课程导论或前序章节基础"
        atom_data.append([kp_ids[name], course, r["二级标题"], name,
            ktype, r["概念定义"], r["概念解释"],
            mechanism(r), boundary(r), non_boundary(r), misconception(r), prereq,
            f"可迁移到行业分析、企业诊断、项目决策或个人发展中的同类结构问题；迁移时需重建情境证据与约束。",
            tags, reason, r["课件来源"], r["所在章节及页码"], evidence_for(r),
            "AI结构化改写，待教师核验", "待教师确认", version])

    # ---- 案例/项目资产与映射 ----
    assets, mappings, asset_key_to_id = [], [], OrderedDict()
    def add_asset(key, kind, name, category, description, tier, source, pages, knowledge_hint, pbl=True):
        if key in asset_key_to_id:
            return asset_key_to_id[key]
        aid = ("PJ-" if kind == "项目" else "CA-") + f"{sum(1 for a in assets if a[1] == kind) + 1:03d}"
        asset_key_to_id[key] = aid
        if pbl:
            discover = f"围绕“{name}”识别主体、情境、关键冲突与待验证假设，形成问题清单。"
            learn = f"调用“{knowledge_hint}”等知识建立分析框架，核对证据、适用边界与替代解释。"
            develop = "提出至少两套方案，明确资源配置、实施步骤、衡量指标和风险预案，并用证据比较。"
            reflect = "复盘判断偏差、失败原因和未验证假设，说明哪些结论可迁移、哪些只在本情境成立。"
        else:
            discover = learn = develop = reflect = "不适用"
        assets.append([aid, kind, name, category, description, tier, source, pages,
            discover, learn, develop, reflect,
            "机制分析；数据分析；系统思维；沟通协作", "价值判断；战略判断；想象；元认知",
            "AI结构化整理，待教师核验", version])
        return aid

    for r in knowledge_rows:
        name = r["三级标题"]
        title = case_title(r["对应案例"], name + "教学案例")
        tier = source_tier(r["对应案例"])
        aid = add_asset("KCASE|" + title, "案例", title, "教学案例", r["对应案例"], tier,
                        r["课件来源"], r["所在章节及页码"], name, False)
        mappings.append([aid, kp_ids[name], name, "主要说明",
                         f"案例中的决策、冲突和结果用于观察“{name}”的机制、边界与应用。", "AI候选，待教师确认"])

    for r in project_rows:
        name = r["二级标题"]
        aid = add_asset("PROJECT|" + name, "项目", name, r["项目分类"], r["对应案例"], source_tier(r["对应案例"]),
                        r["课件来源"], r["所在章节及页码"], r["对应知识点"], True)
        terms = [x.strip() for x in re.split(r"[；;、]", r["对应知识点"]) if x.strip()]
        matched = []
        for term in terms:
            exact = kp_ids.get(term)
            if exact:
                matched.append((term, exact))
                continue
            candidates = [(n, kid) for n, kid in kp_ids.items() if term in n or n in term]
            if candidates:
                matched.append(min(candidates, key=lambda x: abs(len(x[0]) - len(term))))
        if not matched:
            chapter_candidates = chapter_kps.get(r["一级标题"], [])
            matched = [(n, kp_ids[n]) for n in chapter_candidates[:1]]
        seen = set()
        for n, kid in matched:
            if kid not in seen:
                mappings.append([aid, kid, n, "项目调用",
                                 f"项目在发现、学习、研制和反思过程中调用“{n}”进行分析或决策。", "AI候选，待教师确认"])
                seen.add(kid)

    # ---- 教学评价：无AI独立理解 + 有AI审查修正 ----
    assessments = []
    for i, r in enumerate(knowledge_rows, 1):
        name, kid = r["三级标题"], kp_ids[r["三级标题"]]
        no_ai = (f"【无AI轨】在不使用生成式AI的条件下，结合“{name}”的定义与机制，完成三项任务："
                 f"①用自己的语言解释其因果或作用路径；②给出一个适用情境和一个不适用情境；③辨析一个常见误区。"
                 f"作答必须引用可观察事实或课件证据，不能只复述定义。")
        ai_track = (f"【有AI轨】让AI针对一个组织情境生成“{name}”分析。提交AI原答，并逐项审查：事实证据、隐含假设、"
                    f"概念边界、遗漏变量和推理跳步；至少指出两处问题，给出修订版结论，并说明哪些判断必须由人承担。")
        rubric = "概念与机制准确30%；证据与边界25%；推理完整20%；方案或修订质量15%；表达与可复核性10%。"
        process = "无AI轨：独立草稿、证据标注、最终答案；有AI轨：提示词、AI原答、错误清单、修改痕迹、最终判断与反思。"
        assessments.append([f"{EV}-{i:03d}", kid, name, r["对应习题1"], r["对应习题2"], no_ai, ai_track, rubric, process,
                            "理解机制；辨析边界；审查AI；作出判断", "AI生成，待教师审定", version])

    reviews = []
    for i, r in enumerate(knowledge_rows, 1):
        name, kid = r["三级标题"], kp_ids[r["三级标题"]]
        reviews.append([f"{RV}-{i:03d}", kid, name, "AI候选", "待教师确认", "待学生体验验证", "待补充",
                        "待补充", "待补充", "待补充", "待补充", version, "首次升级：等待真实教学证据"])

    instructions = [
        ["总体原则", "升级目标", "从内容台账升级为课件证据—原子内容—知识关系—案例项目—双轨评价—学习证据的教学知识网络。"],
        ["原始归档", "保留规则", "“原始拆分归档”完整保留上一版记录及全部列，升级表通过新ID与关联表扩展，不覆盖源文件。"],
        ["稳定ID", "知识点ID", f"{PK}-001起连续编号；ID不随名称微调而变化，其他表仅通过ID关联。"],
        ["知识类型", "分类规则", "在概念、原理/机制、模型/框架、方法/流程、判断准则、事实/背景中单选；AI初判需教师复核。"],
        ["认知价值", "标签规则", "核心知识、门槛知识候选、纽结知识候选、同构知识候选、普通支撑知识；允许多选，候选不是定论。" + ("（本次为通用模式：由关系拓扑自动推断）" if cfg_source == "generic" else "")],
        ["来源层级", "课件原文", "直接复制课件原文且可定位页码；不得改写后仍标为原文。"],
        ["来源层级", "课件案例线索+AI扩写", "课件提供案例名或线索，案例正文由AI补写；需教师核验事实。"],
        ["来源层级", "外部真实案例", "须注明作者、机构、出版物或可核验链接；本版未新增外部资料。"],
        ["来源层级", "AI虚构教学案例", "为教学目的虚构，必须明确标注，不得当作真实事实引用。"],
        ["原文证据", "填写规则", "优先保存文件名、PDF页码和原文摘录；提取文本可能有OCR或排版误差，正式引用前对照课件。"],
        ["知识关系", "关系类型", "前置、组成、因果、对比、应用、同构；每条关系必须记录依据、成立条件和审核状态。" + ("（本次通用模式：前置按章节顺序，组成为同章名称嵌套自动推断）" if cfg_source == "generic" else "")],
        ["案例项目", "多对多映射", "案例/项目独立成条，通过映射表关联多个知识点，并说明每个知识点在案例中的观察位置。"],
        ["PBL过程", "四步循环", "项目按发现—学习—研制—反思组织；案例资产不强制套用完整PBL流程。"],
        ["双轨评价", "无AI轨", "检验学生独立解释机制、辨析边界、引用证据和作出判断的能力。"],
        ["双轨评价", "有AI轨", "要求提交AI原答、提示词、错误审查、修订记录和最终判断，检验人机协同控制力。"],
        ["审核状态", "状态枚举", "AI候选、待教师确认、教师已确认、已学生体验验证、需要修订。"],
        ["学习证据", "动态修订", "记录学生卡点、顿悟、常见错误、AI常见错误和过程证据，据此更新认知标签与题目。"],
        ["待补充", "使用规则", "原材料或真实教学尚未提供的信息写待补充；不允许用AI猜测替代事实性审核记录。"],
        ["不适用", "使用规则", "字段因对象类型确实不适用时填写不适用，不与待补充混用。"],
        ["版本管理", "版本规则", f"本版为v{version}；教师修改、学生验证或来源更新后递增版本并在审核证据表记录修改说明。"],
    ]

    # ---- 工作簿 ----
    XL_PRIMARY = xl_color(highlight)
    XL_PRIMARY_DARK = xl_color("#4C0757")
    XL_LIGHT = xl_color("#F4EAF6")
    XL_LIGHTER = xl_color("#FBF8FC")
    XL_BORDER = xl_color("#D8CEDA")
    XL_WHITE = xl_color("#FFFFFF")
    XL_TEXT = xl_color("#25202A")
    XL_GRAY = xl_color("#EDE9EE")
    XL_WARN = xl_color("#FFF2CC")
    XL_GREEN = xl_color("#E2F0D9")
    XL_RED = xl_color("#F4CCCC")
    thin = Side(style="thin", color=XL_BORDER)

    wb = Workbook()
    wb.remove(wb.active)
    wb.properties.title = f"{course}知识基座 Excel {version}"

    raw_headers = ["条目类型", "主标题", "一级标题", "二级标题", "三级标题", "项目分类", "对应知识点",
                   "概念定义", "概念解释", "对应案例", "对应习题1", "对应习题2", "课件来源", "所在章节及页码", "老师认定盖戳"]
    raw_data = [[r.get(h, "") for h in raw_headers] for r in rows]

    sheets = OrderedDict([
        ("原始拆分归档", (raw_headers, raw_data)),
        ("原子知识点", (["知识点ID", "课程", "章节", "知识点名称", "知识类型", "一句话定义", "原概念解释", "核心机制", "适用边界", "非适用条件", "常见误区", "前置知识", "迁移场景", "认知价值标签", "候选理由", "课件来源", "章节及页码", "原文证据摘录", "内容状态", "审核状态", "版本"], atom_data)),
        ("知识关系", (["关系ID", "源知识点ID", "源知识点", "关系类型", "目标知识点ID", "目标知识点", "关系依据", "成立条件", "审核状态"], relations)),
        ("案例与项目", (["资产ID", "资产类型", "名称", "分类", "完整案例或项目描述", "来源层级", "来源文件", "章节及页码", "发现", "学习", "研制", "反思", "能力目标", "高阶认知目标", "审核状态", "版本"], assets)),
        ("案例知识映射", (["资产ID", "知识点ID", "知识点名称", "映射角色", "观察位置或调用说明", "审核状态"], mappings)),
        ("教学评价", (["评价ID", "知识点ID", "知识点名称", "原习题1", "原习题2", "习题1_无AI轨", "习题2_有AI轨", "评分标准", "过程证据", "能力目标", "内容状态", "版本"], assessments)),
        ("审核与学习证据", (["审核ID", "知识点ID", "知识点名称", "AI候选状态", "教师审核状态", "学生验证状态", "教师判断理由", "学生卡点证据", "学生顿悟证据", "AI常见错误", "审核人及日期", "版本", "修改记录"], reviews)),
        ("填写说明", (["规则类别", "字段或主题", "填写说明"], instructions)),
    ])

    header_fill = PatternFill("solid", fgColor=XL_PRIMARY)
    light_fill = PatternFill("solid", fgColor=XL_LIGHTER)
    input_fill = PatternFill("solid", fgColor=XL_WARN)
    status_fill = PatternFill("solid", fgColor=XL_LIGHT)
    header_font = Font(name="Microsoft YaHei", size=10, bold=True, color=XL_WHITE)
    body_font = Font(name="Microsoft YaHei", size=9, color=XL_TEXT)
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_wrap = Alignment(horizontal="left", vertical="top", wrap_text=True)

    long_terms = ("定义", "机制", "边界", "条件", "误区", "前置", "迁移", "理由", "来源", "页码", "证据", "依据", "说明", "描述", "发现", "学习", "研制", "反思", "目标", "习题", "标准", "记录", "卡点", "顿悟", "错误")
    status_terms = ("状态", "审核", "认定")
    for sname, (headers, data) in sheets.items():
        ws = wb.create_sheet(sname)
        ws.sheet_properties.tabColor = XL_PRIMARY
        ws.append(headers)
        for record in data:
            ws.append(record)
        for c, header in enumerate(headers, 1):
            cell = ws.cell(1, c)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center
            cell.border = Border(bottom=thin)
            if any(t in header for t in long_terms):
                width = 34
            elif "ID" in header or header in ("版本", "课程"):
                width = 13
            else:
                width = max(12, min(22, len(header) * 2 + 4))
            ws.column_dimensions[get_column_letter(c)].width = width
        for row_cells in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=len(headers)):
            for cell in row_cells:
                cell.font = body_font
                cell.alignment = left_wrap
                cell.border = Border(bottom=thin)
                if cell.row % 2 == 0:
                    cell.fill = light_fill
        for c, header in enumerate(headers, 1):
            if any(t in header for t in status_terms):
                for r in range(2, ws.max_row + 1):
                    ws.cell(r, c).fill = status_fill
            if header in ("教师判断理由", "学生卡点证据", "学生顿悟证据", "AI常见错误", "审核人及日期"):
                for r in range(2, ws.max_row + 1):
                    ws.cell(r, c).fill = input_fill
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{ws.max_row}"
        ws.freeze_panes = "B2" if len(headers) > 10 else "A2"
        ws.row_dimensions[1].height = 32
        ws.sheet_view.showGridLines = False
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{ws.max_row}"

    # 数据验证与状态条件格式
    for ws_name, col_name, formula in [
        ("原子知识点", "知识类型", '"概念,原理/机制,模型/框架,方法/流程,判断准则,事实/背景"'),
        ("知识关系", "关系类型", '"前置,组成,因果,对比,应用,同构"'),
        ("审核与学习证据", "教师审核状态", '"待教师确认,教师已确认,需要修订"'),
        ("审核与学习证据", "学生验证状态", '"待学生体验验证,已学生体验验证,需要修订"')]:
        if ws_name not in wb.sheetnames:
            continue
        ws = wb[ws_name]
        col = ws[1].index(next(c for c in ws[1] if c.value == col_name)) + 1
        dv = DataValidation(type="list", formula1=formula, allow_blank=False)
        ws.add_data_validation(dv)
        dv.add(f"{get_column_letter(col)}2:{get_column_letter(col)}{ws.max_row}")

    for ws in wb.worksheets:
        for c in range(1, ws.max_column + 1):
            if "状态" in str(ws.cell(1, c).value):
                letter = get_column_letter(c)
                ws.conditional_formatting.add(f"{letter}2:{letter}{ws.max_row}",
                    FormulaRule(formula=[f'ISNUMBER(SEARCH("已确认",{letter}2))'], fill=PatternFill("solid", fgColor=XL_GREEN)))
                ws.conditional_formatting.add(f"{letter}2:{letter}{ws.max_row}",
                    FormulaRule(formula=[f'ISNUMBER(SEARCH("需要修订",{letter}2))'], fill=PatternFill("solid", fgColor=XL_RED)))

    for ws in wb.worksheets:
        for r in range(2, ws.max_row + 1):
            ws.row_dimensions[r].height = None
    wb["填写说明"].column_dimensions["A"].width = 18
    wb["填写说明"].column_dimensions["B"].width = 25
    wb["填写说明"].column_dimensions["C"].width = 90

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out_path)

    summary = {
        "output": str(out_path),
        "config_source": cfg_source,
        "course": course,
        "sheets": {k: len(v[1]) for k, v in sheets.items()},
        "knowledge": len(knowledge_rows), "projects": len(project_rows),
        "relations": len(relations), "assets": len(assets), "mappings": len(mappings),
        "source_evidence_filled": sum(1 for r in atom_data if r[17] != "待人工补录课件原文摘录"),
        "evidence_mode": "pdf" if page_docs else "degraded",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
