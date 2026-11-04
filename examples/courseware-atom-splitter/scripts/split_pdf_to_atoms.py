#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
split_pdf_to_atoms.py — 将 PDF 课件启发式拆分为 atoms.json（端到端首稿，无需大模型）

作为 courseware-atom-splitter 的 Step 1–2 自动化实现：把"PDF → 原子知识点 + 具体项目"
用确定性规则完成，产物为**待教师精修的初稿**（所有内容标注 AI候选 / 待教师确认）。

两种课件形态自适应：
  A. 教材/讲义（有大纲或编号小节）：用 PDF 书签(outline)或"第X章/2.1"编号切块。
  B. 幻灯片课件（无大纲、无编号、要点式）：用每页首行作为知识点标题，要点作为正文。

设计取舍：
  - 优先 PDF 书签作为章节锚点；没有则扫描"第X章/第X节"文本。
  - 章节内优先按编号子标题（2.1 / （一））切块；切块数 <2 时退化为按页首行切片。
  - 无大纲无章节的幻灯片，直接按页首行切成候选知识点（过滤封面/教师信息/目录等页）。
  - 不依赖大模型，定义/解释/案例/习题均为规则初稿，需要教师复核。

依赖: pymupdf  (pip install pymupdf)

用法:
  python split_pdf_to_atoms.py --pdf 课件.pdf --out atoms.json
  python split_pdf_to_atoms.py --pdf 课件.pdf --out atoms.json --keep-projects
"""
import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

try:
    import pymupdf
except ImportError:
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "pymupdf"])
        import pymupdf
    except Exception:
        sys.stderr.write("缺少依赖 pymupdf，请先执行: pip install pymupdf\n")
        sys.exit(2)


# ---------- 正则 ----------
CHAPTER_PATTERNS = [
    re.compile(r"^第\s*([一二三四五六七八九十百\d]+)\s*章\b"),
    re.compile(r"^第\s*([一二三四五六七八九十百\d]+)\s*节\b"),
]
SUBSEC_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){1,2})\s*[\.、：: ]\s*(.+)$")
SUBSEC_CN_RE = re.compile(r"^（?([一二三四五六七八九十]+)）?\s*[、\.]\s*(.+)$")
DEF_RE = re.compile(r"(.+?)(?:是指|定义为|称作|称为|即[：: ]|是指：)(.+?)[。；;\n]")
CASE_RE = re.compile(r"(例如|比如|案例|实例|以\s*.{0,10}\s*为例|如.{0,8}(?:公司|企业|集团|项目|国家|地区))")
PROJECT_RE = re.compile(r"(实训项目|实践课题|课程项目|设计项目|综合项目|项目背景|作业要求|实验任务)", re.IGNORECASE)

# 幻灯片需跳过的管理/装饰页关键词
META_TITLE = re.compile(
    r"(主讲教师|助教|课程方式|联系方式|邮箱|电话|微信|公众号|目录|contents|参考文献|"
    r"参考书|致谢|答疑|考核方式|课程大纲|课前|课后|欢迎|简介|关于本课程|教学安排|"
    r"课程目标|教学目标|教学内容|本章内容|内容提要|学习要点|学习目标|课程简介|"
    r"课程概述|课程组织|教学目的|本章小结|思考题|练习题|知识结构|框架图|参考图书)"
)
META_BODY = re.compile(r"(邮箱|电话|助教|主讲|课程方式|联系方式|微信公众号|课后答疑|课前发布)")


def clean(text):
    return re.sub(r"\s+", " ", text or "").strip()


def norm(text):
    """NFKC 归一化：把 PDF 中常见的全角字符（⽬/⾏/（）等）转为半角，便于规则匹配。"""
    return unicodedata.normalize("NFKC", text or "")


def page_lines(doc, pi):
    text = doc[pi].get_text("text")
    lines = [clean(x) for x in text.splitlines()]
    return [x for x in lines if x and not re.fullmatch(r"\d+", x)]


def detect_outline_chapters(doc):
    toc = doc.get_toc()
    if not toc:
        return []
    chapters = []
    n = doc.page_count
    for i, (lvl, title, page) in enumerate(toc):
        if lvl > 2:
            continue
        start = max(0, page - 1)
        end = (toc[i + 1][2] - 1) if i + 1 < len(toc) else n - 1
        chapters.append((title.strip(), start, min(end, n - 1)))
    return chapters


def infer_chapters_from_text(doc):
    chapters = []
    seen = set()
    n = doc.page_count
    for pi in range(n):
        for ln in page_lines(doc, pi):
            for pat in CHAPTER_PATTERNS:
                if pat.match(ln) and ln not in seen:
                    seen.add(ln)
                    chapters.append((ln, pi, n - 1))
                    break
    for i in range(len(chapters) - 1):
        chapters[i] = (chapters[i][0], chapters[i][1], chapters[i + 1][1] - 1)
    return chapters


def extract_definition(body):
    m = DEF_RE.search(body)
    if m:
        return clean(m.group(2))[:60]
    first = re.split(r"[。；;]", body)[0]
    return clean(first)[:60]


def extract_case_clue(body):
    """优先提取课件中已有的案例线索片段。"""
    m = CASE_RE.search(body)
    if m:
        s = max(0, m.start() - 12)
        e = min(len(body), m.start() + 150)
        return "【来源：课件原文线索】" + body[s:e]
    return None


def knowledge_type_of(text):
    if any(k in text for k in ["模型", "框架", "矩阵", "五力", "SWOT", "BCG", "价值链", "图谱", "范式"]):
        return "model"
    if any(k in text for k in ["法", "流程", "步骤", "程序", "路径", "路线图", "循环"]):
        return "method"
    if any(k in text for k in ["机制", "原理", "效应", "规律", "驱动", "逻辑", "因果"]):
        return "mechanism"
    return "concept"


def generate_case(title, body, ktype):
    """基于知识点内容生成有实质内容的情境化教学案例（离线规则版，标注 AI生成）。"""
    clue = extract_case_clue(body)
    if clue:
        return clue
    anchors = [x for x in re.split(r"[。；;]", body) if x.strip()]
    ctx = anchors[0][:60] if anchors else title
    return (f"【AI生成】情境示例：某组织在经营管理中遇到与“{title}”相关的议题——{ctx}。"
            f"在该情境中，“{title}”可作为分析或决策视角：识别关键要素、判断适用条件，"
            f"并比较不同方案的取舍。若忽视其边界与常见误区，可能导致资源配置偏差。"
            f"建议教师结合本课程真实案例替换本示例后使用（待教师确认）。")


def generate_exercises(title, body, ktype, definition):
    """基于知识类型生成两道差异化习题（理解型 + 应用型），标注 AI生成。"""
    ex1 = (f"【AI生成】理解型：用自己的话解释“{title}”的核心机制，结合一个适用情境与一个不适用情境，"
           f"并辨析一个常见误区（提示：避免只复述定义，要说明证据与边界）。")
    if ktype == "model":
        ex2 = (f"【AI生成】应用型：选择一个真实或模拟的组织情境，运用“{title}”建立分析框架，"
               f"列出关键维度、给出判断，并说明该框架的局限与需要补充的工具。")
    elif ktype == "method":
        ex2 = (f"【AI生成】应用型：以“{title}”为流程，针对一个实际问题拆解步骤、明确每步的输入与产出，"
               f"并说明在数据与资源受限时如何调整执行深度。")
    elif ktype == "mechanism":
        ex2 = (f"【AI生成】应用型：针对一个组织现象，说明“{title}”的因果链条，指出哪些环节可被干预，"
               f"并预测干预后的可能结果及副作用。")
    else:
        ex2 = (f"【AI生成】应用型：假设你是某业务负责人，请以“{title}”为判断依据分析一个决策情境，"
               f"提出至少两套备选方案并比较优劣，最后给出风险预判。")
    return ex1, ex2


def build_knowledge_atom(title, body, source, chapter, page_no):
    title = title.strip().strip("：:").strip()
    if not title or len(title) > 40:
        return None
    definition = extract_definition(body) or body[:40]
    explanation = body[:200]
    ktype = knowledge_type_of(title + definition)
    case = generate_case(title, body, ktype)
    ex1, ex2 = generate_exercises(title, body, ktype, definition)
    return {
        "条目类型": "知识点",
        "主标题": source,
        "一级标题": chapter,
        "二级标题": chapter,
        "三级标题": title,
        "概念定义": definition,
        "概念解释": explanation,
        "对应案例": case,
        "对应习题1": ex1,
        "对应习题2": ex2,
        "课件来源": source,
        "所在章节及页码": f"第{page_no}页",
        "老师认定盖戳": "待教师确认",
    }


def acceptable_title(line):
    line = norm(line)
    if not line or not (3 <= len(line) <= 40):
        return False
    if META_TITLE.search(line):
        return False
    if line.startswith(("•", "·", "-", "—", "（1）", "1.", "1、", "一、", "二、")):
        return False
    # 跳过联系方式/纯数字（教师电话、学号、页码等）
    if "@" in line or re.search(r"\d{7,}", line) or re.search(r"\d{3,}-\d{3,}", line):
        return False
    # 讨论/思考题/设问不是知识点标题
    if "？" in line or "?" in line:
        return False
    if line.startswith(("讨论", "思考", "问答", "你", "哪些同学", "我们", "大家", "请", "试", "简述", "列举")):
        return False
    if re.fullmatch(r"[\d\s\-+/]+", line):
        return False
    return True


def subsection_blocks(doc, start, end):
    """章节内按编号子标题切块；无编号则返回整章单块。"""
    blocks = []
    cur_title = None
    cur_body = []
    cur_page = start + 1
    for pi in range(start, end + 1):
        for ln in page_lines(doc, pi):
            m = SUBSEC_RE.match(ln) or SUBSEC_CN_RE.match(ln)
            if m:
                if cur_title is not None:
                    blocks.append((cur_title, clean(" ".join(cur_body)), cur_page))
                cur_title = clean(m.group(2))
                cur_body = []
                cur_page = pi + 1
            else:
                cur_body.append(ln)
    if cur_title is not None:
        blocks.append((cur_title, clean(" ".join(cur_body)), cur_page))
    return blocks


def slide_blocks(doc, start, end):
    """幻灯片形态：每页首行作标题，其余要点作正文；过滤管理/装饰页。"""
    blocks = []
    for pi in range(start, end + 1):
        lines = page_lines(doc, pi)
        if not lines:
            continue
        # 找首个可接受的标题行
        title_line = None
        title_idx = -1
        for idx, ln in enumerate(lines):
            if acceptable_title(ln):
                title_line = ln
                title_idx = idx
                break
        if title_line is None:
            continue
        body = clean(" ".join(lines[title_idx + 1:]))
        if META_BODY.search(body) and not META_TITLE.search(norm(title_line)):
            continue
        if len(body) < 10:
            # 仅有标题无正文，跳过（可能是过渡页）
            continue
        blocks.append((title_line, body, pi + 1))
    return blocks


def emit(blocks, source, chapter, seen, keep_projects=False):
    out = []
    for (title, body, pg) in blocks:
        atom = build_knowledge_atom(title, body, source, chapter, pg)
        if atom and atom["三级标题"] not in seen:
            seen.add(atom["三级标题"])
            out.append(atom)
        if keep_projects and PROJECT_RE.search(title + body) and len(body) >= 40:
            proj = re.sub(PROJECT_RE, "", title).strip() or title
            if proj not in seen:
                seen.add(proj)
                out.append({
                    "条目类型": "具体项目",
                    "主标题": source,
                    "一级标题": chapter,
                    "二级标题": proj,
                    "三级标题": proj,
                    "项目分类": "教学项目",
                    "对应知识点": title,
                    "概念定义": "",
                    "概念解释": "",
                    "对应案例": generate_case(proj, body, "project"),
                    "对应习题1": "【AI生成】请围绕本项目撰写实施方案，并说明调用的核心知识点。",
                    "对应习题2": "【AI生成】请复盘本项目中的关键决策、风险与可迁移经验。",
                    "课件来源": source,
                    "所在章节及页码": f"第{pg}页",
                    "老师认定盖戳": "待教师确认",
                })
    return out


def split_into_atoms(pdf_path, keep_projects=False):
    doc = pymupdf.open(pdf_path)
    source = Path(pdf_path).name
    outline = detect_outline_chapters(doc)
    atoms = []
    seen = set()

    if outline:
        # 教材/讲义：用大纲章节切块；某章切块数不足时退化为按页首行切片
        for (ch, s, e) in outline:
            blocks = subsection_blocks(doc, s, e)
            if len(blocks) < 2:
                blocks = slide_blocks(doc, s, e)
            atoms += emit(blocks, source, ch, seen, keep_projects)
    else:
        # 无大纲（多为幻灯片课件）："第X章"常集中在目录页，章节探测不可靠，
        # 直接按全文档每页首行切片，得到稳定的首稿。
        atoms += emit(slide_blocks(doc, 0, doc.page_count - 1),
                       source, Path(pdf_path).stem, seen, keep_projects)
    return atoms


def main():
    ap = argparse.ArgumentParser(description="将 PDF 课件启发式拆分为 atoms.json（端到端首稿）")
    ap.add_argument("--pdf", required=True, help="课件 PDF 路径")
    ap.add_argument("--out", required=True, help="输出 atoms.json 路径")
    ap.add_argument("--keep-projects", action="store_true", help="尝试抽取具体项目条目")
    args = ap.parse_args()

    atoms = split_into_atoms(args.pdf, keep_projects=args.keep_projects)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(atoms, ensure_ascii=False, indent=2), encoding="utf-8")
    n_k = sum(1 for a in atoms if a["条目类型"] == "知识点")
    n_p = sum(1 for a in atoms if a["条目类型"] == "具体项目")
    print(json.dumps({"atoms": len(atoms), "知识点": n_k, "具体项目": n_p, "out": str(out)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
