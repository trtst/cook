# 勋章生成提示词模板

## 目标

这份文档不是记录某一批勋章的固定关键词，而是沉淀一套**以后可重复使用的勋章生成流程**。

后续只要提供：

1. 勋章主题
2. 想强调的情绪或风格倾向

即可按本文模板生成一枚或一组统一风格的勋章提示词。

## 使用流程

### 1. 先定义主题含义

先用一句话说清楚这枚勋章在奖励什么，不先画画面。

格式：

```text
这个勋章奖励用户完成了什么行为 / 达成了什么状态 / 留下了什么纪念
```

例子：

```text
奖励用户第一次在春天邀请朋友来家里吃饭
```

### 2. 提炼视觉隐喻

把抽象主题转成容易看懂的主物件。

常用映射：

| 主题含义 | 常用隐喻 |
| --- | --- |
| 首次完成 | 单一主体 + 完成信号 |
| 多人协作 | 共享餐具 / 围桌 / 多份餐位 |
| 成长积累 | 多层叠加 / 上升 / 发芽 |
| 闭环完成 | 回环箭头 / 清单 / 对勾 |
| 贡献被采纳 | 卡片 / 文档 / 星标 / 徽记 |
| 限时活动 | 季节物件 / 节日气氛 / 时间感元素 |
| 纪念收藏 | 柔光 / 收藏感主体 / 稳定对称构图 |

### 3. 拆成三层画面

每次都只定义这三层，避免画面发散：

1. `核心主体`
2. `辅助元素`
3. `动作线索`

约束：

- 核心主体只保留 1 个
- 辅助元素控制在 1 到 3 个
- 动作线索只保留 1 个最强信号

### 4. 定义情绪和色彩

每次只定一个主情绪和一个主色方向。

常用情绪：

- 温暖
- 清新
- 协作
- 庆祝
- 沉稳
- 珍贵

常用色彩表达：

- 温暖：米白、暖黄、橙金
- 清新：浅绿、嫩叶绿、米白
- 协作：薄荷绿、淡蓝、奶油白
- 庆祝：金黄、杏橙、亮米白
- 沉稳：灰蓝、柔金、深绿
- 珍贵：蜂蜜金、琥珀、暖白

### 5. 套统一章体骨架

这部分以后固定不变，保持整套勋章系统一致：

```text
200x200 PNG, transparent background, soft-rounded regular hexagon badge, no outer stroke, inner 2px white line, subject close to edges, compact composition, centered main object, strong 3D badge depth, the hexagon shell itself has visible thickness, layered front and side surfaces, polished highlights, soft shadow, clean layered shapes, subtle translucent overlays, premium icon-like scene, consistent badge system, high readability at small size, ready for direct backend upload
```

中文理解：

```text
200x200 PNG，透明背景，软圆角正六边形章体，无外描边，内收 2px 白线，主体贴近边缘，构图紧凑，主体居中，偏强 3D 立体质感，六边形章体本身要有厚度和侧面，带高光、投影和前后层次，小尺寸清晰，可直接上传后台
```

### 6. 最后输出双态

同一构图固定输出两份：

- `earned`：获得态，高亮、饱和度更高、焦点更亮
- `locked`：未获得态，降饱和、偏冷灰，但构图完全一致

## 字段清单

后续每次只需要填下面这几个字段：

```text
主题：
这个勋章奖励什么行为或结果

核心主体：
画面最重要的一个物件

辅助元素：
1~3 个补充物件

动作线索：
一个能表达完成 / 协作 / 成长 / 解锁的视觉动作

情绪：
温暖 / 清新 / 协作 / 庆祝 / 沉稳 / 珍贵

色彩方向：
主色 + 辅色

细节要求：
要强调什么，不要出现什么
```

## 通用英文提示词模板

```text
Create a medal in a unified badge system.

Base style:
200x200 PNG, transparent background, soft-rounded regular hexagon badge, no outer stroke, inner 2px white line, subject close to edges, compact composition, centered main object, strong 3D badge depth, the hexagon shell itself has visible thickness, layered front and side surfaces, polished highlights, soft shadow, clean layered shapes, subtle translucent overlays, premium icon-like scene, consistent badge system, high readability at small size, ready for direct backend upload.

Theme:
[这里写主题含义]

Core object:
[这里写核心主体]

Supporting objects:
[这里写辅助元素]

Action cue:
[这里写动作线索]

Mood:
[这里写情绪]

Palette:
[这里写色彩方向]

Requirements:
keep the composition simple and iconic, no text, no numbers, no ribbon shell, no extra outer frame, no heavy outline, no petal shape, no clover shape, fill the canvas tightly, avoid large empty transparent margins

Output:
1 earned version as transparent PNG with vivid colors, stronger highlights, stronger shell depth
1 locked version as transparent PNG with desaturated cool-gray treatment, same composition
```

## 例子

需求：

```text
我想做一枚“春天一起开饭”的勋章，感觉要温暖、清新一点。
```

按流程拆解：

```text
主题：
奖励用户在春天完成一次和朋友一起开饭的纪念时刻

核心主体：
一只共享的大碗

辅助元素：
两到三套餐位、嫩叶、蒸汽

动作线索：
围桌共享的感觉，热气向上

情绪：
温暖、清新、协作

色彩方向：
浅绿、米白、暖黄

细节要求：
主体贴边，不要字，不要数字，不要外壳绶带
```

最终提示词：

```text
Create a medal in a unified badge system.

Base style:
200x200 PNG, transparent background, soft-rounded regular hexagon badge, no outer stroke, inner 2px white line, subject close to edges, compact composition, centered main object, strong 3D badge depth, the hexagon shell itself has visible thickness, layered front and side surfaces, polished highlights, soft shadow, clean layered shapes, subtle translucent overlays, premium icon-like scene, consistent badge system, high readability at small size, ready for direct backend upload.

Theme:
rewarding a spring shared meal moment with friends

Core object:
a central shared bowl

Supporting objects:
two or three place settings, fresh spring leaves, soft rising steam

Action cue:
a collaborative shared-table feeling with upward steam

Mood:
warm, fresh, collaborative

Palette:
light green, rice cream, soft warm yellow

Requirements:
keep the composition simple and iconic, no text, no numbers, no ribbon shell, no extra outer frame, no heavy outline, no petal shape, no clover shape, fill the canvas tightly, avoid large empty transparent margins

Output:
1 earned version as transparent PNG with vivid colors, stronger highlights, stronger shell depth
1 locked version as transparent PNG with desaturated cool-gray treatment, same composition
```

## 当前推荐口径

后续默认不再写“生成 SVG 勋章”，统一改成：

```text
生成 200x200 的透明 PNG 勋章图，可直接上传后台。
```

如果只是概念探索，可以先只生成 `earned` 一张；如果要进入后台或前端联调，默认直接生成：

1. `earned.png`
2. `locked.png`

## 推荐使用方式

后续可以直接这样提需求：

```text
按勋章模板生成，主题：秋天丰收晚餐，偏温暖、庆祝
```

或者：

```text
按勋章模板生成，主题：第一次邀请朋友来家里吃饭，偏珍贵、纪念感
```

然后按本文流程生成整套提示词，再输出对应的 earned / locked 双态勋章。
