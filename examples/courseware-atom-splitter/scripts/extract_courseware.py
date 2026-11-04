#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_courseware.py — 课程课件按页提取（保留来源文件名与页码）

将 PDF 课件逐页提取为结构化 JSON，便于后续按章节/页码回溯拆分知识点。
每行原子记录都能追溯到“课件来源”与“所在章节及页码”。

依赖: pymupdf
  pip install pymupdf

用法:
  python extract_courseware.py <课件.pdf> <输出.json>

输出 JSON 结构:
  {
    "source": "<文件名>",
    "page_count": N,
    "pages": [ {"page": 1, "title": "...", "text": "..."}, ... ]
  }

注: 若课件为 PPT/PPTX，可先用 libreoffice 或 pandas 转 PDF 后再提取；
    本脚本只处理 PDF，保持确定性、零弹窗。
"""
import json
import re
import sys
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


def extract(src: Path, out: Path) -> None:
    doc = pymupdf.open(src)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        # 清洗：全角空格转半角、项目符号独立成行、压缩多余空白
        text = text.replace("　", " ").replace("•", "\n• ")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        lines = [x.strip() for x in text.splitlines() if x.strip()]
        meaningful = [x for x in lines if not re.fullmatch(r"\d+", x)]
        title = meaningful[0] if meaningful else f"第{i+1}页"
        pages.append({"page": i + 1, "title": title, "text": text})
    out.write_text(
        json.dumps(
            {"source": src.name, "page_count": len(pages), "pages": pages},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"{src.name}: {len(pages)} pages -> {out}")


def main() -> None:
    if len(sys.argv) < 3:
        sys.stderr.write("用法: python extract_courseware.py <课件.pdf> <输出.json>\n")
        sys.exit(1)
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.parent.mkdir(parents=True, exist_ok=True)
    extract(src, out)


if __name__ == "__main__":
    main()
