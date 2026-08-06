# SkillMarket 安装与使用指南

SkillMarket 本身不托管或执行技能、智能体与提示词。它提供经过结构化校验的元数据、
安装路径、证据链接和原始文件入口，帮助你在安装前做出知情判断。

> 第三方技能会影响模型行为，也可能引用脚本、hooks、MCP 服务或网络资源。请像审查
> 代码一样审查技能，不要仅因为它出现在目录中就信任它。

## 1. 选择内容类型

| 类型 | 适合场景 | 常见文件 |
| --- | --- | --- |
| Skill / 技能 | 为 AI 助手提供可重复执行的专业工作流 | `<name>/SKILL.md` |
| Agent / 智能体 | 配置目标、工具、模型与自主行为 | `*.agent.md`、`.claude/agents/*.md` |
| Prompt / 提示词 | 复用一段显式调用的指令模板 | Markdown、文本或客户端命令文件 |

详情页会显示条目的主文件、原始内容和项目仓库。安装前先打开这些链接。

## 2. 项目级与用户级安装

**项目级安装**随仓库一起版本管理，团队成员可以通过 Pull Request 审查，优先适合生产
项目。**用户级安装**对当前用户的多个项目生效，适合个人反复使用的能力。

| 客户端 | 项目级技能位置 | 用户级技能位置 |
| --- | --- | --- |
| GitHub Copilot | `.github/skills/<name>/SKILL.md`、`.agents/skills/`、`.claude/skills/` | `~/.copilot/skills/`、`~/.agents/skills/` |
| GitHub Copilot CLI | 同上 | `~/.copilot/skills/` |
| Claude Code | `.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` |

GitHub 官方路径来源：
[Adding agent skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)。
Claude Code 技能结构来源：
[Anthropic plugin structure](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/plugin-structure/SKILL.md)。

## 3. `npx skills`：跨客户端社区 CLI

[`vercel-labs/skills`](https://github.com/vercel-labs/skills) 提供一个社区 CLI，可从 GitHub
仓库、本地目录或具体技能 URL 发现并安装技能。

```bash
# 交互式发现仓库中的技能
npx skills add owner/repo

# 安装指定技能到当前项目的 GitHub Copilot 目录
npx skills add owner/repo --skill skill-name --agent github-copilot --yes

# 安装指定技能到当前用户的 Claude Code 目录
npx skills add owner/repo --skill skill-name --agent claude-code --global --yes
```

重要选项：

- `--agent <agent>`：指定目标客户端。
- `--skill <name>`：只安装一个或多个指定技能。
- `--global`：从项目级改为用户级。
- `--copy`：复制文件而不是使用默认链接策略。
- `--yes`：接受提示，适用于已审查的自动化安装。

生命周期命令：

```bash
npx skills list
npx skills update
npx skills remove
```

`npx skills` 是 Vercel Labs 维护的**社区工具**，不是 GitHub 或 Anthropic 官方命令。
当前包要求 Node.js 22.20.0 或更高版本。事实来源：
[README options](https://github.com/vercel-labs/skills#readme) 和
[package.json](https://github.com/vercel-labs/skills/blob/main/package.json)。

## 4. GitHub Copilot 官方安装方式

### 4.1 GitHub CLI `gh skill`

GitHub CLI 2.90 或更高版本提供处于 **Public Preview** 的 `gh skill` 命令：

```bash
# 先审查将被安装的内容
gh skill preview OWNER/REPO SKILL

# 安装并交互选择客户端与范围
gh skill install OWNER/REPO SKILL

# 更新已安装技能
gh skill update
gh skill update --all
```

始终先运行 `preview`。GitHub 官方明确提醒：技能可能包含提示词注入或恶意脚本，
GitHub 不会替用户验证第三方技能安全性。来源：
[Managing skills with GitHub CLI](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills#managing-skills-with-github-cli)。

### 4.2 GitHub Copilot CLI

Copilot CLI 可以从文件、URL 或目录添加技能：

```bash
copilot skill add <FILE | URL | DIRECTORY>
```

也可以在交互会话中使用：

```text
/skills add
/skills list
/skills info
/skills reload
/skills remove
```

安装 Copilot CLI 需要有效的 GitHub Copilot 订阅。官方安装方式包括 npm、Homebrew、
WinGet 和安装脚本，详见
[Installing GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)。
技能命令来源：
[Adding agent skills to Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)。

## 5. Claude Code

### 5.1 手动技能安装

将完整技能目录复制到项目级或用户级位置：

```text
Project: .claude/skills/<name>/SKILL.md
User:    ~/.claude/skills/<name>/SKILL.md
```

不要只复制主文件而遗漏技能引用的 `scripts/`、`references/` 或 `assets/`。

### 5.2 智能体与命令

```text
Project agents:   .claude/agents/*.md
User agents:      ~/.claude/agents/*.md
Project commands: .claude/commands/*.md
User commands:    ~/.claude/commands/*.md
```

命令结构来源：
[Anthropic command development guide](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/command-development/SKILL.md)。

### 5.3 插件市场

Claude Code 插件可以一起分发 commands、agents、skills、hooks 和 MCP 配置：

```text
/plugin marketplace add owner/repo
/plugin install plugin-name@marketplace-name
```

安装插件前检查 `.claude-plugin/plugin.json`、hooks、脚本、MCP 和权限。来源：
[Claude Code official plugins](https://github.com/anthropics/claude-code/tree/main/plugins)。

## 6. 安装后验证

1. 确认详情页所示目标目录和主文件存在。
2. 检查 YAML frontmatter 至少包含客户端要求的 `name` 与 `description`。
3. 运行客户端的 `list` 或 `info` 命令。
4. 重新加载技能或开启新会话。
5. 给出与技能描述直接匹配的首次任务，验证它能被发现。
6. 如果技能包含脚本，先在隔离分支中运行并检查改动。

## 7. 更新与卸载

- 使用 CLI 安装时，优先使用同一 CLI 的 `update` / `remove` 命令。
- 手动安装时，重新审查完整目录后再替换，不要只覆盖部分文件。
- 卸载手动技能时删除对应技能目录，然后重新加载客户端。
- 如果详情页没有提供更新或卸载命令，表示没有足够的可验证依据，不应自行猜测。

## 8. 安全检查清单

- 命令是否来自官方文档、项目维护者还是社区工具？
- 是否执行 shell、下载远程脚本或修改用户级目录？
- 是否包含 hooks、MCP、可执行脚本或网络请求？
- 要求的工具和目录权限是否与技能用途相称？
- 原始文件、引用资源和许可证是否完整可见？
- 是否要求提交 API key、token、私有 URL 或个人数据？如果是，请停止安装。

SkillMarket 对每种安装方式分别标注 `official`、`maintainer` 或 `community`，并要求提供
`evidenceUrl`。该标记描述的是**安装方式来源**，不是对条目安全性的背书。
