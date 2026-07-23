# API 与数据库边界审计基线

## 状态

- 文档状态：已确认，核心接口边界整改已执行。
- 审计范围：当前未提交工作区中的 API、Client、Admin、Prisma Schema、迁移和顶层产品文档。
- 实施状态：公共聚合权益接口、旧空间字段、跨域客户端依赖、客户端声明菜谱图片大小的写入口和开发态 DTO 校验缺口已移除；路径参数、并发 version、数据库约束与响应 Schema 等后续审计项仍按本文跟踪。
- 权威输入：`../configuration.md`、`../dining-group.md`、`../recipe.md`、`personal-data-refactor-plan.md`。

## 一、审计结论

当前主要问题不是接口数量，而是同一个对象同时承担内部策略、公共响应、后台视图和写入校验：

1. `EffectiveEntitlementSnapshot` 同时包含会员事实、策略限制、实时用量和跨域状态。
2. `UserBasic` 同时服务登录、`me`、资料更新和背景图更新。
3. `EntitlementGrant` 同时表达当前会员和有效期，但每个用户只能有一条记录。
4. 图片资产尚未实现；已关闭客户端提交菜谱图片 URL 和 `sizeBytes` 的入口，后续只能按服务端处理后的文件事实记账。
5. 多个表保存 `version`，对应写接口却不提交期望版本。
6. OpenAPI 只描述请求 DTO 和文字说明，没有可执行的响应 Schema。
7. 开发态运行器已改为 TypeScript 编译监听与编译产物重启，Nest DTO 元数据和生产构建一致；全局未知字段、嵌套对象、枚举、长度与批量上限已补校验。

整改原则：

1. API 按页面需要和领域所有权返回数据，不按“当前上下文”打包全部信息。
2. 服务端内部策略解析对象不得直接作为客户端或后台 DTO。
3. 数据库保存主事实；计数、额度和空间账本必须可重算。
4. Client、Admin、API 各自维护类型，但以同一份已冻结合同为依据。
5. 未确认的支付、价格、周期和自动续费不进入本轮模型。

## 二、目标 API 处置表

| 当前接口 | 处置 | 目标职责 | 禁止继续返回 |
| --- | --- | --- | --- |
| `POST /auth/login` | 改造响应 DTO | 登录凭证和最小会话用户摘要 | 背景图、会员额度、饭搭子状态 |
| `GET /users/me` | 改造 | 当前用户身份、个人资料、展示设置和会员事实 | 菜谱额度、空间用量、饭搭子计数、图片编码参数 |
| `PUT /users/me` | 保留并收窄 | 修改昵称和头像引用 | 未修改字段的完整用户对象 |
| `PUT /users/me/display` | 保留预留 | 背景图能力未开放，当前统一返回 `503` | 任意外部 URL、客户端声明文件大小 |
| `GET /entitlements/current` | 废弃 | 无替代的一比一大快照接口 | 全部旧字段 |
| `GET /storage-usage` | 保留，迁移模块归属 | 个人逻辑空间总量、分模块用量和空间状态 | 饭搭子关系状态、图片编码策略 |
| `GET /dining-groups` | 保留 | 本人的饭搭子关系和每个饭搭子的关系状态 | 菜谱、空间、图片等其他领域额度 |
| `GET /dining-group-members` | 保留 | 指定饭搭子的成员关系 | 用户私有资料和个人会员完整权益 |
| `GET /admin/user-entitlements` | 废弃当前响应 | 后台用户详情中的会员事实和分域检查入口 | 复用客户端 `EffectiveEntitlementSnapshot` |

## 三、字段归属表

### 3.1 `GET /users/me`

推荐结构只表达用户事实和“我的”页稳定入口信息：

```ts
interface MeResponse {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  display: {
    profileBackgroundUrl: string | null;
    homeBackgroundUrl: string | null;
    canUseProfileBackground: boolean;
    canUseHomeBackground: boolean;
  };
  membership: {
    tier: "FREE" | "PLUS" | "PRO" | "ULTRA";
    validUntil: IsoDateTime | null;
  };
}
```

约束：

1. `tier` 放在 `me.membership`，不再通过饭搭子 Store 获取。
2. 背景图能力开放前，两个 URL 固定返回 `null`，不接受客户端写入。
3. 两个背景能力位保留在 `me.display`，当前固定返回 `false`。
4. `me` 不返回所有额度和实时用量。
5. `validUntil` 是否对客户端开放需要在会员展示需求确认后冻结；数据库仍应保存有效期事实。

### 3.2 登录响应

登录使用独立 DTO：

```ts
interface SessionUser {
  uid: number;
  nickname: string | null;
  avatarUrl: string | null;
}
```

登录成功后由会话恢复流程按需读取 `/users/me`。登录响应不复用 `MeResponse`。

### 3.3 饭搭子关系

`GET /dining-groups` 继续按每条关系返回：

- 饭搭子 `id`、名称和主理人公开 UID。
- 本人的角色、关系状态和结束原因。
- 当前有效成员数。
- 由主理人套餐决定的成员上限。
- 该饭搭子的超额状态。
- 并发写需要的 `version`。

列表顶层可以返回本人关系用量：

```ts
interface DiningGroupListResponse {
  items: DiningGroupSummary[];
  usage: {
    ownedCount: number;
    joinedCount: number;
    joinLimit: number;
    state: "NORMAL" | "OVER_JOIN_LIMIT";
  };
}
```

这里的 `usage` 只属于饭搭子关系域，不包含菜谱、空间或图片策略。

### 3.4 个人空间

`GET /storage-usage` 是允许存在的聚合接口，因为所有字段都服务同一个空间用量视图：

```ts
interface StorageUsageResponse {
  state: "NORMAL" | "OVER_STORAGE_READONLY";
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  byModule: Array<{
    module: StorageModule;
    usedBytes: number;
  }>;
  calculatedAt: IsoDateTime;
}
```

`limitBytes` 可以由当前会员策略解析，但响应归 Storage 域所有。

### 3.5 菜谱与图片能力

以下字段不再放入通用权益接口：

| 当前字段 | 目标所有者 | 处理方式 |
| --- | --- | --- |
| `recipeLimit` | Recipe | 菜谱列表或菜谱用量摘要按需返回 |
| `recycleDays` | Recipe | 服务端删除策略；删除结果返回实际状态和截止时间 |
| `variantLimitPerRoot` | Recipe | 派生做法入口开放时由菜谱能力响应返回 |
| `imagePolicy` | Upload | 创建上传任务时返回本次上传约束，不全局缓存 |
| `storageLimitBytes` | Storage | 只由 `/storage-usage` 返回 |
| `inviteLimit` | DiningGroup | 创建邀请和饭搭子关系列表使用 |
| `joinLimit` | DiningGroup | 饭搭子关系列表 `usage` 使用 |
| `memberLimit` | DiningGroup | 放在具体饭搭子摘要中 |
| `ownedDiningGroupCount` | DiningGroup | 放在关系列表 `usage` 中 |
| `joinedDiningGroupCount` | DiningGroup | 放在关系列表 `usage` 中 |
| `state` | 删除歧义 | 拆成明确的空间、加入数或饭搭子状态 |

## 四、DTO 边界

| 场景 | 独立 DTO | 说明 |
| --- | --- | --- |
| 登录 | `SessionUser` | 只用于建立会话 |
| 当前用户 | `MeResponse` | 身份、资料、展示和会员事实 |
| 更新资料 | `UpdateMeResult` | 只返回被修改的资料版本或新的 `MeResponse`，二选一后冻结 |
| 饭搭子列表 | `DiningGroupListResponse` | 关系条目和关系域用量 |
| 空间用量 | `StorageUsageResponse` | 只返回空间域信息 |
| 后台用户详情 | `AdminUserDetailResponse` | 后台专用，不继承 Client DTO |
| 服务端策略 | `ResolvedPolicy` | 仅 API 内部使用，不导出到公共 contracts |

OpenAPI 整改要求：

1. 响应 DTO 使用运行时 class 或显式 Schema，不能只使用 TypeScript interface。
2. 统一响应外壳必须能表达具体 `data` 类型。
3. Client 和 Admin 类型根据冻结合同各自维护，不互相导入源码。
4. 验证脚本检查实际响应没有额外旧字段。

## 五、旧字段与旧语义清理表

| 旧内容 | 当前残留位置 | 目标动作 |
| --- | --- | --- |
| `/dining-groups/current` | API 文档、客户端文档、旧计划 | 从当前合同删除，历史计划保留替代说明 |
| `currentSpace` | API 文档、客户端文档、架构文档 | 删除 |
| `originalSpace` | API 文档、客户端文档、架构文档 | 删除 |
| `carryBackSnapshot` | API 文档和历史迁移语义 | 当前合同删除；历史 migration 不改写 |
| `FROZEN` | API 文档和历史 migration | 当前合同删除；历史 migration 保留 |
| `personalTier` | 旧权益合同 | 由 `me.membership.tier` 替代 |
| `diningGroupTier` | 旧权益合同 | 删除，不存在饭搭子套餐 |
| `currentScope` | 旧权益合同 | 删除 |
| `snapshotDays` | 旧权益合同 | 删除 |
| `EffectiveEntitlementSnapshot` | API、Client、Admin | 从公共 DTO 删除，内部策略对象重新命名 |
| `CarryBackSnapshotStatus` | 当前 Prisma Schema | 删除未使用枚举 |
| `currentEntitlements` | Client 饭搭子 Store | 拆回 User、DiningGroup、Storage 等所有者 |

Client 中用于用户主动选择某个饭搭子的 `selectedDiningGroupId` 可以保留；`currentDiningGroup`、`refreshCurrent` 等命名应改为 `selectedDiningGroup`、`refreshDiningGroups`，避免继续表达服务端唯一当前空间。

## 六、数据库表级整改表

| 当前表/模型 | 结论 | 主事实 | 整改动作 |
| --- | --- | --- | --- |
| `User` | 保留并收窄引用 | 用户身份和基础资料 | 背景图改存资产引用；不在表上保存会员额度 |
| `UserTasteProfile` | 保留 | 私有口味和安全资料 | 保持用户一对一和数组数量约束 |
| `DiningGroup` | 保留 | 长期关系对象和主理人 | 保持 `ownerId` 唯一；写接口使用版本校验 |
| `DiningGroupMember` | 保留 | 用户与饭搭子的关系事实 | 保持组合唯一；补主理人与 OWNER 成员一致性验证 |
| `DiningGroupInvite` | 保留 | 单次邀请状态 | 保持状态、时间、令牌哈希和策略版本约束 |
| `EntitlementGrant` | 重命名并收敛 | 当前个人会员事实 | 推荐改为 `UserMembership`；不承载饭搭子或跨域用量 |
| `RecipeContentVersion` | 保留 | 不可变菜谱正文版本 | 服务层禁止更新；图片只保存服务端资产引用 |
| `Recipe` | 保留并补约束 | 用户菜谱入口和当前编辑状态 | 补来源、状态时间、独立化和版本约束 |
| `RecipeReport` | 保留并补唯一 | 举报事实 | 限制同一举报人对同一菜谱只有一个 OPEN 举报 |
| `MealPlanItem` | 保留并修正固定菜单边界 | 用户的计划餐次 | 明确只引用固定版本，避免额外可漂移菜单副本 |
| `DiningEvent` | 保留 | 发起人的单次饭局 | 校验与计划属于同一用户；状态与时间约束 |
| `DiningEventParticipant` | 保留并补约束 | 饭局参与事实 | 用户/访客来源一致性、带菜引用成对、事件内用户唯一 |
| `FridgeItem` | 保留并补约束 | 用户个人库存条目 | `available` 与 `consumedAt` 一致；版本校验 |
| `ShoppingItem` | 保留并补约束 | 用户个人购物项 | 来源类型与来源键一致；版本校验 |
| `StorageLedger` | 定义为投影 | 每个用户的逻辑空间计量明细 | 非负约束、事务同步、全量重算；不得成为唯一事实 |
| `IdempotencyRecord` | 保留并对齐 Schema | 重试写结果 | 把 migration 中的部分唯一索引写入正式 Schema 约束说明 |
| `AuditEvent` | 保留 | 重要状态变更审计 | 会员、图片、额度和治理变更必须记录 |
| `OutboxEvent` | 保留但不启 Worker | 可靠异步事件事实 | 维持 V1 禁用状态，不扩大运行范围 |

## 七、个人会员模型

本轮不建设订单、价格、退款或自动续费。推荐先把当前会员事实表达清楚：

```prisma
model UserMembership {
  userId     String   @id @db.Uuid
  tier       MembershipTier
  validFrom  DateTime @db.Timestamptz(3)
  validUntil DateTime? @db.Timestamptz(3)
  version    Int      @default(1)
  updatedAt  DateTime @updatedAt @db.Timestamptz(3)
}
```

规则：

1. Free 默认无记录，由服务端解析。
2. 表只保存当前有效或待到期的个人会员事实。
3. 每次变更写 `AuditEvent`，不把支付历史塞入该表。
4. 支付合同冻结后另建订单和会员周期模型，不提前猜测字段。
5. `validUntil > validFrom`、`version > 0` 必须由数据库约束。

该推荐保留“一用户一条当前事实”的简单性，但不再使用含义宽泛的 `Grant` 名称。若产品确认需要预定下期套餐或完整会员周期历史，则必须改为多周期模型，并增加时间区间不重叠约束；不能在实现阶段临时决定。

## 八、图片资产与背景图

在图片上传合同冻结前，背景图接口不得继续接受任意 URL。最小资产事实至少包括：

```text
assetId
ownerUserId
objectKey
mimeType
sizeBytes
width
height
purpose
status
createdAt
```

规则：

1. `sizeBytes`、真实类型、宽高只能由服务端重新编码结果产生。
2. `User` 保存 `profileBackgroundAssetId` 和 `homeBackgroundAssetId`，API 负责解析可访问 URL。
3. 菜谱版本保存稳定资产引用，不保存可过期签名 URL。
4. 删除资产前检查用户背景、菜谱版本、饭局和计划引用。
5. 资产大小是空间重算的主事实，CDN 缓存和缩略图不计入逻辑空间。
6. Client 可以缓存 `MeResponse`；图片二进制缓存依赖平台/CDN，不在业务 Store 再保存一份文件。

## 九、必须增加的数据库约束

| 对象 | 约束 |
| --- | --- |
| `UserMembership` | 有效期顺序、版本正数 |
| `DiningGroup` | ACTIVE/ARCHIVED 与时间字段一致、版本正数 |
| `DiningGroupMember` | 状态与原因/时间一致、一个有效 OWNER、版本正数 |
| `Recipe` | RECYCLED/BLOCKED/DELETED 与对应时间和原因一致 |
| `RecipeReport` | 同一菜谱和举报人只能存在一个 OPEN 举报 |
| `DiningEventParticipant` | 来源与用户/访客字段一致；带菜菜谱和版本同时为空或同时存在 |
| `FridgeItem` | 可用时 `consumedAt` 为空，不可用时 `consumedAt` 非空 |
| `ShoppingItem` | MANUAL 来源键为空，派生来源键非空 |
| `StorageLedger` | `usedBytes >= 0` |
| 所有并发对象 | `version > 0` |

跨表所有权一致性无法只靠普通 CHECK 完成时，优先通过组合外键、唯一索引和事务锁解决；不先引入通用触发器框架。

## 十、迁移顺序

1. 冻结本文中的待确认项和最终 DTO 名称。
2. 新增前向 migration，不改写已应用 migration。
3. 先增加新会员和图片资产结构，再回填现有用户会员和背景图引用。
4. 修复历史 `FROZEN -> ARCHIVED` 数据转换检查，新环境迁移脚本必须对旧数据显式补时间。
5. 增加状态和唯一约束前执行只读脏数据扫描。
6. 服务端切换到内部 `ResolvedPolicy` 和新公共 DTO。
7. Client、Admin 切换到新接口所有者。
8. 删除 `/entitlements/current`、旧公共类型和旧文档字段。
9. 执行空间账本全量重算并核对增量结果。
10. 运行 API、Client、Admin 类型检查和真实流程验证。

## 十一、实施阻断条件

以下任一项未确认，不进入代码改造：

1. `MeResponse.membership` 是否只公开 `tier`，还是同时公开 `validUntil`。
2. 会员使用单行当前事实，还是需要多周期历史和预生效记录。
3. 图片上传返回的稳定资产引用格式。
4. 菜谱图片采用独立关系表，还是在不可变正文中保存稳定 `assetId` 引用。
5. 更新资料接口返回完整 `MeResponse`，还是只返回修改结果和新版本。

## 十二、验收门槛

1. `/entitlements/current` 不再注册。
2. 登录响应不再包含背景图或权益字段。
3. `tier` 只从 `me.membership` 或后台专用用户详情读取。
4. Client 的饭搭子 API 和 Store 不再持有跨域权益快照。
5. OpenAPI 能展示每个响应的真实 `data` Schema。
6. 客户端伪造图片 URL、MIME、尺寸或 `sizeBytes` 不能改变资产和空间事实。
7. 所有返回 `version` 的并发写都校验期望版本并在冲突时返回 `409`。
8. 空间增量结果与全量重算一致。
9. 数据库拒绝本文件列出的非法状态组合。
10. 当前合同和客户端手册中不再出现旧空间、饭搭子套餐和迁出快照字段。
