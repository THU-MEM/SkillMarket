# opus-video-prompts：借鉴与取舍

固定阅读版本：`7977c807781d4ba7c235247b8899a72575a30d00`。仓库内实查18份提示词文件、54条cases记录；这是案例/提示词索引，不是可运行视频引擎或一键生产工具。未逐一验证原帖视频或作者的时间/成本声明，不将其作为本任务交付时长依据。

## 可直接吸收的方法
| 依据 | 学到的方法 | 本项目的具体应用 |
|---|---|---|
| [口播转线稿 §14–18](https://github.com/joeseesun/opus-video-prompts/blob/7977c807781d4ba7c235247b8899a72575a30d00/prompts/10-talking-head-to-lineart.md#L14-L18) | 图解跟随正在说的概念 | 以真实句/词锚点安排销量、订单、库存，不能只按固定秒数轮播 |
| [UI连续变形 §15、25–31](https://github.com/joeseesun/opus-video-prompts/blob/7977c807781d4ba7c235247b8899a72575a30d00/prompts/15-ui-morph-loop.md#L15-L31) | 一个对象连续变成下一状态；由绝对时间决定画面 | 顾客/店/厂持续存在；卡牌独立透视层；正反seek回归 |
| [产品片 §18、29–37](https://github.com/joeseesun/opus-video-prompts/blob/7977c807781d4ba7c235247b8899a72575a30d00/prompts/16-high-end-product-video.md#L18-L37) | 单镜头单主旨；音效实测峰值对齐；3D本体不做opacity/filter | `templates/beat-sheet.json`约束焦点；`scripts/align-sfx.py`计算cue；淡出只作用外包装 |
| [历史叙事 §16–20](https://github.com/joeseesun/opus-video-prompts/blob/7977c807781d4ba7c235247b8899a72575a30d00/prompts/11-austerlitz-film.md#L16-L20) | 先研究因果，再决定节奏，参考图不是牢笼 | 角色插话只承担信息差与加单反应，不为热闹打断讲解 |
| [README §486–494](https://github.com/joeseesun/opus-video-prompts/blob/7977c807781d4ba7c235247b8899a72575a30d00/README.md#L486-L494) | 先分镜、禁用无关特效、关键帧自检、再沉淀Skill | 保留明确的反馈→规则→实现→验收链，不把调试笔记放进视频 |

## 不照搬的部分
- 不强制120 BPM或每拍一个变化。短广告可音乐驱动，教学以语义和呼吸驱动；只有开场和动作点靠节拍。
- 不机械应用-14 LUFS母带目标。先验证旁白与背景关系、轻声句和真峰值，再定听感。
- 不因一句提示词案例就承诺一分钟出完整片或特定成本。
- 不默认改成60fps/多子帧模糊。现有24fps满足时保留；细字、卡面不得为了模糊而失读。
- 关于`will-change`：参考提示词警告相机缩放会导致模糊，而本项目卡牌外层固定合成层曾修复seek差异。两者不是全局禁令：只在已验证的局部使用，检查最终分辨率文字清晰度。
- API Key不因禁止某个Read工具就绝对安全。使用包外环境变量/配置，禁止日志和公开归档，执行工具权限仍须受控。

## 著作权
固定树没有LICENSE文件；各提示词声明原作者权利。这里只作方法归纳和必要出处链接，不复制长提示词或案例库，不把它们纳入本包Apache许可。
