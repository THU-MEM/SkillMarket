# 安装证据与验证边界

核对日期：2026-09-28。实现基线：`74147465ce78dc7a76c3647f1b79aa13f938a501`；下表来自实际读取的官方页面，不以搜索摘要证明路径。

| CLI client 参数 | project 根目录 | user 根目录 | 官方证据 |
| --- | --- | --- | --- |
| `claude-code` | `.claude/skills` | `~/.claude/skills` | [Claude Code：Where skills live](https://code.claude.com/docs/en/skills) |
| `codex` | `.agents/skills` | `~/.agents/skills` | [Codex：Where Codex loads local skills](https://developers.openai.com/codex/skills) |
| `cursor` | `.cursor/skills` | `~/.cursor/skills` | [Cursor：Skill directories](https://cursor.com/docs/context/skills) |
| `opencode` | `.opencode/skills` | `~/.config/opencode/skills`（遵循 `XDG_CONFIG_HOME`） | [OpenCode：Place files](https://opencode.ai/docs/skills/) |
| `github-copilot` | `.github/skills` | `~/.copilot/skills` | [GitHub：Creating and adding a skill](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills) |
| `github-copilot-cli` | `.github/skills` | `~/.copilot/skills` | [Copilot CLI：Creating and adding a skill](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills) |
| `hermes` | 本安装器不提供 | `$HERMES_HOME/skills`，未设时 `~/.hermes/skills` | [Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)、[Profiles：How it works](https://hermes-agent.nousresearch.com/docs/user-guide/profiles) |

所有根目录下均新增 `<skill-id>/`，完整复制该目录，而非仅下载 `SKILL.md`。

## 范围判定

- GitHub 官方页面明确列出 `.github/skills` 与 `~/.copilot/skills`，并明确包括 VS Code agent mode；这里的 IDE 支持指 VS Code，不泛称全部 IDE。
- OpenCode 的 [官方路径实现](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/global.ts) 从 `xdg-basedir` 的 `xdgConfig` 生成 `config/opencode`；本安装器支持 `XDG_CONFIG_HOME`，不解析客户端的其他自定义配置目录。
- Codex 的当前文档使用 `.agents/skills`，不把旧 `.codex/skills` 当默认。
- Claude、Cursor、OpenCode 均有本地目录发现接口；无需编造对应的远程安装 API。
- Hermes 官方现已有需信任授权的 project discovery；本工具按约定**仅支持 user**，这不是声称 Hermes 不支持项目技能。Profile 通过 `HERMES_HOME` 隔离；安装器不读取配置、凭据或 sticky profile，不根据 `HERMES_PROFILE` 猜目标。
- `universal` 仅保留 schema 兼容键，不提供安装选项；不存在适合所有客户端的 `.github/skills`。
- 移除旧 `gh skill`、`copilot skill add` 和 `npx skills` 安装项：未将它们作为本次验证路径，不宣称命令不存在。默认方案是**维护者脚本**，不是任何客户端的官方安装器。

## 实测与局限

`node --test tests/install-skill.test.mjs` 使用真实临时文件系统和独立 Node 子进程：覆盖 13 组客户端/范围、精确单技能、字节与文件闭包、嵌套脚本/引用/二进制资源、dry-run/list、已有目录、源与目标 symlink、FIFO、敏感文件/私钥特征、路径穿越、并发独占、rename 失败清理、临时 `HERMES_HOME` / `XDG_CONFIG_HOME`。

- `HOME`、`USERPROFILE`、`XDG_CONFIG_HOME`、`HERMES_HOME` 全部隔离；未安装到任何真实用户技能目录。
- Node 22.19.0 / macOS 本地实测；Windows 使用 Node 原生路径及同样的 git/node 命令，Windows 原生执行以 CI 结果为准。POSIX FIFO/symlink 测试在 Windows 显式跳过。
- 没有登录、调用或运行真实 Agent；磁盘安装成功不证明客户端已发现或执行技能。
- 先完整暂存，再用独占 `mkdir` 预留新目标，逐项 `rename`、最后发布 `SKILL.md`；避免 POSIX `rename` 静默替换已有空目录。普通失败会清理本事务目标与暂存目录；不是断电/SIGKILL 下的原子目录事务。
- 源码与目标父目录必须由可信用户控制。检查拒绝现有 symlink/junction，但不是防同权限恶意进程并发替换路径的沙箱。凭据扫描只是保守文件名与常见密钥特征检查，不能代替源码审查。
