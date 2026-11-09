---
name: courseware-atom-splitter
displayName: 课件原子知识点拆分
author: "杜同学"
description: 将课程课件（PDF/PPT）拆解为可独立统计、检索、复用的原子知识点与具体项目，并默认沉淀为**八表知识基座 Excel**（原始归档/原子知识点/知识关系/案例项目/映射/双轨评价/审核证据/填写说明），同时兼容两页轻量版（拆分结果+填写说明）。用于线上教育平台知识基座、课程知识图谱、可检索习题库。当用户要"拆书为知识点""课件转知识库""建知识网络""生成教学案例与习题"时使用。
trigger_words:
  - 课件拆分
  - 原子知识点
  - 知识点萃取
  - 课件转知识库
  - 教学案例生成
  - 习题库
version: "2.0"
agent_created: true
---

# 课件原子知识点拆分

将课程课件拆解为可独立统计、检索、复用的原子单元，并默认沉淀为**八表知识基座 Excel**（从内容台账升级为教学知识网络），同时兼容两页轻量版（拆分结果 + 填写说明）。最终可发布为腾讯共享表格，作为线上教育平台知识基座。

本技能沉淀自一次真实跑通的任务：把两份《战略管理》PDF 课件拆成 192 条原子记录（知识点 153 + 具体项目 39），并完成完整案例扩写与 AI 习题生成。

## 一、何时使用

- 用户给出课程课件（PDF/PPT）并要求"拆分知识点""转知识库""建知识基座""生成教学案例与习题"。
- 用户要求输出结构化、可统计、可检索的原子知识点表格。
- 用户要求把拆分结果升级为"知识网络"（证据—原子—关系—案例—双轨评价—学习证据）。
- 用户要求发布为腾讯共享 Excel 或在线协作文档。

## 二、产物形态（默认知识基座档；可选基础档）

> **默认执行 Step 1–8，产出八表知识基座。** 仅当用户明确说"只要两页 / 基础档 / 轻量版"时，停在 Step 7 产出双页。

| 档位 | 工作表 | 角色 | 默认 |
|---|---|---|---|
| 知识基座档（Step 1–8） | 八张工作表（见下） | 从内容台账升级为教学知识网络 | ✅ 默认 |
| 基础档（Step 1–7） | 拆分结果 + 填写说明 | 原子知识明细主表（逐行一条，15 列）+ 拆分规则 | 仅用户要求时 |

**知识基座档八张表**（Step 8 生成，详见 `references/knowledge-base-schema.md`）：

| 工作表 | 角色 |
|---|---|
| 原始拆分归档 | 上一版全部原子记录，完整保留不覆盖 |
| 原子知识点 | 知识网络主表（21 列：机制/边界/误区/认知标签/原文证据） |
| 知识关系 | 前置/组成/对比/应用等候选关系 |
| 案例与项目 | 独立案例/项目资产，含 PBL 四步 |
| 案例知识映射 | 资产↔知识点多对多映射 |
| 教学评价 | 每节点双轨评价（无AI轨/有AI轨） |
| 审核与学习证据 | 教师审核 + 学生验证动态记录 |
| 填写说明 | 全部规则与枚举 |

> 不要增加用户未要求的图表、透视表、公式或额外工作表。

## 三、Workflow

> **默认决策**：除非用户明确要求"基础档 / 两页 / 轻量"，否则跑完 Step 1–8，交付八表知识基座。
>
> **⚠️ 执行纪律（最高优先级）**：用户只给一个或多个 PDF、要"拆分/建知识库/出八表/一步生成"时，**只能调用 `scripts/from_pdf_to_kb.py` 一条命令**，不要手动走 Step 1–7 先出双页再"升级"。手动分步极易停在双页两表。若工作区已有精修版 `atoms.json`（案例与习题已补全），则**直接调用 `build_knowledge_base.py`**（跳过拆分），这是最快拿到"补充完毕的原子知识 + 完整八表"的方式。

### 总入口：一条命令从 PDF 到八表（推荐）

用户只给一个 PDF、要直接拿到最终结果时，用总入口脚本串联 Step 1–8，无需中间干预：

```bash
# 任意课程，零配置（自动推断关系与认知标签）
python scripts/from_pdf_to_kb.py --pdf <课件.pdf> --out <知识基座.xlsx>

# 已沉淀课程的专属配置（如战略管理），标签与关系更贴合
python scripts/from_pdf_to_kb.py --pdf <课件.pdf> --out <知识基座.xlsx> \
    --config references/strategic-management-kb-config.json

# 保留中间产物（<课件名>.pages.json / <课件名>.atoms.json）便于人工精修
python scripts/from_pdf_to_kb.py --pdf <课件.pdf> --out <知识基座.xlsx> --keep

# 大模型精修（可选）：拆分后调用 LLM 把首稿案例/习题/定义打磨为"精修"质量
# 需配置 KB_LLM_API_KEY（及可选 KB_LLM_BASE_URL / KB_LLM_MODEL）；无密钥则自动跳过，保留首稿。
python scripts/from_pdf_to_kb.py --pdf <课件.pdf> --out <知识基座.xlsx> --keep --refine
```

总入口内部依次执行：`extract_courseware.py` 提取 → `split_pdf_to_atoms.py` 启发式原子拆分（首稿）→（可选 `refine_atoms.py` 大模型精修）→ `build_knowledge_base.py` 建八表 → `validate_knowledge_base.py` 校验。

**两种质量档位（务必向用户讲清）：**

| 档位 | 怎么得到 | 内容质量 |
|---|---|---|
| **完整八表（自动首稿）** | 直接 `from_pdf_to_kb.py`，不加 `--refine` | 八表齐全、噪声已过滤、课件原文证据已回填；案例与习题为规则生成的 AI 候选（标注"待教师确认"） |
| **精修八表** | ① 已存在精修 `atoms.json` → 直接 `build_knowledge_base.py`；或 ② 加 `--refine` 且配置了 LLM 密钥；或 ③ 把 PDF 交给 Agent 由大模型逐条精修 | 定义/案例/习题经大模型打磨、贴合真实情境，认知标签与关系经校准 |

> 纯脚本首稿是"确定性规则 + 全角归一化 + 噪声过滤"的产物，**不能替代人工/大模型精修**。要拿到可发布的精修八表，优先用已精修的 `atoms.json` 直接建八表（见下方捷径），或配置密钥开启 `--refine`。

原子拆分首稿的所有内容标注 AI候选 / 待教师确认；教师可在导出的 `atoms.json` 上精修后，单独重跑 `build_knowledge_base.py`。

**捷径：已有精修 atoms.json 时直接建八表（推荐用于本项目）**

若工作区已存在案例与习题已补全的 `atoms.json`（例如本项目的 `.workbuddy/atoms.json`），不要重新拆分，直接用 `build_knowledge_base.py`：

```bash
# 战略管理专属（含原文证据回填）：产出"补充完毕的原子知识 + 完整八表"
python scripts/build_knowledge_base.py \
  --atoms .workbuddy/atoms.json \
  --config references/strategic-management-kb-config.json \
  --pdf-dir .workbuddy \
  --out 战略管理知识基座_完整八表.xlsx
```

这条路径跳过了"再拆一遍"的噪声，直接把你已经认可的 153 条知识点 + 已补全的 AI 案例/习题升级为八表。

> 适用边界：纯脚本拆分依赖 PDF 大纲与编号子标题，对排版规范的课件效果较好；无大纲且无编号的扫描件会退化为"整章一条"。需要高颗粒度人工拆分时，仍走下方 Step 1–7 由 AI 完成并人工精修，再用总入口的 `--keep` 产物或直接用 `build_knowledge_base.py` 升级。

### Step 0 配置课程参数

复制 `references/field-schema.json` 到工作目录并修改三处：
- `main_title`：知识点行统一填写的课程名（如"战略管理"）。
- `source_filenames`：本次课件文件名列表。
- `chapter_entity_map`：章节名 → AI 生成案例时用的行业/主体（无则退回 `default_entity`）。

字段结构、规则、分类枚举已内置于该 JSON，无需改动即可复用；仅上述三项按课程替换。

### Step 1 提取课件（保留来源与页码）

对每份 PDF 运行 `scripts/extract_courseware.py`：

```bash
python scripts/extract_courseware.py "<课件.pdf>" "<课件名>.pages.json"
```

依赖 `pymupdf`：使用已装该包的 Python 解释器（如隔离 venv `...\binaries\python\envs\default\Scripts\python.exe`），若缺失先 `python -m pip install pymupdf`。输出逐页 JSON，含 `source`（文件名）与 `page`（页码），供后续"课件来源 / 所在章节及页码"回溯。PPT/PPTX 先转 PDF 再提取。

### Step 2 拆分为原子记录（核心，人工 + AI）

逐页阅读提取文本，按 `references/field-schema.md` 第二节的**两套 Schema** 拆分：

- **知识点**：`条目类型=知识点`，填 主标题/二级标题(模块)/三级标题(概念)/概念定义/概念解释/课件来源/所在章节及页码；一级标题、项目分类、对应知识点 填"不适用"。
- **具体项目**：`条目类型=具体项目`，填 一级标题/二级标题(项目名)/项目分类/对应知识点/概念解释/课件来源/所在章节及页码；主标题、三级标题、概念定义 填"不适用"。

每条记录写入一个 JSON 数组（`atoms.json`），字段键同 15 列顺序。遵守拆分标准：
- 原子性、最小完整语义、颗粒度一致；
- 仅依据课件明确内容，不补写未提供结论；
- 多份课件重复的同一知识点合并为一条并标多来源；
- 课件未提供案例/习题/必要信息 → 字段填"待补充"（不得用常识推断）；
- "老师认定盖戳"**始终留空**。

> 建议先用 `extract_courseware.py` 的索引快速定位章节，再批量生成 `atoms.json`。

### Step 3 扩写案例与习题（AI 辅助，规范标注）

运行 `scripts/expand_case_exercise.py`：

```bash
python scripts/expand_case_exercise.py atoms.json references/field-schema.json
```

脚本对每条记录：
- **对应案例**：若原"对应案例"非"待补充"（课件有线索）→ 基于原案例名与解释扩写为完整段落（主体/情境 → 冲突 → 结果/影响 → 知识点映射），文末标 `【来源：<课件来源>；<所在章节及页码>】`；若为"待补充" → 生成教学示例，文末标 `【AI生成】`，并注明非课件原始案例、需教师认定。
- **对应习题1**：偏概念辨析/简答，文末标 `【AI生成】`。
- **对应习题2**：偏综合应用/案例分析，文末标 `【AI生成】`。

脚本内置**防重复**（已标注则跳过），可直接重跑；校验不通过会报错退出。

### Step 4 生成双页写入数据

运行 `scripts/prepare_sheet.py`：

```bash
python scripts/prepare_sheet.py atoms.json references/field-schema.json <输出目录> [<xlsx绝对路径>]
```

产出 `results.csv`（拆分结果）、`instructions.csv`（填写说明，含 `{main_title}` 占位替换）、以及可选的本地编辑写参 `write_results.json` / `write_instructions.json`。

### Step 5 生成并填充 Excel

> **平台可选步骤**：本步依赖 WorkBuddy 侧的 `workbuddy-sheet-generation` / `workbuddy-local-office-edit` 技能，仅在「基础档两页」路径需要。默认「知识基座档」的八表由 `build_knowledge_base.py` 用纯 `openpyxl` 生成，**不依赖任何平台专有能力**；脱离 WorkBuddy 环境时，可直接用 `prepare_sheet.py` 产出的两个 CSV 自行建表，或跳过基础档。

1. 用 `workbuddy-sheet-generation` 或 `create_blank_xlsx` 创建双页 xlsx（表名"拆分结果""填写说明"）。
2. 用 `workbuddy-local-office-edit` 的 `sheet_set_range_value_by_csv` 把两个 CSV 写回对应 sheet（id 通常 000001 / 000002）。
3. 设置格式：表头背景 `#660874`、白字、加粗、居中；数据区自动换行、顶端对齐；冻结首行、开启自动筛选、细浅灰边框；按字段宽度分配列宽。
4. 保存。

### Step 6 发布为腾讯共享 Excel（可选）

> **平台可选步骤**：依赖 `tencent-docs` 技能，仅用于「发布在线共享链接」这一交付形式。本 skill 的核心产物是本地 xlsx，跳过本步不影响八表生成、校验与内容完整性；在通用 GitHub / 非腾讯环境中请直接忽略本步。

使用 `tencent-docs` 技能：将本地 xlsx 通过 `import_file.py` 或直接 `manage.async_import` 导入，获取共享链接。

```bash
python <tencent-docs>/import_file.py "<本地xlsx路径>"
```

导入后返回腾讯文档链接，交付用户。

### Step 7 质量校验

运行 `scripts/validate_atoms.py atoms.json`：检查"待补充"残留、案例标注（来源/AI生成）、习题【AI生成】结尾、标点误接、盖戳非空、案例长度。异常非零则退出码 1，需修正后重跑 Step 3–6。

### Step 8 生成知识基座（八表，默认执行）

> 默认在 Step 7 之后自动执行；除非用户只要基础档两页。

在 Step 2 产出的 `atoms.json` 基础上，运行 `scripts/build_knowledge_base.py`。**`--config` 现在为可选项**，因此任何课程都能直接跑出八表，不必先准备专属配置。

**通用模式（推荐先用，零配置，任意课程均可）**

```bash
python scripts/build_knowledge_base.py \
  --atoms <atoms.json> \
  --out <知识基座.xlsx>
```

不传 `--config` 时自动进入通用模式，脚本用内置通用规则产出八表：
- 通用知识类型关键词（模型/框架、方法/流程、原则、机制、准则、概念…）判断知识类型；
- 按章节内顺序自动生成"前置"关系；按同章名称嵌套自动补"组成"关系；
- 基于知识类型 + 关系拓扑自动推断认知标签（核心/门槛/纽结/普通支撑，均标"待教师确认"）；
- 不传 `--pdf-dir` 或找不到转录本时，原文证据列降级为"待人工补录课件原文摘录"（不报错）。

若想回填原文证据，把每份课件的 pages json 命名为 `<课件来源文件名>.pages.json` 放入 `--pdf-dir` 目录即可自动匹配（例如 `战略管理-1_认识战略.pdf.pages.json`）。

**课程专属模式（已有领域配置，结果更贴合）**

```bash
python scripts/build_knowledge_base.py \
  --atoms <atoms.json> \
  --config references/strategic-management-kb-config.json \
  --pdf-dir <存放 intro_pages.json/full_pages.json 的目录> \
  --out <知识基座.xlsx>
```

脚本做五件事：
1. **原始归档**：完整保留 `atoms.json` 全部记录与 15 列。
2. **原子知识点**：为每个知识点生成稳定 ID、知识类型、核心机制、适用边界、非适用条件、常见误区、前置知识、迁移场景、认知价值标签与候选理由、课件原文证据摘录。
3. **知识关系**：自动生成同章顺序（前置）、组成（专属配置或同章嵌套）、对比/应用（专属配置）。
4. **案例与项目 + 映射**：把对应案例/具体项目转为独立资产，建立多对多映射。
5. **双轨评价 + 审核证据**：每知识点生成无AI轨/有AI轨习题与审核记录。

课程专属规则（认知标签词表、组成/对比/应用关系、知识类型关键词、PDF 页映射）全部外置在领域配置 JSON 中。**换课程最简做法：直接不传 `--config` 用通用模式先出八表；若要更贴合，复制 `strategic-management-kb-config.json` 改为本课程的词表与关系即可，脚本不用改。**

生成后运行校验：

```bash
python scripts/validate_knowledge_base.py <知识基座.xlsx> --expect 原始拆分归档=192 原子知识点=153
```

校验八表顺序、ID 唯一、引用完整性（关系/映射/评价/审核无悬空）、双轨标注与必填字段。`--expect` 仅当行数已知时填，未知可省略。

## 四、关键规则速记

- **两表两套字段**：知识点用 主标题/二级/三级；项目用 一级/二级/项目分类/对应知识点。
- **"不适用" vs "待补充"**：不属于该条目类型 → 不适用；课件缺失但应有 → 待补充。
- **案例四要素**：主体/情境 → 关键决策或冲突 → 结果或影响 → 知识点映射。
- **标注纪律**：来源案例标 `【来源：文件；章节页码】`；AI 内容标 `【AI生成】`；习题必标 `【AI生成】`。
- **盖戳留空**：教师审核列初始全空，AI 不填。

## 五、资源索引

- `README.md`：面向使用者与 reviewer 的快速上手说明（依赖、命令、产物、换课配置、限制）。
- `references/field-schema.json`：列顺序、字段默认值、分类枚举、规则文本、章节实体映射（机器读）。
- `references/field-schema.md`：上述规则的权威人工说明。
- `references/example-strategic-management.md`：真实跑通的《战略管理》样例（few-shot）。
- `references/knowledge-base-schema.md`：八表知识基座结构、字段、来源层级与关系类型说明。
- `references/strategic-management-kb-config.json`：《战略管理》领域配置（认知标签词表/组成/对比/应用关系/知识类型关键词/PDF页映射），换课程替换此文件即可。
- `scripts/extract_courseware.py`：PDF 按页提取。
- `scripts/split_pdf_to_atoms.py`：由 PDF 启发式拆分为 atoms.json（端到端首稿，无需大模型）。
- `scripts/from_pdf_to_kb.py`：一键端到端总入口（提取→拆分→建八表→校验）。
- `scripts/refine_atoms.py`：可选大模型精修（总入口 `--refine` 调用，需 `KB_LLM_API_KEY`；无密钥自动跳过，保留首稿）。
- `scripts/expand_case_exercise.py`：案例/习题扩写 + 防重复 + 校验。
- `scripts/prepare_sheet.py`：生成双页 CSV 与本地编辑写参。
- `scripts/validate_atoms.py`：基础档质量校验。
- `scripts/build_knowledge_base.py`：原子记录 → 八表知识基座 Excel。
- `scripts/validate_knowledge_base.py`：知识基座结构与引用完整性校验。

## 六、约束

- 不推测课件未提供的案例、习题或结论；缺失统一标"待补充"。
- 不把课程行政信息、教师联系方式、纯装饰页拆为知识点。
- AI 生成的案例/习题为教学辅助，正式纳入知识基座前须教师用"盖戳"列认定。
