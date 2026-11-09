---
name: qinggong-handdrawn-storytelling
description: Use when making continuous hand-drawn teaching videos.
version: 1.0.0
author: Bryan Nathan (hydraxman), Hermes Agent
license: Apache-2.0
platforms: [macos]
---
# 清工手绘故事视频

把概念解释做成连续发生的故事，而不是逐页PPT。包含教学脚本方法、可运行Storyboard、12种人物表情姿势、3D卡牌与真实移动的鞭梢示例。

## 适用与输入
- 适合概念课、管理案例、因果关系和短故事。
- 输入：主题、受众、权威材料；若要求沿用品牌，还须提供有权使用的徽章、配对卡面和参考片。
- 不适合冒充原视频制作软件鉴定、自动真实汉字笔顺或通用拖拽动画编辑器。

## 先用什么
1. 用 `read_file` 阅读 [核心原则](references/principles.md)、[反馈转规则](references/feedback-to-rules.md) 与 [Opus案例借鉴](references/opus-video-prompts-adaptation.md)。
2. 用 `terminal` 在 `kit/` 执行 `npm ci --ignore-scripts`、`npm test`、`npm run build`。打开生成的 `kit/storyboard.html` 查看图谱；不需要API Key。
3. 打开 [人物图库](assets/people/gallery.html)，12个透明SVG可直接引用；代码入口为 `kit/src/person-poses.mjs`。
4. 从 `kit/examples/helping-neighbor.json` 复制一个故事。先写情境、因果、反例、练习、结论，再选人物和动作。
5. 旁白与画面分开：参照 [声音与混音](references/voice-and-mix.md)、`examples/bullwhip/narration.json` 和 `examples/bullwhip/ssml/`。XML是Azure示例，不能直接交给不支持SSML的Qwen模型朗读。

## 制作流程
1. **先读参考，再提炼方法。** 看开头、正文、转折和结尾的连续帧，区分看见的效果与猜测的软件。参见 [参考片研究](references/reference-film.md)。验收：一份不臆测工具来源的结构说明。
2. **完整讲解，屏幕少字。** 问题→例子→机制→条件→行动→小练习→总结；画面只显示关键短词和数值。教学假设必须明确，不能当实测数据。验收：每句话映射到图示或必要停顿。
3. **持续画，持续变。** 同一角色用稳定ID继续参与故事；连线、箱子、表情和位置解释因果。章节只是时间锚点，不能自动清屏翻页。验收：前后对象关系能追踪。
4. **快慢有层次。** 起笔快速、相关动作交叠、重点短促强调；读图和练习留停顿。不把所有动作匀速排队，不靠全片加速解决拖沓。
5. **人物有反应。** 让开心、哭泣、疑惑、指向、讲解等姿势服务情节；不同角色可有一两句短对白，避免改成喧闹对话剧。用实名声音前核对身份及当前用途授权；参考录音不进入技能包或公开仓库。
6. **卡牌要有空间感。** 用稳定透视父层、旋转和z位移、薄卡边与短暂回稳；不能只用缩放淡入冒充3D。示例模块 `scripts/card-3d.mjs` 的输入契约见 [动画接线](references/motion-recipes.md)。
7. **比喻必须真的动。** 鞭梢需改变真实端点坐标，波动沿鞭身传递；不要只动控制点而让末端固定。路径变长前清除绘制dash蒙版。`scripts/whip-motion.mjs`提供确定性路径和关键帧。
8. **先定声音，再定时间。** 使用实际WAV时长、词/句边界；换声线后重新计算，不套旧时间。不混用旧声线片头片尾。音乐低于旁白，并按语音频段和包络避让；音效只在对应动作发生时点缀。
9. **实际成片验收。** 用真实浏览器seek抽帧和导出的MP4检查首尾、转场、波动极值、卡牌入退场。完整解码，回读每段音轨；ASR和响度不能证明听感自然或声纹相似。详见 [验收清单](references/verification.md)。

## 运行与交付
用 `terminal` 执行：
```sh
cd kit
npm ci --ignore-scripts
npm test
npm run build
npm run test:browser
```
浏览器测试需现有Chrome，设置 `CHROME_BIN` 可显式指定。导出视频另需FFmpeg与HyperFrames；`kit/README.md`提供命令。macOS已执行，其他平台未声称实测。

交付：成片、可编辑项目、来源和许可台账。画面/字幕/TTS只消费内容字段，不显示制作计划、提示词、调试信息、音乐播放信息或默认版权片尾。

## 边界
本包不包含原参考视频、真人参考音频、课程专属徽章/卡面或完整成片。提供的是方法、原创模块、通用素材和可运行示例；品牌素材由使用者合法提供。字体/GSAP等沿用各自许可，不能把整包所有文件都宣称为Apache。见 [素材清单](references/assets-and-rights.md)、[引用](references/sources.md) 及 `kit/licenses/`。
