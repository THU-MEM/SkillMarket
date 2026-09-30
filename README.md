# 清工技能市场

发现、安装和分享 Skills、Agents 与 Prompts。

[访问网站](https://thu-mem.github.io/SkillMarket/) · [安装指南](docs/USER_GUIDE.md) · [发布条目](CONTRIBUTING.md)

## 使用

- 按名称、类型和标签查找内容。
- 在技能详情页选择 Agent、安装范围和平台，复制对应命令。
- 安装前查看源码；示例条目均明确标记，不代表第三方项目。
- 清华紫 HeroUI 界面，支持明暗切换；搜索和筛选可通过 URL 保留与分享。
- 顶部展示目录实际数量及历史采样，不代表安装量、下载量或活跃量。

## 安装技能

### 上游技能

- **Open Source Contributor**：从问题筛选、复现和修复到经授权发布真实 PR；支持多 Agent 或串行执行。
- **3D Video**：从真实代码架构生成连续运镜的三维场景；默认静音，Azure 旁白为可选功能。
- **Piano Go**：自然语言钢琴／鼓点编曲、本地试听及可选哼唱转谱，来源 [hydraxman/PianoGo](https://github.com/hydraxman/PianoGo)；更新前备份 `songs/`。

前两项保留 [KAIWU-AI/AI-quick-learn](https://github.com/KAIWU-AI/AI-quick-learn) 上游来源。请在各自详情页选择客户端，复制固定版本的 npx 命令；不要将它们的 ID 直接套入下面的本站安装器。3D Video 自有代码为 MIT，素材另受 GSAP Standard、OFL、CC0 等许可约束。

### 通用 npx

需要 Git 与 Node.js 22.20+，运行后选择 Agent 和安装范围：

```sh
npx skills@1.7.0 add THU-MEM/SkillMarket --skill tsinghua-cloud-drive --copy
```

这是 Vercel Labs 的第三方安装器，可能覆盖已有同名技能，请先备份。安装不包含 Python 依赖和云盘凭据；清华云盘须自带 **Repo-Token 与 Repo ID**，见[获取与配置指引](docs/TSINGHUA_CLOUD_SETUP.md)。

### 本站目录安装器

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

清华云盘技能另需 Python 3.9+。离线回归：在 Python 虚拟环境安装 `examples/tsinghua-cloud-drive/requirements.txt` 后，运行 `python -B -m unittest discover -s tests/cloud-drive -v`，不使用真实凭据或云盘文件。

## 发布

打开[发布页](https://thu-mem.github.io/SkillMarket/#/submit)，选一种方式即可，**不需要手写 JSON，也不需要安装向导**：

- **ZIP / 文件夹：** 拖入或选择 ZIP，或选择／拖入一个资源文件夹；核对名称、入口、文件与排除列表，人工检查并勾选确认后下载整理包。再打开 GitHub 发布申请，**手动附加下载的 ZIP**，补充简单介绍、作者、来源和许可证后提交 Issue，由维护者审核并整理成 PR。
- **交给 Coding Agent：** 复制发布页的中文指令，连同明确指定的 ZIP、文件夹或公开源码链接交给 Agent。它应安全检查材料、保留真实来源与许可，生成目录 JSON，运行 `npm ci` 和 `npm run check`，按授权提交 PR；不直接推送 `main`，不编造缺失信息。

文件选择、预览和重新打包只在浏览器本地完成，不执行包内脚本，不自动上传或创建 Issue；刷新会清空当前包。只有在 GitHub 手动附加时才会上传，申请与附件是公开材料。排除敏感文件名只是基础检查，不保证内容无秘密；请自行审阅，本站不要求 Token。

准备文件、使用说明、更新已有条目、常见问题及可折叠的字段参考，见[贡献指南](CONTRIBUTING.md)；机器校验规则见 [Schema](registry/registry.schema.json)。**提交申请不等于上线：PR 审核合并到 `main` 后，GitHub Actions 通过检查并成功部署 GitHub Pages，条目才会显示。** 生产路径为 `/SkillMarket/`，页面使用 hash 路由。

## 许可证

[Apache-2.0](LICENSE)
