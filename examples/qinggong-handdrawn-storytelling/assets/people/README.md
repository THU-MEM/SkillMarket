# 手绘小人备用资源

12个同风格角色姿势：平静、开心、大笑、难过、哭泣、思考、困惑、挥手、指向、讲解、担心、庆祝。

- 打开 `gallery.html` 浏览；`preview-sheet.png` 是总览。
- `svg/` 每份是240×240透明SVG，无文字、脚本和外部图片依赖。
- `manifest.json` 保存姿势名、配色、seed和头/手/脚锚点。
- 生成模块在 `../../kit/src/person-poses.mjs`，依赖 `roughjs@4.6.6`。在kit目录执行`npm ci --ignore-scripts && npm test`验证。

```js
import {personAsset} from './kit/src/person-poses.mjs';
const person=personAsset('cry',{seed:17,shirt:'blue'});
```
返回 `{markup,width,height,anchors}`。只接收受控pose、整数seed和blue/green上衣；不接收任意XML/CSS。新姿势尚未加入原Storyboard旧schema；可以直接用SVG图片，或显式扩展schema和dispatcher，不悄悄改变旧片几何。

原创文件许可见 `LICENSE` 和 `NOTICE`；Rough.js另受MIT许可。原有课程成片未被这些备用人物替换。
