# 业务错误码与空态合同迁移设计

## 已确认目标

业务接口在已进入服务端处理后，统一以 HTTP `200` 返回 envelope。HTTP 状态只表示传输或基础设施问题，不再与业务 `code` 使用同一组数字。

```ts
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  serverTime: string;
}
```

`code = 0` 表示本次业务调用成功完成。它允许 `data` 为 `null`，但只有该接口已明确定义“当前没有候选资源”是正常结果时才成立。

## 业务码表

| code | 名称 | 含义 |
| ---: | --- | --- |
| `0` | `SUCCESS` | 业务成功；数据可以是对象、分页对象、数组或约定的 `null` |
| `10001` | `INVALID_REQUEST` | 参数、当前状态或业务前置条件不满足 |
| `10002` | `UNAUTHENTICATED` | 未登录、token 或刷新凭证失效 |
| `10003` | `FORBIDDEN` | 已确认资源存在，但当前主体无此操作权限 |
| `10004` | `RESOURCE_NOT_FOUND` | 资源不存在、已删除、分享失效，或因隐私不应暴露资源存在 |
| `10005` | `CONFLICT` | `version`、幂等键或并发状态冲突 |
| `10006` | `RATE_LIMITED` | 请求频率受限 |
| `10007` | `FEATURE_UNAVAILABLE` | 功能尚未开放 |

路由未命中、协议/网关/网络故障，以及未捕获的系统异常保留 HTTP 非 2xx；客户端先判断 HTTP 状态，再判断 envelope 中的业务码。

## 空态与失败态

| 业务语义 | HTTP / code / data | 页面行为 |
| --- | --- | --- |
| 分页列表没有条目 | `200 / 0 / { items: [], ... }` | 列表空态，显示接口 `message` |
| current、recent、latest 等入口没有候选 | `200 / 0 / null` | 单卡空态，显示接口 `message` |
| 带资源 ID 的详情不存在或已删除 | `200 / 10004 / null` | 详情页可复用 `Empty` 视觉，显示“内容已不存在”等接口文案 |
| 分享 token 已失效 | `200 / 10004 / null` | 失效页可复用 `Empty` 视觉，显示接口文案 |
| 可知资源存在但无权操作 | `200 / 10003 / null` | 页面按权限失败呈现；不伪装为正常空数据 |
| 写操作目标不存在、冲突或受限 | `200 / 非零 / null` | 保留页面上下文并显示 Toast 或字段错误 |

前端以 `data === null`、`items.length === 0` 或业务码判断状态，绝不通过比较 `message` 文本决定分支。`message` 仅是可展示文案。

## 已知接口落点

- `GET /home/recent-arrangement` 已返回 `data: null`，只需在没有候选时把固定 `"ok"` 改成可展示的“暂无最近安排”。
- `GET /home-topics/current` 当前返回 `data: { topic: null }`。本次迁移改为没有上架专题时直接返回 `data: null`；有专题时维持专题详情对象。
- 所有分页接口保持现有分页对象，空列表不迁移为 `null`。
- 带 ID 或 token 的菜谱、饭局、购物、分享、专题、后台资源读取，以及全部写操作，默认不是正常空态；除非后续存在明确相反的产品合同。

## 实现边界

1. API 在全局异常过滤器按 HTTP exception 状态映射上述业务码，避免逐一修改现有领域服务的 `NotFoundException`、`ConflictException` 等抛出点。
2. `code` 已是数值类型，因此保留数值合同；不引入跨应用共享源码。API、Client、Admin、Site 在各自请求层维护同一组本地常量。
3. Client、Admin、Site 的请求层保持“HTTP 非 2xx 为 transport error”的优先级。`10002` 继续执行既有登录态清理和重放逻辑。
4. 常规 `get/post/put/del` 继续在非零业务码时 reject，避免所有既有调用方悄然把失败当成功。需要把 `10003/10004` 显示成详情空态的页面在本地捕获并切换页面状态，不再向上抛出。
5. 请求层不自动 Toast。不同页面决定使用空态、返回上一页、保留表单或 Toast；避免重复提示和错误的页面跳转。
6. 静态资源读取、数据库 schema、迁移、权限规则和领域状态机不在本次迁移中改变。

## 受影响实现面与验证

- 后端：异常过滤器、错误响应类型/常量、过滤器测试，以及显式写入旧数值错误码的限流路径。
- 合同：`docs/api-contract.md`、`docs/api-database-rules.md`、OpenAPI envelope 示例和本次变更日志。
- 调用方：Client、Admin、Site 请求层及其测试；使用旧 `401/403/404/409/429/503` 业务码判断的页面和测试；API 流程验证脚本。
- 正常空态：首页最近安排的文案路径；首页当前专题的服务、OpenAPI、本地类型、页面和测试。

验证包括：过滤器单测；三端请求层测试；受影响 API 流程脚本；API/Client/Admin/Site 类型检查；`GET /home/recent-arrangement`、`GET /home-topics/current` 的有/无数据真实响应；一个 `10004` 详情读取和一个 `10002` token 失效路径。

## 非目标

- 不把所有业务失败改为 `code = 0`。
- 不把分页空列表改为 `data = null`。
- 不由请求层根据业务码自动 Toast 或自动跳转。
- 不为了此次迁移新建数据库表、字段、索引、迁移或通用权限中心。
