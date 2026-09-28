# SkillMarket

发现、安装和分享 Skills、Agents 与 Prompts。

[访问网站](https://thu-mem.github.io/SkillMarket/) · [安装指南](docs/USER_GUIDE.md) · [发布条目](CONTRIBUTING.md)

## 使用

- 按名称、类型和标签查找内容。
- 在技能详情页选择 Agent、安装范围和平台，复制对应命令。
- 安装前查看源码；示例条目均明确标记，不代表第三方项目。

## 安装技能

需要 Git 与 Node.js 22+。在目标项目根目录执行：

```sh
git clone --depth 1 --branch main https://github.com/THU-MEM/SkillMarket.git .skillmarket-install
node .skillmarket-install/scripts/install-skill.mjs --skill accessibility-audit --agent claude-code --scope project
```

仓库只需克隆一次；已存在时先核对该目录来源，不要重复克隆。安装器仅复制已登记的本仓库技能完整目录，不执行技能脚本，不覆盖已有安装。支持 `--list` 和 `--dry-run`；客户端、用户级目录及更新说明见[安装指南](docs/USER_GUIDE.md)。

## 本地运行

```sh
npm ci
npm run dev
```

```sh
npm run check   # 目录校验、测试、Lint、类型检查与生产构建
```

技术栈：React、TypeScript、Vite。内容来自 `registry/` 下的 JSON，无数据库、登录系统或托管执行服务。安装器使用 Node.js 标准库，不需要 `npm install`。

## 发布

在 `registry/skills`、`registry/agents` 或 `registry/prompts` 添加 JSON，运行检查后提交 Pull Request。格式见[贡献指南](CONTRIBUTING.md)与[Schema](registry/registry.schema.json)。

`main` 更新后，GitHub Actions 通过完整检查再部署到 GitHub Pages。生产路径为 `/SkillMarket/`，页面使用 hash 路由。

## 许可证

[Apache-2.0](LICENSE)
