# 小改动记录

## 记录规则

1. 这里只记录小型低风险改动。
2. 每条记录都应保持简短。
3. 范围较大的工作应改用独立计划文档。

## 记录项

| 日期 | 改动 | 影响文件 | 验证 |
| --- | --- | --- | --- |
| 2026-07-19 | 补充三端联合开发机制、接口契约流程和功能执行单模板 | `docs/project.md`、`docs/api-contract.md`、`docs/runbook.md`、`docs/index.md`、`docs/templates/feature_execution_template.md` | `git diff --check -- docs/templates/feature_execution_template.md docs/project.md docs/api-contract.md docs/runbook.md docs/index.md` |
| YYYY-MM-DD | 示例：小型前端清理 | `components/...` | `lint`、`type-check` |
