# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

**Monuments** 是一个「漫游式」3D 博客：用纪念碑谷（Monument Valley）风格的等距低多边形世界呈现文章。每篇文章是一座**纪念碑**(monument)，每个分类是一片**街区**(district)。读者滚轮游走、拖拽旋转世界、点击纪念碑打开阅读面板。

技术栈 **Vite + TypeScript + three.js**，内容用 **Markdown** 撰写。由一个单文件 demo（保留在 `Monuments-source/`，仅作参考，不要在那里改东西）重构而来，拆成 **engine / ui / content** 三层。

## 常用命令

```bash
npm install
npm run dev       # 开发服务器（HMR）
npm run build     # tsc --noEmit 类型检查 + vite build → dist/
npm run preview   # 预览 dist 产物
```

没有测试套件。验证改动靠 `npm run build`（类型检查会拦住大多数回归）+ 浏览器目视。

## 架构（大局）

三层解耦，依赖方向单向：`content → engine`，`ui → engine`，`main.ts` 把三者装配起来。

### 内容层 `src/content/` + `content/*.md`
- `loader.ts` 用 `import.meta.glob('../../content/**/*.md', { query:'?raw', eager:true })` 在构建时收录所有 Markdown，解析 frontmatter（自写的极简 `key: value` 解析器，**不是 YAML**，只支持标量），用 `marked` 渲染正文，按 `site.config.ts` 的分类顺序分组、街区内按 `date` 倒序、并赋 `local`(街区内序号) 与 `n`(全局编号)。
- Markdown 渲染配置也在 `loader.ts`：`marked-highlight` + `highlight.js/lib/core`（**只注册了一组精选语言**以控制体积，加语言要在这里 import+register）做代码高亮；自定义 image renderer 把图片包成 `<figure class="r-image">`。hljs 主题在 `main.ts` 里 `import "highlight.js/styles/atom-one-light.css"`，正文样式在 `styles.css` 的 markdown body 段。
- `site.config.ts` 是**换皮入口**：站点名、标语、About、以及分类(街区)定义（颜色、信标形状、色板）。
- 加文章 = 在 `content/<cat>/` 下加一个 `.md`，无需改代码。

### 引擎层 `src/engine/`（★ 内容无关、可复用，**两种布局二选一**）
- 由 `site.config.ts` 的 `LAYOUT: "skyline" | "cube" | "islands"` 决定,`main.ts` 据此实例化对应引擎。三个引擎**满足同一组 UI 需要的方法**(`focus`/`blur`/`setOverlay`/`applyTweaks`/`state`/`onFrame`/`onState`),所以 reader/about/index/tweaks 原样复用;cube 与 islands 还共用 `cubeHud`(后者把 `spinToLayer` 解释为"飞到该分类质心")。
- `MonumentWorld.ts`(天际线)：分类沿 **Z 轴**后排(`z=-d*DZ`)，文章沿 **X 轴**(`x=local*DX`)；正交等距相机靠 `viewSize` 缩放;滚轮游走、`enterDistrict`/`enterOverview`/`setPos`;UI 用 `screenOf(x,y,z)` 投影定位标牌。
- `MonumentCube.ts`(魔方盒阵)：每个分类一层水平 slab(`y=(d-(L-1)/2)*CELL`)，层内 √n 网格;每格 = 玻璃边框(LineSegments) + **真正的纪念碑结构** + 顶部发光信标。**透视相机轨道旋转**(拖拽改 azimuth/elevation、滚轮改 distance)，点格子 `focusOn` 捕捉当前视线方向把相机**飞入该格**;关闭阴影;每帧用 `Frustum.intersectsSphere` **只对视锥内格子做动画/raycast**(为上千篇做的剔除)。
- `MonumentIslands.ts`(荒岛)：每篇文章一座漂浮孤岛(基座+完整纪念碑+信标),位置由 `scatter.ts` 确定性散布在一片空间体里;透视轨道相机(拖拽释放带**惯性滑行 + 俯仰/缩放柔性边界**)、点岛飞入,导航主要靠 Index/搜索。hover 某岛时 `hoverInfo()` 给出屏幕锚点,`ui/hoverLabel.ts` 用单个浮动 DOM 显示标题。`scatter.ts` 是**可加权**的(传 `weightOf(post)` 让高权重更靠中心+更大),有固定 seed 保证刷新稳定。
- `cellMonument.ts`：把 `BUILDERS` 生成的纪念碑**合并成单个 BufferGeometry(base/accent 两个材质组)、按原型缓存共享**(几何只 9 份、材质按颜色缓存),让每格只用 1 个网格塞进盒子。代价:旋转机构被烘焙成静态(信标补动效)。注意 `BUILDERS` 里只用 Box/Cone/Sphere(都 indexed),所以 `mergeGeometries` 能合并;若新增非 indexed 几何(如 Octahedron/Icosahedron,目前仅信标用)会合并失败。
- 测试内容:`scripts/gen-sample-content.mjs [n]` 生成每类 n 篇 `gen-*.md` filler(保留 curated)。
- **引擎是导航状态唯一真相**,不触碰业务 DOM(仅 canvas、body 背景、loader)。
- 共享:`builders.ts`(建模器+`beaconGeo`)、`geometry.ts`、`skies.ts`(CSS 背景+光照+`makeSkyTexture` 场景内天空)、`atmosphere.ts`(云鸟)、`starfield.ts`(暖色浮尘 + `dotTexture`/`ringTexture`,三种布局共用)、`cellMonument.ts`(纪念碑材质带菲涅尔边光)。
- 荒岛**电影感后期**(仅 islands):`EffectComposer`(多重采样+半精度全分辨率目标,否则发糊)= RenderPass → `BokehPass`(总览近全清晰、飞入某岛光圈渐开做 rack-focus)→ `UnrealBloomPass`(信标 emissive 提到 1.4 越过阈值发光晕开)→ `OutputPass`。需要不透明场景内天空(`scene.background`)才能正确合成。另有 `Reflector` 云海雾基、聚焦光环/点击涟漪(ring sprite)、过滤时同类岛**星座连线**(`LineSegments`,连最近 2 邻)。
- 共同细节:三种布局都有浮尘 + 极缓自转/漂移;魔方点格子时纪念碑用 `easeOutBack` 升起并转正、信标中途闪一下;天际线长街区支持 `Home/End/PgUp/PgDn` 快速跳转。

### UI 层 `src/ui/`（博客专属 DOM）
- `reader`(阅读面板:进度条 + 图片点击放大 lightbox + 代码块复制) / `about`(关于卡) / `indexSidebar`(搜索索引) / `tweaksPanel`(氛围设置) / `router`(hash 路由,`#/<cat>/<id>`,可分享/收藏/前进后退) / `util` —— **布局无关,三种引擎共用**。
- 路由接线:`main.ts` 里 `openReader` 在开阅读面板时 `router.setPost`,`onState` 聚焦清空时 `router.setPost(null)`;`router.onPost/onHome` 反向驱动 `world.focus/blur`,`router.start()` 在装配末尾读初始 URL。
- 荒岛分类过滤:点底部分类 chip,非该类的岛**塌缩成一颗发光小星(Sprite)**(`island.star`),而非缩小;`spinToLayer` 被解释为切换 `filterCat`。
- `hud`(天际线专属:街区切换、圆点导览、悬浮标牌、俯瞰大标题) vs `cubeHud`(魔方专属:分层 chip);`main.ts` 按 `LAYOUT` 二选一。
- 每个模块是一个 `createX(opts)` 工厂，接收引擎 + 回调，返回 `{ open/close/isOpen/... }`。

### 装配 `src/main.ts`
- 加载内容 → 建 reader → `new MonumentWorld` → 建 hud/about/index/tweaks → 接线。
- 注意**前向引用**：`reader` 在 `world` 之前创建，其回调通过 `let world` 闭包延迟引用；`hud` 在 `world` 之后创建，`onState` 用 `hud?.sync` 守卫构造期的首次触发。
- 全局 `Escape` 与 brand 点击在 main 里处理（按层级回退）；引擎只处理导航键(方向键/`[`/`]`)与滚轮/拖拽。

## 改动注意

- **加分类**：在 `site.config.ts` 加 `CategoryConfig`，并在 `src/styles/styles.css` 给该 `id` 补一个 glyph 形状类（`.essay`/`.photo`/…，用于 DOM 小图标）。信标形状只有 `cone/icosahedron/box/octahedron` 四种（见 `BeaconShape`）。
- **加可调项**：需同时改 `tweaksPanel.ts`(UI+`DEFAULTS`)、`types.ts` 的 `Tweaks`、以及消费端（`MonumentWorld.applyTweaks` 或 `hud.setLabelsVisible`）。
- **block 注释里别出现 `*/`**：Markdown 路径 `content/**/*.md` 含 `*/` 会提前闭合注释（已踩过一次坑）。
- `Monuments-source/` 是旧 demo，只读参考，不要改。
