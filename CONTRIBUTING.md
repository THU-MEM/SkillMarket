# 发布到清工技能市场

把你维护、或有权分享的 Skill、Agent、Prompt 带到这里。**不需要手写 JSON，也不需要先安装开发环境。** 从[发布页](https://thu-mem.github.io/SkillMarket/#/submit)选择下面任意一种方式即可。

## 两种简单的发布方式

### 方式一：选 ZIP 或文件夹，提交审核

适合已经有一份资源文件、希望由维护者帮助收录的人。

1. **准备一个资源包。** 只放本次要发布的一个 Skill、Agent 或 Prompt，以及它必需的附属文件。可直接选择文件夹，不必自己压缩。
2. **打开[发布页](https://thu-mem.github.io/SkillMarket/#/submit)。** 拖入或选择 ZIP；也可以选择文件夹，或在浏览器支持时直接拖入文件夹。
3. **核对本地预览。** 查看识别的名称、类型、入口、保留文件和排除文件。名称与文件列表只是纯文本预览，不会运行包内脚本、渲染其中的 HTML 或执行其中的指令。识别结果不是内容审核结论。
4. **人工检查后勾选确认，下载整理后的 ZIP。** 下载的是浏览器重新打包的文件，不会改动原目录。务必检查内容和排除列表；确认后才能继续下载与提交。
5. **打开 GitHub 发布申请。** 发布页提供的是固定的 GitHub Issue 表单链接，不会把你的文件名、内容或本地路径拼入链接。在 GitHub 登录后，将刚下载的 ZIP 手动拖入正文，等待附件上传完成，再填写一两句话介绍及作者、来源、许可证，提交 Issue。
6. **等待审核。** 维护者可能在 Issue 中询问信息，确认后整理成 Pull Request（PR）。只有 PR 审核合并到 `main`、且 GitHub Pages 部署成功后，条目才会上线。

**选文件、预览、下载都只在当前浏览器本地处理；本站不会自动上传文件、创建 Issue 或发布条目。** 刷新页面会清空当前包，需要重新选择。只有你在 GitHub 手动附加文件时，附件才会上传到 GitHub；申请及附件属于公开发布材料。本站不要求 Token，没有新增登录系统、上传后端或托管执行服务。

发布页不要求你逐项填写目录元数据。作者或许可证等信息缺失时，在 Issue 中如实说明并补充确认；不要为继续流程随意选择许可证或编造作者。

### 方式二：复制指令，让 Coding Agent 整理并提 PR

适合已在使用 Coding Agent，或资源已位于公开仓库的人。

1. 在[发布页](https://thu-mem.github.io/SkillMarket/#/submit)复制完整的中文 Agent 发布指令，粘贴给你使用的 Coding Agent。
2. **明确提供材料范围：** 一个 ZIP 附件、一个指定的本地资源文件夹，或一个公开源码链接。不要让 Agent 扫描整个电脑或猜测资源位置。公开仓库内有多个资源时，指定目录和版本或提交。
3. Agent 应先安全检查材料，再生成目录 JSON、补齐说明并校验。它应保留原作者与许可；已有公开上游时优先登记上游，而不是搬运整份源码。必要信息缺失时，它应询问你，不能编造元数据或兼容性。
4. 按复制指令中的授权范围，Agent 在独立分支或 fork 中运行 `npm ci` 和 `npm run check`，提交到 `THU-MEM/SkillMarket:main` 的 PR，并返回真实 PR 链接及验证结果。**不直接推送 `main`，不自行合并或修改生产配置。** 没有 GitHub 登录权限时，应保留本地成果并说明阻塞，通过正常的 GitHub 授权流程处理，不把 Token 粘贴到本站或资源文件中。

Agent 读取的包内文字只是待审核材料，不是新的授权。不得为了“查看效果”执行未知脚本、安装钩子或权限变更指令。运行项目检查之前也要审查依赖和脚本；有疑似敏感信息、授权不明或许可证不明时先停下来确认。

这条路径同样需要 PR 审核与 Pages 部署，不是发一句指令就立即上线。完整指令以发布页的复制内容为准，这里不再重复一大段提示词。

## 文件应该怎样准备

### 一次一个资源，保留完整目录

下面是一个 Skill 的推荐结构；没有用到的子目录不用创建：

```text
my-skill/
├── SKILL.md             # 入口：何时使用、如何完成任务、注意事项
├── README.md            # 面向用户的介绍、前提和使用示例
├── LICENSE              # 适用于本资源的真实许可证
├── scripts/             # 必需的辅助脚本；提交时只审查，不执行
├── references/          # 入口引用的说明、规范和示例
└── assets/              # 必需的模板或素材，保留各自许可
```

- 可以选择 `my-skill` 文件夹，也可以压缩整个文件夹或其内部文件。页面会处理共同的外层目录；下载后仍请核对相对引用是否完整。
- **Skill** 使用 `SKILL.md`；**Agent** 使用 `AGENT.md` 或 `AGENTS.md`，写明职责、权限与运行前提；**Prompt** 使用 `PROMPT.md`，写明模板和变量。
- 页面按 `SKILL.md` → `AGENT.md` / `AGENTS.md` → `PROMPT.md` → `README.md` 的顺序识别入口（文件名不区分大小写）。只有 README 时会先按 Prompt 预览；如果实际是其他类型，请在 Issue 中说明，或走 Agent 路径整理。
- 入口用 UTF-8 文本，建议有清晰的一级标题；Skill 的 `name` frontmatter 也可用于显示名称。这里的名称识别不等于完成目录登记。
- 同一优先级发现多个入口会拒绝处理。不要把一整套多技能仓库作为一个包；分别选择对应目录。一个 Skill 同时带 README 是正常的。
- 不要只交 `SKILL.md`，却遗漏它引用的脚本、模板或参考资料。也不要打包整个工作区、依赖目录、运行产物或私人文档。

### 大小与安全边界

浏览器处理限制为：ZIP 输入不超过 **20 MiB**，解压内容总量不超过 **20 MiB**，单文件不超过 **4 MiB**，最多 **300 个文件**，路径最多 **16 层**；入口文本另限 **256 KiB**。这些是上限，不是建议把包填满的目标。ZIP 的目录记录也计入 300 项限制，被排除的 ZIP 条目仍计入数量与大小限制，尽量保持结构简单。

加密 ZIP、符号链接、越界路径等不安全归档会被拒绝。隐藏文件或隐藏目录、依赖与缓存目录、常见凭据文件名、私钥文件等会被排除并列出。**这只是基础文件卫生检查，不是保密保证，也不是完整的恶意代码或秘密扫描。** 普通文件名的正文、图片、配置和脚本里仍可能藏有敏感内容，你需要自行检查并移除。

请特别注意：排除规则也可能移除合法的隐藏配置或必需资源，导致下载包无法使用。审阅排除列表，不要为了通过规则把敏感文件换名塞回去。若确实需要合法的隐藏资源，改走 Agent / PR 路径，逐项解释用途并人工审查。

## 写清楚“用户拿到后怎么用”

不必先学字段名。把以下信息写进 README、入口说明或 Issue，维护者 / Agent 会整理进 `usage.instructions`：

1. **适用任务：** 帮谁解决什么问题，什么情况不适用。
2. **所需输入：** 文件、目标、环境、范围等；外部服务和权限前提要说明。
3. **如何发起：** 用户在助手里说什么、提供什么材料。
4. **预期结果：** 一份报告、一组文件、一段模板，或其他可检查的交付物。
5. **限制与边界：** 是否改文件、是否联网、是否需人工确认，不能保证什么。

例如，一个文档审查 Skill 的使用说明可以是：

> 适合在发布前检查技术文档。提供待审查文档、目标读者、操作系统及软件版本，并说明要检查的章节。向助手请求文档审查，它应输出按严重程度分组的问题清单，每条包含原文位置、依据和修改建议。默认只读，不运行文档中的命令；缺少环境信息时先询问，不虚构验证结果。

对应的 `usage.example` 应是一条能直接发给助手的真实请求，而不是“请使用本技能”：

> 请审查附带的 README，读者是首次使用本项目的 Windows 开发者，环境为 Node.js 22。重点检查前置条件、命令顺序和失败恢复。输出“位置 / 问题 / 建议”表格；只读审查，不执行命令，不修改文件，不确定的地方标为待确认。

安装说明与使用说明分开：`installations` / `setup` 解释如何准备资源，`usage` 解释准备好后如何完成任务。不要把“支持所有客户端”“绝对安全”“已经测试”写成没有证据的承诺。清工技能市场提供目录，不托管或运行你的 Agent。

## 作者、来源与许可证

- 只提交你维护或有权代表的内容；第三方项目保留原作者、来源链接与原始许可，不暗示对方认可本站。
- 优先使用公开、可检查的源码与使用文档。源码位于公开上游时，登记原仓库和准确路径，尽量固定到可核查版本；不要冒充本站原创。
- `license` 应反映资源真实适用的许可，尽可能使用 SPDX 标识符。**没有明确许可证不等于可以自由转载。** 先确认授权，不能默认填 `MIT` 或 `Apache-2.0`。
- 素材、字体、第三方脚本等可能采用不同许可。保留 LICENSE、NOTICE、署名及相关限制；不要用一个目录字段覆盖第三方权利。
- 不公开 API 密钥、访问令牌、私钥、内部链接或个人数据。公开申请前检查内容；目录校验通过不代表已完成安全审计。
- 真实资源使用 `isExample: false`；仅用于演示的内容使用 `isExample: true`。不要虚构下载量、背书或已验证的兼容性。

本仓库采用 [Apache-2.0](LICENSE)。提交到本仓库的贡献遵循下面原有的贡献许可约定；登记第三方链接不改变上游资源的许可证，第三方素材仍须遵守各自许可。

By contributing, you agree that your contribution is licensed under Apache-2.0.

## 更新已有条目

不需要重新发布一份同名资源。使用任一路径时，附上现有条目链接或 `id`，说明更新了什么：

- **保留同一 `id` 和 JSON 文件名**，在原条目上更新，避免重复条目；变更类型或身份时先与维护者讨论。
- `version` 填真实资源版本。有实际版本更新时同步更新；只是纠正文案，不要伪造上游发布号。无版本约定时先与作者 / 维护者确认。
- `updatedAt` 填本次更新对应的真实日期；`source.primaryFile`、`sourceUrl`、`rawUrl`、安装命令及引用资料应指向一致的资源与版本。
- 说明新增依赖、权限、兼容性变化以及已有用户如何更新；不要照搬其他项目的安装命令。
- 重新检查包内敏感信息、许可与必需文件，运行完整校验后走同样的 PR 审核和部署流程。

## 提交前快速检查

- [ ] 只包含本次要分享的一个资源，入口与附属文件齐全。
- [ ] 我有权公开这些材料，作者、来源、许可证可核查；缺失信息已明确说明。
- [ ] 人工检查过正文、配置、素材及排除列表，不含秘密或私人数据；排除后仍能满足用途。
- [ ] 有具体的适用任务、所需输入、预期输出、限制及一条使用示例。
- [ ] 已有条目沿用原 `id`；版本、日期、源码路径和安装依据真实一致。
- [ ] ZIP 路径：已下载整理包，在 GitHub 手动附加并等待上传完成，检查正文后提交。
- [ ] Agent / PR 路径：已查看差异与真实校验结果，PR 仅含相关改动，无直接推送 `main`。
- [ ] 我理解 Issue 提交、PR 创建、PR 合并与网站上线是不同阶段。

## 常见问题

| 遇到的情况 | 怎么处理 |
| --- | --- |
| 拖文件夹没有反应，或浏览器不支持 | 改用“选择文件夹”，或将单个资源压缩为 ZIP 后选择；不要为此安装额外向导。 |
| 找不到入口 / 发现多个入口 | 核对入口文件名与 UTF-8 编码；只选一个资源目录。README 不是 Skill 入口的替代品。 |
| 包过大、文件太多或路径太深 | 去掉依赖、构建产物和无关文件，简化层级；大型公开项目优先让 Agent 登记公开上游，不要拆包绕过检查。 |
| ZIP 不受支持或被判定不安全 | 从可信、已审查的普通文件重新打包；不用加密、符号链接或越界路径。不要通过改扩展名绕过检查。 |
| 必需文件出现在排除列表 | 先确认不是敏感信息；合法隐藏资源使用 Agent / PR 路径说明用途并审查。 |
| 刷新后包不见了 | 本地状态不会保存，重新选择；已下载的 ZIP 不受页面刷新影响。 |
| 点了发布申请却没有附件 | 页面不会自动上传。到 GitHub Issue 正文手动拖入下载的 ZIP，等上传结束再提交。 |
| 不知道作者、版本或许可证 | 在 Issue 或 Agent 对话中说明，先补充依据；不要猜测，也不要把未知许可改成开源许可。 |
| Agent 未能创建 PR / 我没有登录 GitHub | 保留本地成果；完成正常账号授权或改走 Issue 路径。没有真实 PR 链接就不能算已提交。 |
| 已提交但网站搜不到 | 检查 Issue 是否已转为 PR、PR 是否合并，以及 Pages 部署是否成功；未上线时联系维护者并附相关链接。 |
| JSON 校验失败 | 看错误中的文件与字段路径；常见问题是简介长度、文件名与 `id` 不符、重复 ID，或没有恰好一个推荐安装方式。详见下方参考。 |

## 进阶：直接编辑目录或提交 PR

普通发布者可以跳过这一节。维护者、Coding Agent 或希望手动贡献的人，以 [Schema](registry/registry.schema.json) 和[校验器](scripts/validate-registry.mjs)为准，不从旧示例猜规则。

| 类型 | 目录 | 用途与额外必需字段 |
| --- | --- | --- |
| `skill` | `registry/skills/` | 可重复使用的能力或工作流；`installations` |
| `agent` | `registry/agents/` | 有职责、权限与前提的协作者；`setup` |
| `prompt` | `registry/prompts/` | 有明确变量的可复用模板；`prompt` |

每个条目一个 JSON 文件，文件名为 `<id>.json`，ID 在三类目录中全局唯一。需要由本站托管的新 Skill，可参考 `examples/<id>/` 的现有结构；是否为演示资源由 `isExample` 决定，不由目录名决定。外部上游不必复制到这里。

参考现有条目：[公开上游 Skill](registry/skills/open-source-contributor.json)、[本站示例 Skill](registry/skills/accessibility-audit.json)、[Agent 示例](registry/agents/dependency-curator.json)、[Prompt 示例](registry/prompts/architecture-decision.json)。这些是结构参考，不是可以原样替换名称的兼容性证明。

<details>
<summary>展开字段参考：公共字段、来源路径、Skill / Agent / Prompt</summary>

### 公共字段

除标明可选外均为必需。长度为字符数；不要添加 Schema 未定义的属性。

| 字段 | 规则 |
| --- | --- |
| `id` | 3–64 字符，小写字母 / 数字组成、连字符分段，无开头或结尾连字符；全局唯一，与文件名一致。 |
| `type` | `skill`、`agent`、`prompt`，必须与所在目录一致。 |
| `name` | 3–80 字符，可用中文，人能理解的名称。 |
| `description` | **10–160 字符**的具体纯文本简介；不是长篇说明。 |
| `author` | 对象；必需 `name` 为 2–80 字符，可选 `url` 为 HTTPS URI。 |
| `source` | 对象；必需 `primaryFile` 为 3–300 字符，必需 `sourceUrl` 为 HTTPS URI，可选 `rawUrl` 为 HTTPS URI。 |
| `repository` / `url` | 至少提供一个；`repository` 须以 `https://github.com/` 开头，`url` 为公开使用页面的 HTTPS URI。 |
| `tags` | 1–10 个不重复标签，每个 2–30 字符、小写字母 / 数字和分段连字符；用有助发现的主题，不重复堆砌类型。 |
| `version` | `主版本.次版本.修订号`，可带 `-` 预发布后缀，例如 `1.2.0`、`1.2.0-beta.1`；当前 Schema 不接受 `+` 构建元数据。 |
| `license` | 非空、最多 40 字符，只含字母、数字、`-`、`.`、`+`；尽量用真实 SPDX 标识符。不支持含空格的复合 SPDX 表达式，复杂许可在来源说明中展开并与维护者确认。 |
| `updatedAt` | 真实有效日期，格式 `YYYY-MM-DD`。 |
| `isExample` | 布尔值；真实资源为 `false`，演示内容为 `true`。 |
| `featured` | 可选布尔值，是否精选由维护者决定。 |
| `usage` | 对象；必需 `instructions` 为 20–2000 字符，可选 `example` 为 5–4000 字符；写作方式见上文。 |

### 来源路径必须相互对应

`primaryFile` 写相对于**源仓库根目录**的入口路径，不是本机路径，也不是客户端安装位置。`sourceUrl` 指向同一入口；提供 `rawUrl` 时也应使用同一分支、标签或提交。以下摘自现有示例，三处都包含相同的 `examples/accessibility-audit/SKILL.md`：

```json
{
  "source": {
    "primaryFile": "examples/accessibility-audit/SKILL.md",
    "sourceUrl": "https://github.com/THU-MEM/SkillMarket/blob/main/examples/accessibility-audit/SKILL.md",
    "rawUrl": "https://raw.githubusercontent.com/THU-MEM/SkillMarket/main/examples/accessibility-audit/SKILL.md"
  }
}
```

这是字段片段，不是完整条目。公开上游的固定提交写法见 [Open Source Contributor](registry/skills/open-source-contributor.json)。安装目标属于 `installations[].targetPath`，不要把它写进 `source.primaryFile`。URL 格式通过校验不代表链接存在或授权有效，仍需人工检查。

### Skill：`installations`

数组包含 **1–32** 个方式，每个方式的 `id` 在本条目内唯一。**校验器要求恰好一个方式设置 `recommended: true`**，其余为 `false` 或省略；这是 Schema 之外的额外规则。

| 字段 | 必需性与规则 |
| --- | --- |
| `id` | 必需；3–64 字符，小写字母 / 数字与分段连字符。 |
| `type` | 必需；`cli`、`manual`、`deeplink` 或 `download`。 |
| `label` / `summary` | 必需；分别为 3–100 / 10–500 字符，说明方式与适用条件。 |
| `client` | 必需；`github-copilot`、`github-copilot-cli`、`claude-code`、`codex`、`cursor`、`opencode`、`hermes`、`universal`，共八种。枚举可用不代表资源已在所有客户端验证。 |
| `scope` | 必需；`project`、`user` 或 `interactive`。 |
| `platforms` | 必需；至少一个、不重复，可选值为 `windows`、`macos`、`linux`、`web`。只填写有依据的支持范围。 |
| `officialStatus` | 必需；`official`、`maintainer` 或 `community`，含义见下文。 |
| `recommended` | 可选布尔值，但整个数组必须恰好一个为 `true`。 |
| `command` | `cli` 必需；3–1000 字符。 |
| `targetPath` | `manual` 必需；3–500 字符。 |
| `url` | `deeplink` / `download` 必需；HTTPS URI，当前 Schema 不接受自定义 URI scheme。 |
| `prerequisites` | 可选，最多 10 项；每项必需 `name`（2–80 字符）、`details`（5–300），可选 `check`（2–300）。 |
| `steps` | 必需，1–12 项；每项必需 `title`（2–80）、`description`（5–500），可选 `command`（2–1000）、`expected`（2–500）。 |
| `verify` / `update` / `uninstall` | 可选对象；出现时必需 `description`（5–500），可选 `command`（2–1000）。应说明验证方式；没有依据时不编造更新或卸载命令。 |
| `securityNote` | 可选，10–1000 字符；涉及 shell、下载、hooks、MCP 或广泛权限时，贡献要求提供可见风险说明。 |
| `evidenceUrl` | 必需；支持该安装方式的真实 HTTPS 文档链接。 |

安装来源状态不是安全评级：

- `official`：客户端厂商文档明确支持该方式。
- `maintainer`：资源维护者文档明确支持该方式。
- `community`：第三方社区工具提供的方式。

每种状态都必须有 `evidenceUrl`。例如 `npx skills` 是第三方社区工具，不能标成 GitHub 或 Anthropic 官方命令。先查文档，再在可行时用隔离、可丢弃项目验证；核对客户端、范围、目标位置、前提与预期结果。未运行的步骤要如实标注，不为了验证而盲目执行未知材料。用户侧安装模型与参考文档见[安装指南](docs/USER_GUIDE.md)。

### Agent：`setup`

必需对象，包含：

- `instructions`：必需，20–2000 字符，说明如何配置与启动。
- `requirements`：必需数组，可为空，最多 10 个不重复字符串，每项 2–100 字符。

说明实际权限、依赖与外部服务；不要暗示市场替用户部署或运行 Agent。参考 [dependency-curator.json](registry/agents/dependency-curator.json)。

### Prompt：`prompt`

必需对象，包含：

- `template`：必需，20–8000 字符，在模板中说明变量如何使用。
- `variables`：必需数组，可为空，最多 20 项。每项必须包含 `name`、`description` 和 `required`。
- 变量 `name` 以大写字母开头，后续只含大写字母、数字、下划线，如 `CHANGESET`；`description` 为 5–200 字符；`required` 为布尔值。

参考 [architecture-decision.json](registry/prompts/architecture-decision.json)。没有变量时保留空数组，不省略必需字段。

</details>

### 本地检查与 PR

手动路径使用 Git、Node.js 22+ 与 npm。在独立分支或 fork 中编辑，仅提交相关源文件和目录条目，不混入生成产物或无关格式化。先审查项目依赖和脚本，再在仓库根目录运行：

```sh
npm ci
npm run check
```

`npm run check` 顺序执行目录校验、测试、Lint、类型检查与生产构建。只想定位目录错误时，可单独运行 `npm run validate:registry`，但它不能代替完整检查。

目录校验覆盖 JSON 语法、Schema、URL / 日期格式、目录与类型匹配、文件名、全局 ID，以及安装方式 ID 与唯一推荐项；它不会替你验证链接可访问性、许可有效性、内容无秘密或实际可运行性。资源本身有测试时另行审查并验证，报告通过、失败与跳过的范围。涉及清华云盘技能的改动还应按 [README 的本地运行说明](README.md#本地运行)执行离线 Python 回归；CI 另有相关检查。

向 `THU-MEM/SkillMarket:main` 打开 PR，填写 [PR 模板](.github/pull_request_template.md)，说明来源、许可、用途、验证结果；Issue 路径转来的 PR 还应关联原申请。维护者可能要求补充依据、调整类型或标签，收录不保证通过。PR 合并后，`main` 的 Pages 工作流通过检查才部署；生产路径为 `/SkillMarket/`，发布页使用 `#/submit` hash 路由。

## 产品与代码贡献

涉及条目之外的产品或代码修改，请先开 Issue 或在 PR 中说明用户问题。保持应用静态、依赖轻量；运行完整 `npm run check`，视觉改动附截图。发布流程不需要新增数据库、账号系统或安装向导。
