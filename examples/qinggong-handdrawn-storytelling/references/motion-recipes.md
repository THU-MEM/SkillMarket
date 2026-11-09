# 动画接线与边界

## 3D卡牌
`scripts/card-3d.mjs`从课程builder抽离。函数`card3D({html,moves,schedule})`接收SVG片段数组、对象运动数组、出现事件数组，返回`svg/overlays/css/runtime/moves/proof`。原案例约定`concept-card/end-concept/end-application`与`assets/concept.png/application.png`；移植时显式修改这些ID、位置和图片路径，不能盲接任意工程。

外层负责最终画布位置/缩放，HTML透视父层负责深度，内层薄卡负责rotateX/Y/Z和z位移。最终展示位停稳，可读。片尾左右错峰翻入。外层固定`will-change:transform`避免seek前后合成层切换产生像素差异。不要把任意SVG分组当可靠3D平面。

## 移动鞭梢
`whipPoints(t)`、`whipPath(t)`是确定性示例；`buildWhipMotion(start,end)`返回初始路径、采样帧、验收摘要与可加入单条GSAP时间线的代码。运行`node scripts/whip-motion.test.mjs`检查真实末端摆幅、柄端小幅度和画布范围。

保持手柄连接点，振幅沿鞭身增长，相位向前传播。示例是教学视觉比喻，不是严格不可伸长绳索物理仿真。描线完成后必须清除旧dash蒙版，否则新增长路径的末端可能不可见。

## 人物
`kit/src/person-poses.mjs`的`personAsset('cry',{seed:17,shirt:'blue'})`返回240×240片段与头、手、脚锚点；默认12姿势。静态SVG可直接作图片。旧schema只认识旧pose集合时，不能填入新名称后假定有效：显式扩展schema和dispatcher，或把静态SVG走已有图片对象通道。

对话时可用轻微前倾、双手/指向姿势、嘴型切换和短气泡，不必伪装成逐音素口型同步。发声起止使用真实音频边界。
