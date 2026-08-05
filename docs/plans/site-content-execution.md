# 功能执行单：PC 官网与内容中心

## 目标

- 为 **炊火记** 增加一个对外可访问的 PC 官网入口，用于承接品牌介绍、产品理解、二维码转化、关于我们和法务说明。
- 为纯展示内容建立一套单内容源方案，让 PC 端访问和小程序内嵌访问共用同一份内容，不再双端各写一版。
- 当前先落执行边界、信息架构、工程方案和阶段计划，不进入首页视觉定稿和页面开发。

## 当前确认

- 官网不是 PC 业务端，不承接登录后菜谱、冰箱、购物、饭搭子等正式业务操作。
- 当前最适合先做的是 “官网 + 内容中心 + 小程序 `web-view` 内嵌内容页”，不是 “第四个业务客户端”。
- 纯展示内容包括但不限于：关于我们、隐私政策、用户协议、常见问题、厨房准备、烹饪技巧、食谱技巧、更新日志。
- 这类内容页需要支持同一篇内容在 PC 端平铺阅读、移动端按目录或章节折叠阅读。
- 首页希望视觉上更有记忆点，但不能偏离项目主旨；首页具体视觉稿在开发前单独细聊，本文件先只记录方向约束。
- 官网和内容页需要从首版开始考虑暗黑模式，不把亮色写死成唯一视觉前提。
- 响应式能力尽量支持，但按页面类型分级处理：纯内容页默认适配移动端，首页和品牌页按设计复杂度决定响应式深度，不预设所有断点形态一次做满。

## 本轮范围

### 包含

- 官网与内容中心的定位、边界和信息架构。
- `apps/site` 独立应用的推荐工程方案。
- 纯展示内容的页面类型、URL 形态、内容结构和小程序内嵌策略。
- 首页视觉方向约束和后续实施阶段划分。

### 不包含

- 官网首页视觉稿、动效稿、组件稿和实际前端实现。
- PC 端登录、PC 端菜谱管理、PC 端饭搭子操作、PC 端冰箱和购物业务页。
- CMS、评论、公开社区、用户搜索、公开 UGC 内容站。
- 内容审核流、复杂搜索、标签体系、全文检索和推荐系统。
- 对当前小程序 V1 主链路的产品规则改写；本文件只定义新增交付线，不改写既有主文档的业务边界。

## 方案结论

### 交付形态

- 新增独立应用 `apps/site`，承接官网首页、品牌说明页和内容中心页。
- 纯展示内容由 `apps/site` 提供统一 Web 页面。
- 小程序通过通用 `web-view` 页面打开同一内容 URL，不再在 `apps/client` 内维护第二套富文本页面。

### 内容维护策略

- 第一阶段使用站内本地内容源，优先保证内容结构、页面模板和双端展示一致，先把展示链路跑通。
- 第二阶段已确认升级为 `apps/admin` 后台编辑 + `apps/api` 内容接口 + `apps/site` 前端请求渲染，不再长期停留在本地内容文件模式。
- 在进入第二阶段前，不先引入复杂 CMS、审核流、评论、搜索和多角色内容权限。

### 工程边界

- 官网代码只放在 `apps/site`，不把官网页面塞进 `apps/admin`。
- 小程序业务代码仍留在 `apps/client`；官网内容只通过 URL 内嵌，不直接复用 uni-app 页面源码。
- 不让一个应用直接导入另一个应用的业务源代码；如果后续需要共享内容 schema，可单独下沉到共享包。

## 联动开发策略

按两阶段推进，不做四端同时起跑。

### 第一阶段：先跑通展示链路

目标：先验证内容模板、PC 展示、小程序内嵌、暗黑模式和响应式是否成立。

#### `apps/site`

- 新建官网应用和内容中心壳
- 实现路由、主题 token、暗黑模式、`DocumentPage`
- 使用本地内容源渲染 `about / privacy / terms / faq / guides / changelog`

#### `apps/client`

- 新增通用内容承接页
- 通过 `web-view` 打开 `apps/site` 内容 URL
- 将小程序里的纯展示内容入口统一到这一承接页

#### `apps/api`

- 第一阶段不开发内容接口
- 只在文档中预留第二阶段内容字段与契约方向

#### `apps/admin`

- 第一阶段不开发内容编辑后台
- 不为未来能力提前建设空 CMS 壳

### 第二阶段：升级为后台编辑 + 接口出数

目标：让“关于我们、隐私政策、FAQ、技巧内容”等页面可由后台维护，前端通过接口请求渲染。

#### `apps/api`

- 新增内容读取接口
- 后续按需要补内容管理接口
- 统一内容主事实和公开读取结构，例如 `slug / type / title / summary / updatedAt / effectiveAt / publishStatus / sections`

#### `apps/admin`

- 新增轻量内容管理模块
- 支持列表、编辑、草稿、发布、排序、SEO 字段和小程序可见性开关

#### `apps/site`

- 从本地内容源切换到接口请求
- 保持页面模板和 URL 结构稳定，避免内容源切换牵动页面重写

#### `apps/client`

- 继续通过 `web-view` 打开同一内容 URL
- 尽量不因第二阶段改造而新增第二套内容渲染逻辑

### 当前状态

- `apps/site`：可开发
- `apps/client`：可开发
- `apps/api`：第二阶段待开发
- `apps/admin`：第二阶段待开发

## 第一阶段 PC 部署要求

当前官网是独立的 `apps/site` 静态前端，不跟 `apps/admin` 共用构建产物。

部署要求先收口为最小闭环：

- 构建命令使用 `pnpm build:site`
- 产物目录为 `apps/site/dist`
- 服务器需要把 `apps/site/dist` 作为站点根目录发布
- 路由采用 Vue Router `history` 模式，服务端必须把非静态资源请求回退到 `index.html`

如果服务器使用 nginx，至少要满足这类回退语义：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

否则首页虽然能打开，但像 `/privacy`、`/faq`、`/guides/kitchen-prep` 这类直达 URL 会在刷新或直接访问时返回 404。

按当前仓库部署脚本的默认执行目录 `/srv/cook`，如果官网域名使用 `https://www.trtst.com`，可先按下面这份 nginx 示例落地：

- 仓库内可直接复用的配置文件：`deploy/nginx/site.trtst.com.conf`

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name www.trtst.com;

  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name www.trtst.com;

  root /srv/cook/apps/site/dist;
  index index.html;

  ssl_certificate /etc/letsencrypt/live/www.trtst.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/www.trtst.com/privkey.pem;

  location /assets/ {
    try_files $uri =404;
    access_log off;
    expires 7d;
    add_header Cache-Control "public, max-age=604800, immutable";
  }

  location = /favicon.ico {
    try_files $uri =404;
    access_log off;
    expires 1d;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

如果还要把裸域 `trtst.com` 也统一跳到 `www.trtst.com`，再补一段跳转即可：

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name trtst.com;

  return 301 https://www.trtst.com$request_uri;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name trtst.com;

  ssl_certificate /etc/letsencrypt/live/www.trtst.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/www.trtst.com/privkey.pem;

  return 301 https://www.trtst.com$request_uri;
}
```

上线前至少确认这 4 项：

- `pnpm build:site` 后 `apps/site/dist/index.html` 已生成
- nginx `root` 指向真实发布目录，而不是仓库源码目录
- `ssl_certificate` 和 `ssl_certificate_key` 已替换成服务器真实证书路径
- `https://www.trtst.com/privacy`、`https://www.trtst.com/faq` 这类直达路由可直接访问且刷新不 404

## `www.trtst.com` 正式上线步骤清单

下面这份步骤默认服务器项目目录就是 `/srv/cook`，官网仍沿用当前仓库内的 `apps/site` 构建产物。

### 首次上线

1. 登录服务器并进入项目目录

```bash
cd /srv/cook
```

2. 拉取最新代码并安装依赖

```bash
git pull
pnpm install
```

3. 构建官网静态站点

```bash
pnpm build:site
```

4. 确认产物已生成

```bash
ls /srv/cook/apps/site/dist
```

5. 放置 nginx 配置

- 仓库内示例文件：`deploy/nginx/site.trtst.com.conf`
- 将其复制到服务器 nginx 配置目录，例如：

```bash
cp /srv/cook/deploy/nginx/site.trtst.com.conf /etc/nginx/conf.d/site.trtst.com.conf
```

6. 按服务器真实证书路径修改下面两项

- `ssl_certificate`
- `ssl_certificate_key`

7. 校验 nginx 配置并重载

```bash
nginx -t
systemctl reload nginx
```

8. 首次上线后做直连检查

```bash
curl -I https://www.trtst.com/
curl -I https://www.trtst.com/privacy
curl -I https://www.trtst.com/faq
```

验收口径：

- 首页返回 `200`
- `/privacy`、`/faq` 直达返回 `200`
- 刷新上述页面不出现 nginx `404`
- `http://www.trtst.com` 自动跳到 `https://www.trtst.com`
- 如果启用裸域跳转，`https://trtst.com` 自动跳到 `https://www.trtst.com`

### 后续发版

如果 nginx 配置和证书都已经稳定，后续只需要执行官网发布链路即可：

```bash
cd /srv/cook
./deploy.sh site
```

如果本次同时发布 api、admin、site，则执行：

```bash
cd /srv/cook
./deploy.sh full
```

### 出问题时先查这 5 项

1. `apps/site/dist/index.html` 是否是本次最新构建产物
2. nginx `root` 是否仍指向 `/srv/cook/apps/site/dist`
3. `systemctl reload nginx` 前是否已经 `nginx -t`
4. 证书路径是否真实存在且域名匹配 `www.trtst.com`
5. 若首页能开但子路由 404，优先检查 `try_files $uri $uri/ /index.html`

## 服务器执行命令版

如果你现在就是在服务器上手动执行，可以直接按下面顺序跑。

### 首次上线命令版

```bash
cd /srv/cook
git pull
pnpm install
pnpm build:site
ls /srv/cook/apps/site/dist
cp /srv/cook/deploy/nginx/site.trtst.com.conf /etc/nginx/conf.d/site.trtst.com.conf
vim /etc/nginx/conf.d/site.trtst.com.conf
nginx -t
systemctl reload nginx
curl -I https://www.trtst.com/
curl -I https://www.trtst.com/privacy
curl -I https://www.trtst.com/faq
```

执行时只需要人工确认 2 件事：

1. 在 `vim /etc/nginx/conf.d/site.trtst.com.conf` 里把证书路径改成服务器真实路径
2. 如果 nginx 配置目录不是 `/etc/nginx/conf.d`，把 `cp` 目标路径换成你的真实目录

### 后续仅发官网命令版

```bash
cd /srv/cook
./deploy.sh site
curl -I https://www.trtst.com/
curl -I https://www.trtst.com/privacy
curl -I https://www.trtst.com/faq
```

### 同时发 api、admin、site 命令版

```bash
cd /srv/cook
./deploy.sh full
curl -I https://www.trtst.com/
curl -I https://www.trtst.com/privacy
curl -I https://www.trtst.com/faq
```

## 信息架构

### 1. 官网层

- 首页
- 产品介绍
- 场景介绍
- 关于我们
- 联系我们

### 2. 内容中心层

- 常见问题
- 厨房准备
- 烹饪技巧
- 食谱技巧
- 新手入门
- 更新日志

### 3. 法务层

- 隐私政策
- 用户协议
- 必要时再补未成年人说明、免责声明或会员说明

## 页面类型与内容模型

建议不要把所有内容都当成同一种文章，先按展示目标拆成 4 类。

### `page`

用于固定说明页：

- 首页扩展说明
- 关于我们
- 隐私政策
- 用户协议

建议字段：

- `slug`
- `title`
- `summary`
- `updatedAt`
- `effectiveAt`
- `sections`
- `seoTitle`
- `seoDescription`

### `faq`

用于结构化问答：

- 常见问题

建议字段：

- `slug`
- `title`
- `summary`
- `updatedAt`
- `groups`
- `items`

### `article`

用于知识内容：

- 厨房准备
- 烹饪技巧
- 食谱技巧
- 新手入门

建议字段：

- `slug`
- `title`
- `summary`
- `updatedAt`
- `cover`
- `toc`
- `sections`
- `relatedSlugs`

### `changelog`

用于版本和进展记录：

- 更新日志

建议字段：

- `slug`
- `title`
- `summary`
- `updatedAt`
- `entries`

## 纯展示页统一版式

这类页面统一走一套 `DocumentPage` 模板，不为每个页面重复搭壳。

统一组成：

- 顶部页头：标题、副标题、更新时间、生效时间
- 文档信息栏：适用于协议类页面
- 目录区：按标题层级生成
- 正文区：按章节渲染
- 移动端折叠区：长文时允许章节折叠

### PC 端表现

- 内容居中限宽
- 目录默认可见
- 正文默认全文展开
- 适合长文连续阅读和搜索引擎收录

### 移动端表现

- 目录默认折叠
- 长章节允许手风琴式展开
- 顶部先展示摘要，再进入正文
- 优先保证小程序内嵌阅读成本可控

## 主题与响应式策略

### 暗黑模式

- `apps/site` 首版即按亮色 / 暗色双主题设计基础 token，不接受只做亮色后续再补的路线。
- 纯展示内容页必须保证暗黑模式下的正文、标题、分割线、引用、表格、代码块和目录层级都可读。
- 首页允许为视觉表现增加更强的主题氛围，但不能依赖只在亮色成立的背景图、阴影和发光关系。
- 任何截图型素材都要考虑暗色背景下的边界与衬底，避免出现“图片悬空发白”或“深色页里只剩一团黑”。

### 响应式

- 纯文本内容页按“PC 平铺 + 移动折叠”的模式默认支持响应式，这是确认范围内的必做项。
- FAQ、法务、关于我们、更新日志这类文档页，应优先保证手机宽度和小程序内嵌宽度下的可读性，而不是保留 PC 样式缩放版。
- 首页、产品介绍、场景介绍这类品牌页尽量支持响应式，但允许按真实设计复杂度决定是否采用完整多断点布局，还是收口为桌面版 + 单一移动版。
- 响应式的目标是保证阅读、点击和信息层级成立，不追求每个模块在所有尺寸下完全同构。

## URL 方案

建议保持扁平、稳定，不把内容模型深度编码进路径。

建议路由：

- `/`
- `/product`
- `/scenes`
- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/faq`
- `/guides/kitchen-prep`
- `/guides/cooking-skills`
- `/guides/recipe-skills`
- `/changelog`

不建议：

- `/content/legal/privacy-policy/v1`
- `/pages/help/article/cooking/basic/knife-skill`

## 小程序内嵌方案

### 推荐做法

- 在 `apps/client` 中新增一个通用内容承接页，例如 `pages_webview/content/index`。
- 页面只负责接收 `slug` 或最终 URL，并通过 `web-view` 打开官网内容页。
- 小程序内的“隐私政策 / 关于我们 / FAQ / 技巧类内容”全部走这一入口。

### 适合内嵌的页面

- 关于我们
- 隐私政策
- 用户协议
- 常见问题
- 厨房准备
- 烹饪技巧
- 食谱技巧
- 更新日志

### 不适合内嵌的页面

- 菜谱编辑
- 冰箱
- 购物清单
- 饭搭子管理
- 任何登录后强交互业务页

## 首页方向约束

首页开发时再细聊具体视觉，但方向先固定，避免后面做成偏题的炫技站。

### 已确认方向

- 视觉可以更有冲击力，但核心叙事必须始终围绕“下一顿吃什么”和家庭烟火感。
- 不能做成泛 SaaS 工具官网，也不能做成脱离产品主线的科技概念页。
- 重点要表达的是“帮你把家里下一顿安排顺”，不是“海量菜谱平台”。

### 视觉约束

- 气质：温暖、生活化、轻节奏，有记忆点，但不过度卡通
- 文案：强调家庭协作、做饭决策、计划与准备，不强调社交或社区
- 素材：真实产品截图、生活场景插画、品牌识别元素
- 动效：可以有有节制的分段入场、滚动叙事和层次变化，但不能喧宾夺主
- 主题：首页方案必须同时考虑亮色和暗色表现，不接受只在单主题下成立的视觉叙事
- 响应式：首页尽量支持桌面与移动两套稳定阅读结构，但是否扩到更多断点形态，开发前按真实设计复杂度再定

### 当前不定稿

- 首屏构图
- 动效节奏
- 主视觉样式
- 字体和插画方向

这些保留到首页开发前单独确认。

## 推荐实施顺序

### 第一阶段：官网与内容页基础壳

- 新建 `apps/site`
- 建立路由、基础布局、内容页统一模板
- 先接入 `about / privacy / terms / faq / guides / changelog`
- 小程序补通用 `web-view` 内容入口

### 第二阶段：首页与品牌页

- 细化首页信息架构
- 确认首页视觉稿和动效边界
- 完成首页、产品介绍、场景介绍、联系入口

### 第三阶段：运营化增强

- 视真实维护频率决定是否补 API + Admin 内容管理
- 再评估 sitemap、SEO 增强、统计埋点、分享图、报名表单

## 首版验收

### 可见结果

- 存在一套明确的官网与内容中心执行边界。
- 纯展示内容页有统一模板，不需要 PC 和小程序分别维护两版文案。

### 交互结果

- PC 端内容页默认适合平铺阅读。
- 小程序端内容页可通过 `web-view` 打开，并适配移动端阅读。

### 数据结果

- 首版不要求后台内容管理，不新增业务数据表和复杂内容审核流。

## 待后续确认

- 官网独立域名还是挂主域名子路径
- 首页是否需要强 SEO 预渲染或静态导出
- 内容源第一阶段使用 Markdown、JSON，还是二者混合
- 法务文本是否需要法审版本号和生效时间管理
- 是否需要内容页站内搜索
- 是否需要后台内容发布入口

## 风险与边界提醒

- 一旦把官网做成登录后业务端，范围会立刻从品牌与内容承接扩成第四个正式客户端，需要重新确认产品边界。
- 如果一开始就建设 CMS、评论、搜索和内容运营体系，会拖慢官网落地，且当前没有证据证明这是首版必要项。
- 小程序内嵌适合纯展示内容，不适合代替核心业务页面。
