# courseware-atom-splitter · 课件原子知识点拆分

> **一句话**：把课程课件（PDF/PPT）拆成可独立统计、检索、复用的**原子知识点**与**具体项目**，默认沉淀为**八表知识基座 Excel**，并保留一条可回溯到课件原文页码的证据链。

适用于：线上教育平台知识基座、课程知识图谱、可检索习题库、教学案例与习题生成。

- 版本：`2.0` ｜ 作者：杜同学
- 触发词：`课件拆分`、`原子知识点`、`知识点萃取`、`课件转知识库`、`教学案例生成`、`习题库`

---

## 一、这个 skill 解决什么问题

课程资料通常是几百页 PDF 加散落的作业题，直接检索困难、结论难以回溯出处、也难以复用到另一门课。本 skill 把这个过程固化成一条可复现的流水线：

```
课件 PDF  →  逐页提取（保留页码）  →  原子拆分  → 〔可选 LLM 精修〕 →  八表知识基座 Excel  →  结构校验
                                     └→ 案例 / 习题扩写（可选双页轻量版）
```

**核心设计**：所有 AI 生成的判断（知识类型、认知标签、关系、案例、习题）一律标注为**候选 / 待教师确认**，教师审核列初始留空，由人工盖戳认定。

---

## 二、快速开始

### 1. 安装依赖

```bash
python -m pip install pymupdf openpyxl
# 可选：需要 LLM 精修时才装
python -m pip install openai
```

需要 Python 3.10+。其余均为标准库。

### 2. 一条命令跑完（推荐）

```bash
python scripts/from_pdf_to_kb.py --pdf <课件.pdf> --out <知识基座.xlsx>
```

常用参数：

| 参数 | 说明 |
|---|---|
| `--pdf` | 输入课件 PDF（必填） |
| `--out` | 输出八表 xlsx（必填） |
| `--config` | 课程专属配置 JSON；**不传即零配置通用模式** |
| `--keep` | 保留中间产物（`.pages.json` / `.atoms.json`），便于人工精修 |
| `--refine` | 调用 LLM 精修定义 / 案例 / 习题，需 `KB_LLM_API_KEY`；无密钥自动跳过 |
| `--work-dir` | 中间产物目录 |
| `--no-projects` | 拆分时跳过「具体项目」类目 |

课程专属模式（关系与认知标签更贴合）：

```bash
python scripts/from_pdf_to_kb.py --pdf <课件.pdf> --out <知识基座.xlsx> \
    --config references/strategic-management-kb-config.json --keep
```

### 3. 校验

```bash
python scripts/validate_knowledge_base.py <知识基座.xlsx>
# 已知预期行数时可加：--expect 原始拆分归档=192 原子知识点=153
```

校验八表顺序、ID 唯一、引用完整性（关系 / 映射 / 评价 / 审核无悬空）、双轨标注与必填字段；异常时退出码 1。

---

## 三、两种产物档位

| 档位 | 工作表 | 默认 |
|---|---|---|
| **知识基座档**（Step 1–8） | 八表：原始拆分归档 / 原子知识点 / 知识关系 / 案例与项目 / 案例知识映射 / 教学评价 / 审核与学习证据 / 填写说明 | ✅ 默认 |
| **基础档**（Step 1–7） | 拆分结果 + 填写说明 | 仅当用户明确说「只要两页 / 基础档」 |

八表主表 `原子知识点` 共 **21 列**，含核心机制、适用边界、非适用条件、常见误区、前置知识、迁移场景、认知价值标签、原文证据摘录、审核状态。关系类型支持 `前置 / 组成 / 因果 / 对比 / 应用 / 同构`；审核状态枚举 `AI候选 / 待教师确认 / 教师已确认 / 需要修订`。完整字段定义见 `references/knowledge-base-schema.md`。

---

## 四、目录结构

```
courseware-atom-splitter/
├── README.md                                  # 本文件
├── SKILL.md                                   # 工作流 Step 0–8、关键规则、约束
├── references/
│   ├── field-schema.json / .md                # 15 列结构、两套默认值、分类枚举、29 条规则
│   ├── example-strategic-management.md        # 真实跑通的《战略管理》few-shot 样例
│   ├── knowledge-base-schema.md               # 八表结构、字段、关系类型、审核枚举
│   └── strategic-management-kb-config.json    # 领域配置（换课程替换此文件）
└── scripts/
    ├── from_pdf_to_kb.py                      # 一键总入口
    ├── extract_courseware.py                  # PDF 逐页提取（保留 source + page）
    ├── split_pdf_to_atoms.py                  # 启发式原子拆分首稿
    ├── refine_atoms.py                        # 可选：LLM 精修
    ├── expand_case_exercise.py                # 案例 / 习题扩写 + 防重复
    ├── prepare_sheet.py                       # 双页轻量版 CSV
    ├── build_knowledge_base.py                # 原子记录 → 八表 Excel
    ├── validate_atoms.py                      # 基础档质量校验
    └── validate_knowledge_base.py             # 八表结构与引用完整性校验
```

---

## 五、换一门课怎么用

**最简做法：不传 `--config`。** 脚本用内置通用规则判断知识类型、按章节顺序生成前置关系、按名称嵌套补组成关系、依关系拓扑推断认知标签；找不到转录本时证据列降级为「待人工补录」而不报错。

需要更贴合领域时，复制 `references/strategic-management-kb-config.json` 改四处即可，**脚本不用改**：

| 配置项 | 作用 |
|---|---|
| `knowledge_type_keywords` | 知识类型判定词表 |
| `cognitive_tags` | 核心 / 门槛 / 纽结 / 普通支撑 词表 |
| `component_relations` / `contrast_relations` / `application_relations` | 组成 / 对比 / 应用关系 |
| `pdf_pages` | 课件页码映射 |

**回填原文证据**：把每份课件的转录本命名为 `<课件来源文件名>.pages.json` 放进 `--pdf-dir`，脚本按文件名自动匹配对应原文片段与页码。

### 通用模式的质量预期

| 维度 | 推断方式 | 稳定性与边界 |
|---|---|---|
| 可复现性 | 纯确定性规则，不调用 LLM | ✅ 同一份 `atoms.json` 输出完全一致，无随机性 |
| 前置关系 | 章节内知识点按出现顺序两两相连 | ⚠️ 表达的是**课件讲解顺序**，不等于严格逻辑依赖；无大纲 PDF 会退化为整章一条长链 |
| 组成关系 | 同章内标题字符串包含（A 是 B 的子串且长度差 ≥2） | ⚠️ 保守规则，会漏判同义维度，也可能因标题噪声误判 |
| 认知标签 | 知识类型 + 关系出/入度拓扑打分 | ⚠️ 一律为「待教师确认」候选，核心 / 门槛 / 纽结仅作优先级参考 |
| 原文证据 | 按文件名匹配 `pages.json` | 无转录本时降级为「待人工补录」，不报错 |

**结论**：通用模式适合**快速产出结构化底稿**，不适合直接当定论；正式入库前须走精修 + 教师盖戳。这与第六节的「两档质量」是同一件事的两个侧面。

### 内置通用词表的边界

`build_knowledge_base.py` 的 `GENERIC_CONFIG["knowledge_type_keywords"]["model"]` 目前含少量战略管理示例词（五力 / BCG / SWOT / 价值链 / EFE / IFE / QSPM / 平衡计分卡）。它们**仅在零配置模式生效**；传入专属 `--config` 时脚本完全使用配置里的词表，不受影响。换课时若发现领域词不适用，复制配置覆盖 `knowledge_type_keywords` 即可，**无需改脚本**。

---

## 六、两档质量（务必分清）

| 档位 | 怎么得到 | 内容质量 |
|---|---|---|
| **自动首稿** | 直接 `from_pdf_to_kb.py`，不加 `--refine` | 八表齐全、噪声已过滤、证据已回填；案例与习题为规则生成的 AI 候选，标注「待教师确认」 |
| **精修八表** | ① 已有精修 `atoms.json` → 直接 `build_knowledge_base.py`；② 加 `--refine` 且配置密钥；③ 由 Agent 逐条精修 | 定义 / 案例 / 习题经大模型打磨，认知标签与关系经校准 |

捷径（已有精修底稿时最快）：

```bash
python scripts/build_knowledge_base.py --atoms <atoms.json> \
    --config references/strategic-management-kb-config.json \
    --pdf-dir <pages.json 目录> --out <知识基座.xlsx>
```

> 纯脚本首稿是「确定性规则 + 全角归一化 + 噪声过滤」的产物，**不能替代人工 / 大模型精修**。

---

## 七、内容纪律

- **两套 Schema**：知识点用「主标题 / 二级 / 三级 / 定义 / 解释」；具体项目用「一级 / 二级 / 项目分类 / 对应知识点」。`不适用`（不属于该类型）与 `待补充`（课件缺失）严格区分。
- **标注纪律**：来源案例标 `【来源：文件；章节页码】`，AI 内容标 `【AI生成】`，习题必标。
- **不推测**：课件未提供的案例、习题、结论一律不补写。
- **盖戳留空**：教师审核列初始全空，AI 不填。
- **不拆**：课程行政信息、教师联系方式、纯装饰页。

---

## 八、已知限制

| 限制 | 说明 |
|---|---|
| 无大纲课件 | 纯脚本拆分依赖 PDF 大纲与编号子标题；**无大纲且无编号的扫描件会退化为「整章一条」**，需走 AI 人工精修链路 |
| 原文证据 | 无转录本时证据列降级为「待人工补录课件原文摘录」，不报错但不完整 |
| 平台专有步骤 | SKILL.md 的 Step 5（双页 Excel 写入）与 Step 6（发布腾讯共享表）依赖 WorkBuddy 的 `workbuddy-sheet-generation` / `workbuddy-local-office-edit` / `tencent-docs` 技能；**八表主链路不依赖这些**，纯 openpyxl 即可跑通 |
| LLM 精修 | `--refine` 需 `KB_LLM_API_KEY`（可选 `KB_LLM_BASE_URL` / `KB_LLM_MODEL`）；无密钥自动跳过并保留首稿 |

> Step 5 / Step 6 已在 `SKILL.md` 中显式标注为**平台可选步骤**；脱离 WorkBuddy / 腾讯环境时直接跳过，八表主链路（提取 → 拆分 → 建表 → 校验）完全由本地脚本 + `openpyxl` 跑通。

### 公开仓库提交前的隐私与资料检查

本次对本包 16 个文件做了实测扫描：

| 检查项 | 结果 |
|---|---|
| 邮箱 / 手机号 / 身份证号 | **0 处** |
| 本机绝对路径 / 内部文件路径 | **0 处** |
| 学生姓名 / 教师联系方式 / 成绩名单 | **0 处** |
| 外部 URL | 仅 `https://api.openai.com/v1`（LLM 精修的标准 API 端点） |

**保留（非隐私，公开仓库常规做法）**
- `SKILL.md` frontmatter `author: "杜同学"`：贡献者署名；
- `agent_created: true`：工具侧元数据，无个人信息。

**课程资料授权说明（维护者审核时请留意）**
- 《战略管理》课程名与两份课件 PDF 文件名，出现在 `SKILL.md`、`field-schema.json`、`strategic-management-kb-config.json`、`example-strategic-management.md` 共 4 个文件中，仅作为演示样例与配置示例；
- `example-strategic-management.md` 含少量课件原文案例摘录。本 skill 的工具代码为本次原创贡献，课程资料只用于方法演示、未复制完整课件；若维护者认为授权不明，可将样例替换为虚构课程数据，不影响脚本功能。

**明确不入库**：课件原文 PDF、学生作业提交物（含姓名/学号）、任何成绩或名单文件。本 PR 只提交 skill 本身。

---

## 九、验证记录

| 场景 | 结果 |
|---|---|
| 内置实战样例 | 两份《战略管理》PDF → **192 条原子记录**（知识点 153 + 具体项目 39），双页 Excel + 共享表 |
| 同课程复用（无大纲 PDF） | **233 知识点 / 221 关系 / 11 具体项目**，八表齐全，`validate_knowledge_base.py` **0 错误**，原文证据回填 **233/233** |
| 零配置通用模式 | 可跑通；认知标签由关系拓扑推断，证据列按约定降级 |

---

## 十、安装、许可与相关说明

**安装**（完整命令与字段见 SkillMarket 目录条目 `registry/skills/courseware-atom-splitter.json`）

本站安装器（推荐，Claude Code · 项目级）：

```bash
git clone --depth 1 --branch main https://github.com/THU-MEM/SkillMarket.git .skillmarket-install
node .skillmarket-install/scripts/install-skill.mjs --skill courseware-atom-splitter --agent claude-code --scope project
```

手动安装：把本目录整体复制到所用 Agent 的项目级 `skills/` 目录，保持 `SKILL.md` 位于目录根部。安装阶段只复制文件、不执行包内脚本；交给 Agent 使用前请先自行审阅 `scripts/`。

**许可**：本 skill 作为 SkillMarket 仓库的原创贡献，按仓库贡献条款采用 **Apache-2.0**，完整许可文本见仓库根目录 `LICENSE`。运行期依赖 `pymupdf` / `openpyxl` / `openai` 各自遵循其上游许可。

**相关说明**

- 本目录**只包含 skill 本身**；《战略管理》拆分成果（八表 xlsx、逻辑树 HTML、素材清单 HTML）不在本仓库内，另行走发布流程。
- 完整工作流细节、Step 0–8、字段枚举与约束以 `SKILL.md` 与 `references/` 下的文件为准；本 README 为快速上手导读。
