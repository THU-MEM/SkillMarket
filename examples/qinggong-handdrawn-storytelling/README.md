# 清工手绘故事视频技能包

把一次概念课的脚本、视觉反馈和动画修订沉淀成可复用方法。

- **看方法**：`SKILL.md`及`references/`。
- **看人物**：`assets/people/gallery.html`、`preview-sheet.png`；12种表情/姿势，透明SVG。
- **运行画布**：`kit/`；16类基础元素、8种动作、连续画布、字形描绘、手笔跟随。
- **看完整讲稿**：`examples/bullwhip/narration.json`，10章/30句；`ssml/`含对应表达式XML。
- **复用修订**：`scripts/card-3d.mjs`、`whip-motion.mjs`及回归测试。

## 快速开始
在包目录通过终端运行：
```sh
cd kit
npm ci --ignore-scripts
npm test
npm run build
```
然后打开生成的`storyboard.html`。静态人物图库无需安装即可浏览。`kit/README.md`包含制作新故事与视频导出说明。

本包没有云服务凭据；无Key路径可生成并浏览真正的故事动画。TTS是可选输入，不会自动调用付费服务。新主题不保证由一个命令自动完成，仍需Agent编写语义动作与配音时间表。

## 范围与许可
作者维护的脚本/文档/新增人物按Apache-2.0发布；Rough.js、opentype.js为MIT，字体为OFL，GSAP使用Standard No-Charge条款。完整原始声明保存在`kit/licenses/`，不被本包LICENSE替代。原片和品牌素材未随包再分发，通用片头片尾不冒充官方原版。

换成真人Qwen音色时，先核对ID、原录音和本次授权，使用新独立输出目录；本包不携带声纹或真人录音。最新多人对白、中国风配乐属于可选导演策略，不能把未经声音/素材确认的新版本称为已完成。
