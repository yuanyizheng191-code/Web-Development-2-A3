# 管理端网站（Admin console）

Angular v22 单页应用，通过同一个 Express 应用挂在 **`/admin/`** 路径下。
本文件夹是管理端的**源码工程**，构建产物由 `tools\build_all.ps1` 复制到 `api\public\admin\`。

## 页面和对应接口

| 页面 | 路由 | 调用的接口 | 说明 |
|---|---|---|---|
| 仪表盘 | `/dashboard` | `GET /api/dashboard` | 活动数、报名数、售票数、收入、按状态统计 |
| 活动列表 | `/events` | `GET /api/events?status=upcoming,active,suspended,past`<br>`DELETE /api/events/:id` | 显示全部状态；删除有报名的活动会被拦住 |
| 新增活动 | `/events/new` | `POST /api/events`<br>`GET /api/categories`、`GET /api/organisations`<br>`GET /api/geocode` | 分类和机构来自下拉接口；「查找坐标」用地理编码填充经纬度 |
| 修改活动 | `/events/:id/edit` | `GET /api/events/:id`<br>`PUT /api/events/:id`<br>`GET /api/geocode` | 同一组件复用；侧栏同时显示该活动的报名数据 |
| 报名查看 | `/events/:id/registrations` | `GET /api/events/:id/registrations`<br>`DELETE /api/registrations/:id` | 按报名时间倒序；可取消单条报名 |
| 关于 | `/about` | 无 | 技术栈、接口清单、数据库约束 |
| 未找到 | `**` | 无 | 404 页面 |

## 删除保护规则

数据库层面对 `registrations.event_id` 设了 **`ON DELETE RESTRICT`**，所以
删除一个已经有报名记录的活动时，MySQL 会拒绝操作，API 返回 **HTTP 409**。

管理端列表页会把这个 409 的说明直接显示给用户，并在有报名的活动行上标注
「受保护」，避免管理员反复尝试。要删掉这样的活动，需要先在**报名查看**页
把它的报名全部取消。

## 和客户端网站的关系

两个网站结构完全一致（Header / Nav / Body / Footer 四个区块），
但**各自独立构建**，因为它们在同一台服务器上以不同 base href 发布：

| | 客户端网站 | 管理端网站 |
|---|---|---|
| 目录 | `ng-client\` | `ng-admin\` |
| 发布路径 | `/` | `/admin/` |
| base href | `/` | `/admin/` |
| 主色 | 翡翠绿 | 靛蓝 |
| 主要用户 | 访客、报名者 | 活动管理员 |

## 本地运行

```bash
cd ng-admin
npm install
npm start          # http://localhost:4200/admin/
```

开发时需要 API 同时在跑（`cd api && npm start`，默认 3000 端口），
`src\environments\environment.ts` 里配置了 API 地址。

## 生产构建

```bash
npx ng build --configuration production --base-href /admin/
```

构建产物在 `dist\adminside\browser\`，复制到 `api\public\admin\` 即可。
