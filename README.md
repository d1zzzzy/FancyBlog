# Monuments

一个「漫游式」3D 博客 —— 纪念碑谷（Monument Valley）风格的等距低多边形世界。每篇文章是一座**纪念碑**，每个分类是一片**街区**。读者滚动游走、拖拽旋转世界、点击纪念碑打开文章。

由原本的单文件 demo 重构为 **Vite + TypeScript + Markdown** 的项目级结构：3D 引擎、UI、内容三层解耦，引擎可复用。

## 快速开始

```bash
npm install
npm run dev       # 本地开发 http://localhost:5173
npm run build     # 类型检查 + 生产构建到 dist/
npm run preview   # 预览构建产物
```

## 写文章

在 `content/<分类>/` 下新增一个 `.md` 文件即可，无需改任何代码 —— 构建时通过 `import.meta.glob` 自动收录，天际线随之重排。

```markdown
---
title: On Keeping a Slow Notebook
category: essay          # 必须是 site.config.ts 中已定义的分类 id
date: Feb 2026           # 用于排序与按年份分组
read: 5 min
excerpt: 占位卡片上显示的一句话简介。
image: /hero.jpg         # 可选，放在 public/ 目录，阅读面板顶部展示
---

正文，支持 **Markdown**。
```

- 同一街区内按 `date` 倒序排列（最新在前）。
- 图片放 `public/`，`image` 用绝对路径（如 `/hero.jpg`）引用。

### 正文里的图片与代码

正文 Markdown 直接支持图片和代码高亮：

- **图片** `![描述](/photo.jpg "可选图注")` —— 自动包成 `<figure>`，`title` 作为图注。图片同样放 `public/`，用绝对路径。
- **代码块** ```` ```ts ```` 围栏代码，用 highlight.js 高亮。已注册的语言：`javascript`/`typescript`/`json`/`bash`/`css`/`xml(html)`/`python`/`markdown`（含 `js`/`ts`/`sh`/`py` 等别名）。未标注或未知语言会自动检测。要加语言：在 `src/content/loader.ts` 顶部 import 并注册即可。

`content/projects/monuments-building-this-skyline.md` 是一个同时含 hero 图、正文图、代码块和引用块的示例。

## 切换布局（天际线 / 魔方盒阵）

`src/content/site.config.ts` 顶部的 `LAYOUT` 决定空间形态:

```ts
export const LAYOUT: LayoutKind = "islands";   // "skyline" | "cube" | "islands"
```

- **`skyline`** —— 原始纪念碑谷天际线:每个分类一排碑,滚轮游走、拖拽转世界、俯瞰全景。
- **`cube`** —— 「林中小屋」式标本盒阵:每个分类是一层水平 slab,层内按 √n 网格排成玻璃格子,**每格关着一座真正的纪念碑谷结构**(金字塔/塔/神庙/穹顶…)+ 顶部发光信标。**拖拽轨道旋转整座立方体,滚轮缩放,点格子相机飞入内部**再开阅读面板。
  - 纪念碑由 `BUILDERS` 生成后**按几何合并、按 9 种原型缓存共享**(`src/engine/cellMonument.ts`),所以每格只是 1 个共享几何的网格,上千格也不爆。代价:旋转机构(螺旋梯/穹顶环)在魔方里是静态的,靠信标做动效。
  - 适合大规模内容:实心立方体天然只露外壳,每帧只对**视锥内**的格子做动画/拾取,关闭了阴影 —— 几百到上千篇也流畅。
  - 分类↔层映射、网格密度、相机手感在 `src/engine/MonumentCube.ts` 顶部常量(`CELL` / `FOCUS_DIST` 等)里调。

### 生成测试内容（看密集效果）

```bash
node scripts/gen-sample-content.mjs 24   # 每个分类 24 篇 filler（gen-*.md）
```

curated 文章会保留;删除 filler 用 glob 删 `content/<分类>/gen-*.md` 即可。

- **`islands`** —— **太空中的荒岛**:每篇文章是一座被留白包围的漂浮孤岛(小基座 + 完整纪念碑 + 信标),由 `src/engine/scatter.ts` **确定性随机散布**在一片空间体里。拖拽轨道旋转、滚轮缩放、点岛飞入;导航主要靠 **Index/搜索**。
  - 散布是**可插拔、可加权**的:`main.ts` 默认已按**最近度**加权(`weightOf: (p) => p.year*12 + 月份`),越新的文章越靠中心、越大;换成自己的热度字段即可。不传则均匀随机。布点有固定 seed,刷新稳定。
  - 氛围:暖色浮尘(`starfield.ts`)、整片岛群默认**极缓自转**、拖拽释放带惯性、hover 浮现标题。
  - **电影感后期**:辉光 Bloom(信标发光晕开)、景深 DOF(总览清晰、飞入某岛背景虚化 rack-focus)、云海雾基倒影(`Reflector`)、聚焦光环、点击涟漪、过滤时同类岛**星座连线**、纪念碑菲涅尔边光。参数在 `MonumentIslands.buildComposer` 与帧循环里。

三种布局共用同一套内容层和阅读/索引/关于/设置 UI;`reader`/`index` 的「跳转到某篇」对魔方/荒岛布局会**自动把相机飞到对应元素**,所以内容多时搜索比滚动更顺手。

## 改站点 / 分类

编辑 `src/content/site.config.ts`：站点名、标语、About 文案、以及**分类（街区）**定义。每个分类可配置颜色、信标（beacon）形状、纪念碑色板。

> 注意：新增分类时，分类 `id` 需同时在 `src/styles/styles.css` 中补一个对应的 glyph 样式类（`.essay` / `.photo` / …），用于 DOM 小图标的形状。

## 目录结构

```
content/                  Markdown 文章（按分类分目录）
public/                   静态资源（图片等）
src/
  main.ts                 组装入口：加载内容 → 起引擎 → 接 UI
  types.ts                跨层共享类型契约
  content/
    site.config.ts        站点与分类配置（改这里来换皮）
    loader.ts             Markdown 加载 / frontmatter 解析 / 渲染 / 分组
  engine/                 ★ 内容无关的可复用 3D 引擎（两种布局）
    MonumentWorld.ts      天际线布局：场景/相机/光照/交互/渲染循环
    MonumentCube.ts       魔方盒阵布局：分层格阵 + 轨道相机 + 飞入
    MonumentIslands.ts    荒岛布局：散布漂浮岛 + 轨道相机 + 飞入
    scatter.ts            确定性、可加权的空间散布算法
    starfield.ts          暖色浮尘氛围（三种布局共用：shell / box 分布）
    cellMonument.ts       把纪念碑合并/缓存成单网格塞进盒子格
    builders.ts           9 种纪念碑建模器 + 信标几何
    geometry.ts           建模辅助（mat / lighten / box）
    skies.ts              天空主题（CSS 背景 + 光照）
    atmosphere.ts         云与鸟
  ui/                     博客专属 DOM 叠加层
    reader.ts             文章阅读面板
    about.ts              关于卡片
    indexSidebar.ts       索引侧边栏（搜索 / 筛选 / 随机）
    router.ts             hash 路由（可分享/收藏的文章链接 + 前进后退）
    hud.ts                天际线 HUD：街区切换、圆点导览、悬浮标牌、俯瞰大标题
    cubeHud.ts            魔方 HUD：分层 chip + 轨道提示
    tweaksPanel.ts        氛围 / 动效设置面板
    util.ts               DOM 小工具
```

## 架构要点

- **引擎与内容解耦**：`MonumentWorld` 只认 `Post` 和 `CategoryConfig`，不知道「essay/photo」具体是什么 —— 把任意 posts + 分类配置喂给它就能升起一座天际线，因此可作为模板复用到别的项目。
- **引擎是导航状态的唯一真相**：所有叠加层通过引擎的方法（`focus` / `enterDistrict` / `enterOverview` / `blur` / `setOverlay`）驱动它，并通过 `onState` 回调与每帧 `onFrame` 回调反向同步 UI。引擎不直接操作业务 DOM。
- **坐标系统**：分类沿 **Z 轴**依次后排，街区内文章沿 **X 轴**排开；正交等距相机，靠 `viewSize` 缩放。

原始单文件 demo 保留在 `Monuments-source/` 作参考。
