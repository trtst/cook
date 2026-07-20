# 项目文档索引

## 目的

这套文档用于维护 **下一餐** 项目的当前执行规则。

文档分成两类：

1. 顶层 `docs/*.md`：当前项目的长期规则、开发边界和执行手册。
2. `docs/cook/`：历史产品方案、Prisma v0.1 和手写 SQL 来源，用于追溯，不覆盖当前顶层规则。

## 建议阅读顺序

1. `AGENT.md`
   - 英文，给 AI vibe coding 快速读取。
   - 只保留最小执行上下文、技术栈、V1 边界、命名规则和验证要求。
2. `project.md`
   - 中文，给开发人员阅读。
   - 项目定位、V1 范围、技术栈、工程结构、领域模型、事务边界和数据库约束。
3. `technical.md`
   - 技术规则、接口协议、目录边界、命名规则、代码风格和验证规则。
4. `dining-group.md`
   - 饭搭子、原空间、迁入迁出、饭局和“我的口味”的当前产品权威规则。
5. `configuration.md`
   - Free/Plus、空间计量、图片、历史版本、到期降级和配置中心规则。
6. `client-api.md`
   - 客户端/后台接口手册，查看已创建接口、待创建接口、请求响应示例和调用说明。
7. `api-contract.md`
   - 三端并行前的共享 API 契约、错误码、分页、鉴权、Auth/User/DiningGroup 纵切链路。
8. `api-index.md`
   - 接口看板，查看已创建接口、待创建接口、实现位置和详情位置。
9. `uniapp.md`
   - uni-app 小程序端工程规则、分包边界、生命周期、请求、滚动、分享和样式兼容。
10. `uniapp-architecture.md`
   - `apps/client` 小程序目录骨架、主包/分包规划、登录组件、请求层、平台适配层和 store 边界。
11. `architecture.md`
   - 前后端分层、依赖方向、接口边界和数据流。
12. `decision.md`
   - 范围写法、不做项、交付口径和边界确认规则。
13. `components.md`
   - 前端组件准入、拆分边界、命名和输入输出规则。
14. `runbook.md`
   - 启动、调试、验证、三端联合开发流程、联调和交付说明。
15. `plans/dining-group-lifecycle-plan.md`
   - 当前规则落地为 v0.2 契约、迁移和分阶段实现的执行计划。
16. `apps/worker/README.md`
   - Worker 禁用态骨架、命令和 V1 不启动异步任务边界。
17. `docs/cook/`
   - 需要追溯完整产品方案、Prisma Schema 或手写 SQL 时再阅读。

## 文档地图

- `AGENT.md`
  - AI 执行入口，英文简版。
- `project.md`
  - 开发者项目总览，中文完整版。
- `technical.md`
  - 技术栈、接口、工程规则、命名规则和代码风格。
- `dining-group.md`
  - 当前饭搭子生命周期、原空间、迁入迁出、饭局和口味规则。
- `configuration.md`
  - 当前会员、配置、空间、图片、版本、回收站和降级规则。
- `client-api.md`
  - 客户端/后台接口手册，查看已创建接口、待创建接口、请求响应示例和调用说明。
- `api-contract.md`
  - 三端并行前的共享 API 契约、错误码、分页、鉴权、Auth/User/DiningGroup 纵切链路。
- `api-index.md`
  - 接口看板，查看已创建接口、待创建接口、实现位置和详情位置。
- `uniapp.md`
  - uni-app 小程序端工程规则、分包边界、生命周期、请求、滚动、分享和样式兼容。
- `uniapp-architecture.md`
  - `apps/client` 小程序目录骨架、主包/分包规划、登录组件、请求层、平台适配层和 store 边界。
- `architecture.md`
  - 前后端分层、依赖方向、接口边界和数据流。
- `decision.md`
  - 需求边界、明确不做项和交付口径。
- `components.md`
  - 共享组件准入、命名、`props` 和事件规则。
- `runbook.md`
  - 启动基线、调试顺序、三端联合开发流程、联调清单和交付说明。
- `../apps/worker/README.md`
  - Worker 禁用态骨架、命令和运行边界。
- `cook/`
  - 产品方案、技术实施方案、Prisma Schema 和手写 SQL 约束。
- `templates/`
  - 计划、功能执行单和评审模板。
- `plans/minor_change_log.md`
  - 小型低风险改动记录。
- `plans/dining-group-lifecycle-plan.md`
  - 饭搭子 v0.2 分阶段契约与实施计划。
- `archive/`
  - 不再属于当前主路径的历史文档。

## 维护规则

1. 长期稳定规则写入顶层主文档。
2. `docs/cook/` 保留历史产品、Schema 和 SQL 来源；当其与 `dining-group.md` 或 `configuration.md` 冲突时，以顶层当前权威文档为准。
3. 一次性执行说明写入 `plans/`。
4. 已过时材料移入 `archive/`。
5. 主文档必须写当前项目如何做，不保留与下一餐无关的通用模板口径。
6. 三端联合开发的功能执行单从 `templates/feature_execution_template.md` 复制到 `plans/`，只保留本轮需要协作和验收的信息。
