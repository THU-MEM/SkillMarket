# 手绘教学 Storyboard Kit

无框架的 JSON → SVG → 单一 GSAP 时间轴。保留 1440×1080 米白纸面、固定色板、手绘字形、16 类元素、8 种动作；章节只是导航锚点，不自动清屏。公开版使用通用教学标题、灯泡图标和程序生成的示例卡，不包含或授权任何原课程品牌素材。

## 安装、测试、生成

需要 Node.js 22+、npm。在本 `kit/` 目录运行：

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run test:browser
```

首次安装从 npm 下载锁定依赖；测试、构建及生成的 HTML 不调用在线服务，不需要凭证。`npm test` 不需要浏览器；`test:browser` 需要已安装的 Chromium，并先执行 build。

生成后直接打开 `storyboard.html`：静态离线图库，含播放、暂停、随机定位、章节、动作及元素参数。`projects/motion-showcase/index.html` 是 22 秒静音小样，不带图库工具栏。`projects/bullwhip/index.html` 演示通用片头片尾，`projects/helping-neighbor/index.html` 演示另一条连续叙事。不是 MP4 导出器；生成项目保留 HyperFrames 合成元数据，视频渲染属于另一步可选流程。

发布源包不携带 `node_modules/`、`projects/`、`evidence/`、生成图库或视频；上述命令会在本机生成它们。

## 新故事

复制 `examples/helping-neighbor.json`，修改唯一 `id`、`title`、`objects`、`actions`，再运行 build。保持稳定对象 ID，先画再移动，重叠相关动作，理解性停顿而不是所有事件等间隔排队。

```json
{
  "id": "my-idea", "title": "一个想法", "duration": 8,
  "objects": [
    {"id":"idea","type":"asset","asset":"bulb","x":580,"y":300,"scale":1.2},
    {"id":"word","type":"label","text":"试一试","x":720,"y":740,"size":64}
  ],
  "actions": [
    {"type":"draw","target":"idea","at":0,"duration":1.2},
    {"type":"write","target":"word","at":1,"duration":1},
    {"type":"emphasize","target":"idea","at":2.4,"duration":0.8,"amount":1.1}
  ],
  "chapters": [{"title":"有了想法","at":0}]
}
```

- `asset(type, props)` 在 `src/assets.mjs`；普通元素 240×240，手/笔以笔尖 `(0,0)` 为原点。人物 `pose`：`neutral | talk | think | celebrate`。`seed` 保证确定性，`palette` 仅允许既有色板值。
- `validateStory(story)` 在 `src/schema.mjs`；支持 `asset / label / path / image`。标签 `x` 为中心、`y` 为基线。
- `compileStory(story, {inlineDependencies:true})` 在 `src/compile.mjs`；返回可离线打开的完整 HTML。默认 false 使用同目录 `assets/gsap.min.js`，构建脚本负责原样复制。
- 动作：`draw / write / connect / move / emphasize / erase / camera / hand-draw`。`hand-draw` 要显式 `target` 与 `hand`；支持先完成移动再画，拒绝绘制期间对目标同时移动/强调。
- `erase` 是淡出，不是真实橡皮；`write` 是字体轮廓描绘，不是汉字真实笔顺。文字保持简短，解释交给旁白。
- 音频只读取显式 `audio: [{src:"assets/audio/voice.wav",at:0,duration:12.5}]`，时长须实测。示例均静音；不生成、不克隆声音。资源只可在本 kit 的 `assets/` 下。

通用片头片尾 API 保持独立，不会自动套用到每个故事：

```js
import {withBookends} from './src/templates.mjs';
const film = withBookends(body, {
  topic: '一起学知识',
  concept: 'assets/cards/placeholder.svg',
  application: 'assets/cards/placeholder.svg'
});
```

两张卡成对传入，或全部省略；演示故意重复一张中性占位卡，不冒充知识卡。`contributor` / `reference` 可选，默认不显示。正文和显式音频统一后移 7.72 秒，片尾 8 秒。

## 浏览器路径与验证范围

`CHROME_BIN` 必须指向浏览器**可执行文件**，不是应用目录。显式错误路径会报错，不会悄悄换浏览器。不自动下载浏览器。默认探测 Puppeteer cache、常见 macOS/Linux 路径和 Windows 安装目录。

macOS（zsh/bash）：
```sh
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:browser
```
Linux（bash）：
```sh
CHROME_BIN=/usr/bin/chromium npm run test:browser
```
Windows（PowerShell）：
```powershell
$env:CHROME_BIN = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
npm run test:browser
```

**仅 macOS 实际执行验证；Linux/Windows 是路径兼容设计与配置示例，未在相应系统运行。** 浏览器测试检查所有生成项目、笔尖与路径对齐、前后 seek 像素一致、图库控件、手机宽度和页面错误；证据在 `evidence/`。不要将浏览器截图测试称为成片编码或跨平台测试。

## 文件与许可

`src/` 保留编译/运行/校验/素材/模板边界；`scripts/` 负责构建、占位卡和浏览器测试；`tests/` 是回归测试；`examples/` 是两个正文；`theme.json` 是画布与安全区；`assets/fonts/` 是原字体。`assets/people/` 单独预留给可选姿态/表情扩展，不是核心运行依赖。

见 [第三方许可](licenses/README.md)。GSAP **不是 MIT**；字体是 SIL OFL。所有生成 GSAP 文件必须保留原注释。原课程徽章、系列字样、卡面、参考视频未包含，亦未授予品牌使用权。本 kit 是代码驱动播放器/图库，不是无代码动画编辑器。
