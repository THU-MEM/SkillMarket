# 界面与统计约定

- HeroUI `2.8.5` / theme `2.4.23`：发布包使用 MIT。保留已选清华紫明暗主题；不混用 v3 API。
- Framer Motion `12.23.24` 与 `motion-dom 12.23.23` / `motion-utils 12.23.6` 固定兼容组合，避免子依赖漂移导致 `activeAnimations` 导出缺失。
- 顶部概览只占辅助位置，主体始终为资源卡片。总量从 `entries` 计算；历史观测来自 `10466d49cddafae2a21fb58594a8d7ca8b491a07`、`9e09669c4345a08cbb13660fd016b95c1be3aa7e` 的目录文件，最新点读取当前目录。图表按采样点展示，不是每日连续记录，也不是下载/安装量。
- 从 Awesome Copilot 借鉴卡片动作分层、明确安装上下文和短入场动画；保留本项目多客户端安装器，不照搬 Copilot 专属 CLI 或协议。URL 筛选保留是本项目增强，不是对方已有功能。
- 不增加运行时统计服务或图表依赖，不使用持续粒子/3D 背景；尊重 `prefers-reduced-motion`。

## 参考源码

Awesome Copilot 固定版本：`6c4d33b9cfca967a28bb2962ef4d55e4a384c88c`。

- 卡片与安装动作：https://github.com/github/awesome-copilot/blob/6c4d33b9cfca967a28bb2962ef4d55e4a384c88c/website/src/components/brand/SkillsCatalog.tsx
- 文件、来源与安装上下文：https://github.com/github/awesome-copilot/blob/6c4d33b9cfca967a28bb2962ef4d55e4a384c88c/website/src/components/brand/SkillDetail.tsx
- 轻量入场效果：https://github.com/github/awesome-copilot/blob/6c4d33b9cfca967a28bb2962ef4d55e4a384c88c/website/src/components/brand/styles/skills.module.css

只借鉴交互原则，未复制对方组件源码、品牌和内容库。
