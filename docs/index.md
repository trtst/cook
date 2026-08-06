# 项目文档索引

## 目的

这套文档用于维护 **炊火记** 项目的当前执行规则。

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
4. `api-database-rules.md`
   - API、字段、表、约束、安全、性能、缓存、事务、迁移和最小实现的强制规则。
5. `dining-group.md`
   - 饭搭子关系、成员额度、周计划、饭局、冰箱和购物清单边界。
6. `recipe.md`
   - 我的/灵感/合集、录入、收藏、推荐、基础版本、覆盖修改和图片规则。
7. `ingredient.md`
   - 系统与个人食材、分类、单位、审核和换算边界。
8. `configuration.md`
   - Free/Plus/Pro/Ultra、个人空间、图片、回收站、降级和个性化权益。
9. `client-api.md`
   - 客户端/后台接口手册，查看已创建接口、待创建接口、请求响应示例和调用说明。
10. `api-contract.md`
   - 三端并行前的共享 API 契约、错误码、分页、鉴权、Auth/User/DiningGroup 纵切链路。
11. `api-index.md`
   - 接口看板，查看已创建接口、待创建接口、实现位置和详情位置。
12. `uniapp.md`
   - uni-app 小程序端工程规则、分包边界、生命周期、请求、滚动、分享和样式兼容。
13. `uniapp-architecture.md`
   - `apps/client` 小程序目录骨架、主包/分包规划、登录组件、请求层、平台适配层和 store 边界。
14. `architecture.md`
   - 前后端分层、依赖方向、接口边界和数据流。
15. `decision.md`
   - 范围写法、不做项、交付口径和边界确认规则。
16. `components.md`
   - 前端组件准入、拆分边界、命名和输入输出规则。
17. `client-image.md`
   - 客户端图片选择、裁剪、本地预览、延迟上传、本地清理和后续头像接入约定。
18. `runbook.md`
   - 启动、调试、验证、三端联合开发流程、联调和交付说明。
19. `apps/worker/README.md`
   - Worker 禁用态骨架、命令和 V1 不启动异步任务边界。
20. `docs/cook/`
   - 需要追溯完整产品方案、Prisma Schema 或手写 SQL 时再阅读。
21. `plans/business-development-todo.md`
   - 记录后续业务开发必须重新确认的问题；只防遗漏，不作为已确认契约。
22. `plans/engineering-todo.md`
   - 记录后续工程治理待办，例如命名规则清理和检查门禁；只防遗漏，不替代具体执行单。
23. `plans/home-weekly-topic-execution.md`
   - 首页“本周灵感”专题页执行单，覆盖后台维护、首页跳转、专题页展示和计划页导流闭环。

## 文档地图

- `AGENT.md`
  - AI 执行入口，英文简版。
- `project.md`
  - 开发者项目总览，中文完整版。
- `technical.md`
  - 技术栈、接口、工程规则、命名规则和代码风格。
- `api-database-rules.md`
  - API、字段、数据库表、约束、安全、性能、缓存、事务、迁移和最小实现的强制设计基线。
- `dining-group.md`
  - 当前饭搭子关系、成员额度、计划、饭局和个人数据边界。
- `recipe.md`
  - 当前我的/灵感/合集、录入、收藏、推荐、版本、图片和派生规则。
- `ingredient.md`
  - 当前系统与个人食材、分类、单位、审核和换算规则。
- `configuration.md`
  - 当前四档个人会员、配置、空间、图片、回收站和降级规则。
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
- `client-image.md`
  - 客户端图片选择、裁剪、本地预览、延迟上传、本地文件清理和后续头像接入约定。
- `runbook.md`
  - 启动基线、调试顺序、三端联合开发流程、联调清单和交付说明。
- `../apps/worker/README.md`
  - Worker 禁用态骨架、命令和运行边界。
- `cook/`
  - 产品方案、技术实施方案、Prisma Schema 和手写 SQL 约束。
- `templates/`
  - 计划、功能执行单和评审模板。
- `templates/theme_add_checklist.md`
  - `apps/client` 新增主题时的最小接入步骤、自检项和校验命令。
- `plans/minor_change_log.md`
  - 全项目中央变更时间线；小改动直接记录，大改动记录摘要并链接独立执行文档。
- `plans/personal-data-refactor-plan.md`
  - 当前个人数据与饭搭子关系重构计划；涉及关系模型、个人权益、菜谱、计划和后台治理时优先参考。
- `plans/recipe-execution.md`
  - 菜谱业务流与页面行为确认结果，以及接口、数据、实现和验收门禁。
- `plans/recipe-contract-review.md`
  - 已确认的菜谱 R1 最小接口、数据主事实、约束、事务和实施门禁；具体公共路径与 DTO 同步到正式 API 契约。
- `plans/api-database-boundary-audit.md`
  - 当前 API 与数据库边界审计基线；接口、字段和约束整改按此文执行。
- `plans/business-development-todo.md`
  - 后续业务问题、触发时机和确认门禁，不直接规定接口或数据库约束。
- `plans/engineering-todo.md`
  - 后续工程治理问题、分批改造入口和检查门禁，不替代具体模块执行单。
- `plans/home-weekly-topic-execution.md`
  - 首页“本周灵感”专题页的业务边界、最小接口、最小表和验收门禁。
- `plans/engineering-foundation-fix.md`
  - 2026-07-24 幂等、管理员审计、迁移验证和模块状态收口的实际执行记录。
- `plans/site-content-execution.md`
  - PC 官网、内容中心和小程序内嵌内容页的交付边界、信息架构、工程方案与阶段计划。
- `archive/`
  - 不再属于当前主路径的历史文档；`archive/plans/` 保存已被替代的旧阶段计划，不作为当前实现依据。

## 维护规则

1. 长期稳定规则写入顶层主文档。
2. `docs/cook/` 保留历史产品、Schema 和 SQL 来源；冲突时以 `dining-group.md`、`recipe.md`、`ingredient.md` 和 `configuration.md` 为准。
3. 一次性执行说明写入 `plans/`。
4. 已过时材料移入 `archive/`。
5. 主文档必须写当前项目如何做，不保留与炊火记无关的通用模板口径。
6. 三端联合开发的功能执行单从 `templates/feature_execution_template.md` 复制到 `plans/`，只保留本轮需要协作和验收的信息。
7. 每次交付必须更新 `plans/minor_change_log.md`；独立计划和执行文档不能替代中央时间线记录。
8. 被替代的旧阶段方案必须移出 `plans/` 主路径；当前实现只依据顶层主文档和仍留在 `plans/` 的现行计划。
