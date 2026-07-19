# 项目文档索引

## 目的

这套文档用于维护 **下一餐** 项目的当前执行规则。

文档分成两类：

1. 顶层 `docs/*.md`：当前项目的长期规则、开发边界和执行手册。
2. `docs/cook/`：产品方案、Prisma Schema 和手写 SQL 约束等冻结依据。

## 建议阅读顺序

1. `AGENT.md`
   - 英文，给 AI vibe coding 快速读取。
   - 只保留最小执行上下文、技术栈、V1 边界、命名规则和验证要求。
2. `project.md`
   - 中文，给开发人员阅读。
   - 项目定位、V1 范围、技术栈、工程结构、领域模型、事务边界和数据库约束。
3. `technical.md`
   - 技术规则、接口协议、目录边界、命名规则、代码风格和验证规则。
4. `api-contract.md`
   - 三端并行前的共享 API 契约、错误码、分页、鉴权、Auth/User/Restaurant 纵切链路。
5. `uniapp.md`
   - uni-app 小程序端工程规则、分包边界、生命周期、请求、滚动、分享和样式兼容。
6. `uniapp-architecture.md`
   - `apps/client` 小程序目录骨架、主包/分包规划、登录组件、请求层、平台适配层和 store 边界。
7. `architecture.md`
   - 前后端分层、依赖方向、接口边界和数据流。
8. `decision.md`
   - 范围写法、不做项、交付口径和边界确认规则。
9. `components.md`
   - 前端组件准入、拆分边界、命名和输入输出规则。
10. `runbook.md`
   - 启动、调试、验证、三端联合开发流程、联调和交付说明。
11. `docs/cook/`
   - 需要追溯完整产品方案、Prisma Schema 或手写 SQL 时再阅读。

## 文档地图

- `AGENT.md`
  - AI 执行入口，英文简版。
- `project.md`
  - 开发者项目总览，中文完整版。
- `technical.md`
  - 技术栈、接口、工程规则、命名规则和代码风格。
- `api-contract.md`
  - 三端并行前的共享 API 契约、错误码、分页、鉴权、Auth/User/Restaurant 纵切链路。
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
- `cook/`
  - 产品方案、技术实施方案、Prisma Schema 和手写 SQL 约束。
- `templates/`
  - 计划、功能执行单和评审模板。
- `plans/minor_change_log.md`
  - 小型低风险改动记录。
- `archive/`
  - 不再属于当前主路径的历史文档。

## 维护规则

1. 长期稳定规则写入顶层主文档。
2. 产品冻结依据保留在 `docs/cook/`，不要散复制到多个平行文档。
3. 一次性执行说明写入 `plans/`。
4. 已过时材料移入 `archive/`。
5. 主文档必须写当前项目如何做，不保留与下一餐无关的通用模板口径。
6. 三端联合开发的功能执行单从 `templates/feature_execution_template.md` 复制到 `plans/`，只保留本轮需要协作和验收的信息。
