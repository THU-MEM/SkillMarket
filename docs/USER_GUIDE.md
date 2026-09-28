# 安装与使用

在**目标项目根目录**打开终端。网站只提供目录和说明，不会托管运行技能。以下两种安装器的参数、目录规则与覆盖行为不同，不要混用。

## 通用 npx 安装

准备 **Git + Node.js 22.20 或更新版本**。以清华云盘为例，运行后在终端选择 Agent 与范围：

```sh
npx skills@1.7.0 add THU-MEM/SkillMarket --skill tsinghua-cloud-drive --copy
```

- 使用 Vercel Labs 的第三方 `skills` CLI；`--copy` 复制完整技能目录。可能覆盖已有同名技能，先备份并检查最终目标路径，不要把本站安装器的“不覆盖”保证套用到它。
- 其他技能将 `--skill` 改为 `accessibility-audit` 或 `release-notes-writer`。仅查看可发现技能：`npx skills@1.7.0 add THU-MEM/SkillMarket --list`。
- 它在终端选择 Agent 和范围，不读取网页上的选择器。也可显式添加 `--agent claude-code`；`--global` 表示用户级，不加则默认当前项目。保留确认提示，避免无意覆盖。
- Hermes 在该 CLI 中的名字是 `hermes-agent`，与本站脚本的 `hermes` 不同；使用 `--agent hermes-agent --global`，非默认环境先设置正确的 `HERMES_HOME`。其它 Agent 支持范围以 [skills CLI 文档](https://github.com/vercel-labs/skills/tree/7407f3893ad4dceab546ac002c3ef806e4000c73) 为准。
- 安装只是文件复制。Python 依赖、Token、客户端配置仍需另行准备。此方式无需先手动克隆 `.skillmarket-install`；安装依赖时使用它实际输出的技能目录。

## 两行安装

### 上游技能与本站技能的区别

`open-source-contributor` 和 `3d-video` 来自 **KAIWU-AI/AI-quick-learn**，详情页提供固定源码提交的 npx 安装命令，以及 Claude Code、Codex、Cursor、OpenCode、GitHub Copilot、Hermes 的选择。通用选项在终端选择范围；固定客户端命令使用 `--yes` 跳过确认，可能覆盖同名技能，务必先备份。客户端目录与环境覆盖规则按第三方 CLI 执行，以终端实际目标为准，不套用下方本站脚本的路径表。

这两项不由本站目录安装器复制，`--list` 只列出该脚本实际支持的本站技能。Open Source Contributor 运行需 Python、Git、gh 与授权的 GitHub 访问；3D Video 的基础预览与完整渲染依赖不同，先阅读详情页的前置条件与上游 README。安装成功不代表已发布 PR、完成影片或获得云端权限。

### 本站技能

以下为本站维护者脚本，需要 **Git + Node.js 22+**，不是客户端官方命令。

例如将无障碍审查技能安装到当前项目的 Claude Code：

```sh
git clone --depth 1 --branch main https://github.com/THU-MEM/SkillMarket.git .skillmarket-install
node .skillmarket-install/scripts/install-skill.mjs --skill accessibility-audit --agent claude-code --scope project
```

Windows PowerShell/cmd、macOS、Linux 使用相同命令。**只克隆一次**；已有 `.skillmarket-install` 时跳过第一行，不覆盖或删除它。运行安装前，审查克隆仓库的安装脚本及 `examples/accessibility-audit/` 全部内容。

安装版本说明技能时，只需运行：

```sh
node .skillmarket-install/scripts/install-skill.mjs --skill release-notes-writer --agent claude-code --scope project
```

每次只安装指定 ID。无 npm 依赖、额外下载器、托管 API 或 Agent 登录要求；安装器不执行技能内脚本。实际使用技能仍需已配置好的对应客户端。

## 选择客户端与范围

### 清华云盘技能

将安装命令中的 ID 换为 `tsinghua-cloud-drive`。该技能不是占位示例，包含完整脚本；目录复制完成后，还需在准备运行技能的 Python 3.9+ 环境中安装依赖：

```sh
python3 -m pip install -r .skillmarket-install/examples/tsinghua-cloud-drive/requirements.txt
```

Windows 使用 `py -3` 替代 `python3`；建议在虚拟环境中运行。网站详情会按平台显示对应命令。

在 Agent 运行环境设置自己的 `TSINGHUA_CLOUD_TOKEN` 和 `TSINGHUA_CLOUD_REPO_ID`，或通过 `--config` 指定包外私密 JSON；不要把凭据放进技能目录或公开仓库。**需要资料库 Repo-Token，不是账户 Token**：官方文档入口为资料库菜单 → 高级 → API Token，清华定制界面未登录复核。获取 Token、查找 Repo ID、配置及只读验证见 [清华云盘配置指南](TSINGHUA_CLOUD_SETUP.md)。完整命令见 [SKILL.md](../examples/tsinghua-cloud-drive/SKILL.md)。

### 安装目录

替换 `--agent` 和 `--scope`；以下目录均再追加 `<skill-id>/`：

| `--agent` | `--scope project` | `--scope user` |
| --- | --- | --- |
| `claude-code` | `.claude/skills` | `~/.claude/skills` |
| `codex` | `.agents/skills` | `~/.agents/skills` |
| `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| `opencode` | `.opencode/skills` | `~/.config/opencode/skills`，设置 `XDG_CONFIG_HOME` 时使用其下 `opencode/skills` |
| `github-copilot`（VS Code） | `.github/skills` | `~/.copilot/skills` |
| `github-copilot-cli` | `.github/skills` | `~/.copilot/skills` |
| `hermes` | 不提供 | 当前 `HERMES_HOME/skills`；未设置时 `~/.hermes/skills` |

`~` 表示本机当前用户主目录，Windows 使用对应的用户目录。环境目录覆盖必须是绝对路径且不能包含 `..`。Hermes 不自动解析 sticky profile，也不会查找或修改其他 profile；非默认 profile 请在当前终端明确设置正确的 `HERMES_HOME`，先 dry-run 确认。

## 预览、验证、更新与卸载

```sh
node .skillmarket-install/scripts/install-skill.mjs --list
node .skillmarket-install/scripts/install-skill.mjs --skill accessibility-audit --agent claude-code --scope project --dry-run
```

- **预览**：`--list` 列出仓库技能与支持的客户端；`--dry-run` 校验并输出源、目标，不写入文件。它不是已安装技能列表。
- **验证**：根据输出的 `target` 检查 `SKILL.md` 与全部附属文件；重开对应客户端查看技能。Hermes 可用 `hermes skills list`。这一步需要用户的实际客户端环境，安装器不代为执行。
- **更新**：备份已安装的单个技能目录；运行 `git -C .skillmarket-install pull --ff-only` 后审查源码；将旧技能目录移到技能发现目录外，再重跑对应第二行。已有目标一律拒绝，不提供 `--force`。
- **卸载**：仅删除输出 `target` 所指的单个技能目录，不删除父级 `skills` 或其他技能。

## 本站目录安装器的安全边界

仅安装 `registry/skills` 登记的本仓库 `examples/<ID>/`，保留脚本、引用、资源与空目录；拒绝软链接、特殊文件、路径穿越、凭据文件、依赖安装目录与缓存。不读取本机凭据。先暂存全部文件，再独占创建新目标，最后发布 `SKILL.md`；普通失败会清理本次目录。断电或强制终止可能留下未完成目录，核对后手动移走，不自动删旧文件。

请勿在其他用户可写的源/目标目录里运行；不要在安装过程中同时修改这些目录。检测不是全面安全审计，技能内容仍可能影响 Agent 行为，运行前应审查工具权限和网络操作。

Agent 示例与 Prompt 示例不是可安装 Skill：在详情页阅读配置说明或复制模板，安装器不会把它们伪装成 `SKILL.md`。

官方目录证据及测试范围见 [INSTALLATION_EVIDENCE.md](INSTALLATION_EVIDENCE.md)。
