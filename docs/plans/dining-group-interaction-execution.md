# 饭搭子交互执行单

## 一、执行状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 业务流程 | 已确认 | 已确认“建关系 -> 发起征集 -> 一起定菜单 -> 分工做菜 -> 吃完留卡”作为当前饭搭子情感主线 |
| 页面行为 | 已确认 | 已确认首页轻动态、征集、结果汇总、分工、完成反馈与饭搭子卡的最小页面职责 |
| 权限与状态 | 部分确认 | 关系、邀请、退出、饭局和我带菜主边界已确认；动态持久化、掌勺认领和餐后反馈 DTO 尚未冻结 |
| 最小 API | 已确认 | 已同步 `api-contract.md / client-api.md / api-index.md`，后续实现直接以正式共享契约为准 |
| 最小表与约束 | 草案已确认 | 已补征集、成员回应、动态摘要和菜级认领的最小主事实草案，尚未修改 Prisma、SQL 或 migration |
| 三端实现 | 未开始 | 本文只交付产品和执行基线，不修改客户端、API、Admin、Prisma 或 migration |
| 真实验收 | 未开始 | 待客户端、API、分享快照纵切落地后执行 |

## 二、本轮目标

把“饭搭子”从单纯关系入口收口为当前项目可执行的情感协作主线，并明确：

1. 哪些能力属于当前 V1 主闭环。
2. 哪些能力属于 `V1.1` 扩展，不得混入当前最小实现。
3. 动态、分工、点菜征集和饭搭子卡之间的协作边界。
4. 现有“我带菜”与新增“我来做”的并存规则。

本轮只交付文档，不修改客户端、API、Admin、Prisma、SQL、对象存储或分享实现。

## 三、已确认产品决策

1. 产品命名继续统一使用“饭搭子”，不改回“餐厅”。
2. 饭搭子仍是关系，不是共享数据空间；菜谱、冰箱、计划、饭局和购物清单仍归个人。
3. “我来做”和“我带菜”并存：
   - `我来做`：认领当前已确认菜单中的某道菜，由认领人负责完成该菜。
   - `我带菜`：参与者额外从自己持有的“我的”菜谱或只读收藏中带一道菜进入本次协作。
4. 首页可以有详细的轻动态规则，但默认只展示最近 `3~5` 条，不做公开动态流，不做消息列表沉浸页。
5. 当前阶段先做“饭搭子卡 + 分享快照”，`记忆墙` 延后，不进入本轮最小交付。

## 四、当前主闭环

```text
建立饭搭子关系
-> 发起点菜征集
-> 成员选择与补充建议
-> 主理人确认最终菜单
-> 成员通过“我来做 / 我带菜”分工
-> 开饭提醒与参与回应
-> 标记完成
-> 可选生成饭搭子卡并分享
```

该主闭环对应现有项目的首要业务闭环：

`我想吃 -> 共同选择 -> 确认下一餐 -> 核对冰箱 -> 生成清单 -> 完成采购 -> 做饭 -> 留下并分享记忆`

## 五、页面结构

### 5.1 首页

首页继续按“氛围 -> 提醒 -> 操作”的顺序组织，在当前结构内补入饭搭子协作层，不改造成聊天页或动态流首页。

建议首页层级：

```text
顶部氛围区
最高优先级提醒横条
饭搭子卡片
当前下一餐 / 当前征集卡
最近 3~5 条家庭动态
快捷操作：发起点菜 / 查看下一餐 / 查看饭搭子
```

首页饭搭子卡片只承担 3 件事：

1. 当前饭搭子关系摘要。
2. 当前是否存在进行中的征集、待回应提醒或即将开饭。
3. 进入饭搭子成员、征集或当前餐次的统一跳转。

饭搭子页补充当前确认的入口规则：

1. 新用户默认 `未开启`，我的页卡片和饭搭子页都要明确展示未开启态。
2. 点击 `立即开启` 使用上滑 `sheet` 收集最小表单，不使用确认弹窗承载录入。
3. 开启表单固定展示当前昵称只读值，并提交 `饭搭子名称 + 简介?`；`简介` 为非必填。
4. 已开启后，页面上半区展示当前饭搭子摘要和聚合信息，下半区展示“我加入的饭搭子”列表用于切换当前上下文。
5. 名称和简介继续在饭搭子页内编辑，不把切换器塞进 header。
6. 当前饭搭子主页按“大主图 + 左侧聚合统计 + 当前动态 + 下方关系切换”的结构收口；右下角补悬浮切换入口，其他饭搭子有待关注动态时只显示红点，不展示精确数量。
7. 主图当前只对主理人的 `Pro / Ultra` 开放上传替换；成员看到同一页面结构，但不暴露主图编辑、资料编辑和解散入口。
8. 解散入口放在饭搭子页底部危险区，可折叠，确认动作继续使用原生确认弹窗。

### 5.2 点菜征集页

入口：

1. 首页“发起点菜”。
2. 当前下一餐卡片。
3. 计划详情页。

页面结构：

```text
日期与餐次
截止时间
备注
候选菜列表
补充建议入口
参与状态摘要
主操作
```

交互约束：

1. 默认选中“今天晚餐”。
2. 候选菜优先推荐“最近没吃”和“当前冰箱可做”的菜。
3. 若本人可用家庭菜谱过少，可补系统菜谱建议，但必须在确认菜单前落成固定菜谱引用。
4. “补充一道”不是直接加进最终菜单，而是进入“待主理人确认的建议菜”区。

### 5.3 结果汇总页

页面结构：

```text
征集标题与结束态
候选菜投票结果
成员备注摘要
建议菜待确认区
建议菜单
最终菜单编辑区
确认生成下一餐
```

结果页的核心目标不是只展示票数，而是帮助主理人用更少步骤完成“最终菜单确认”。

### 5.4 分工页

分工页对应已确认菜单，展示每道菜当前责任状态：

```text
最终菜单
每道菜的“我来做”认领状态
附加“我带菜”区域
当前参与成员与回应状态
```

分工页不承担购物清单编辑；只负责产生责任事实，后续由责任事实驱动个人购物项生成。

### 5.5 完成反馈页

完成后只提供可选反馈，不做强制留痕：

```text
已完成态
喜欢 / 一般 / 下次不做
氛围标签
一句话
生成饭搭子卡
```

### 5.6 饭搭子卡页

饭搭子卡页只做生成和预览，不在本轮扩展成完整记忆墙。

页面结构：

```text
菜品图或菜名卡
日期与餐次
参与成员
掌勺标识
可选餐桌照片
可选一句话
公开字段确认
生成分享快照
```

## 六、状态机

### 6.1 饭搭子关系

```text
INVITING -> ACTIVE -> RESTRICTED -> CLOSED
```

说明：

1. `INVITING` 仅用于客户端展示“待加入 1 人”之类轻占位，不代表当前合同已经有正式状态枚举。
2. `ACTIVE / RESTRICTED` 继续服从当前关系与超额规则。
3. `CLOSED` 表示退出、移除或解散后的展示终态，不改个人数据归属。

### 6.2 点菜征集

```text
DRAFT -> OPEN -> CLOSED -> CONFIRMED -> COMPLETED
```

语义：

1. `DRAFT`：仅发起人本地编辑，未发布。
2. `OPEN`：可投票、可补充建议、可写备注。
3. `CLOSED`：截止或手动结束，不能继续提交选择。
4. `CONFIRMED`：已生成最终菜单，并与下一餐事实绑定。
5. `COMPLETED`：该餐次完成，可进入饭搭子卡。

### 6.3 菜级分工

```text
UNCLAIMED -> COOK_CLAIMED -> COOK_RELEASED
UNCLAIMED -> BRING_ADDED -> BRING_REMOVED
```

语义：

1. 同一道已确认菜单中的菜，同一时间只有一人可处于 `COOK_CLAIMED`。
2. `我带菜` 属于附加带菜事实，不覆盖原菜单中的掌勺认领。
3. “我来做”和“我带菜”都需要记录责任人，但它们来源不同、展示区不同。

## 七、动态流规则

## 7.1 产品定位

动态是“被动感知层”，不是消息中心，不是聊天记录，不是公开动态流。

默认规则：

1. 首页只展示最近 `3~5` 条。
2. 点击动态跳对应详情，不进入长列表沉浸页。
3. 不做红点焦虑，不做未读数，不做消息盒子。
4. 提醒类与动态类分开；开饭前提醒、截止前提醒更像提醒，不必全部沉入动态历史。

## 7.2 动态事件清单

| 事件 | 默认文案 | 可见范围 | 跳转 | 是否进入首页动态 |
| --- | --- | --- | --- | --- |
| 发起征集 | `XX 发起了今晚吃什么` | 该饭搭子成员 | 征集详情 | 是 |
| 成员提交选择 | `XX 选择了 2 道菜` | 该饭搭子成员 | 征集结果 | 是 |
| 成员补充建议 | `XX 建议补充一道：蒸蛋` | 该饭搭子成员 | 征集结果 | 是 |
| 成员备注 | `XX 备注：少辣一点` | 该饭搭子成员 | 征集结果 | 是 |
| 菜单确认 | `今晚菜单已确认：可乐鸡翅、番茄炒蛋` | 该饭搭子成员 | 餐次详情 | 是 |
| 我来做认领 | `XX 认领了可乐鸡翅` | 该饭搭子成员 | 分工详情 | 是 |
| 我带菜更新 | `XX 带一道：番茄炒蛋` | 该饭搭子成员 | 分工详情 | 是 |
| 开饭前提醒回应 | `XX 说：19:10 到` | 本餐次参与人 | 餐次详情 | 否，默认仅在餐次详情内汇总 |
| 餐次完成 | `XX 完成了今天晚餐` | 该饭搭子成员 | 完成反馈 | 是 |
| 饭搭子卡生成 | `XX 生成了一张饭搭子卡` | 该饭搭子成员 | 卡片详情 | 是 |
| 成员加入 | `XX 加入了饭搭子` | 该饭搭子成员 | 成员页 | 是 |
| 待加入占位 | `有 1 位成员等待加入` | 该饭搭子成员 | 成员页 | 是 |

## 7.3 合并与静默规则

1. 同一成员短时间内连续动作可合并成一条，例如“选择了 2 道菜，并备注：少辣一点”。
2. 结果类动态优先于过程类动态。首页空间不足时先保留“菜单已确认”“已完成”“生成饭搭子卡”。
3. 超过展示上限时，旧过程动态直接被新动态覆盖，不提供“查看更多全部”。
4. 涉及隐私字段的内容不得进入动态，例如冰箱、过敏、忌口、购物明细、内部备注。

## 八、分工规则

### 8.1 我来做

1. 只允许认领当前已确认菜单中的菜。
2. 同一道菜同一时刻只允许一个认领人。
3. 认领后展示头像和昵称摘要。
4. 可以取消认领，取消后回到待认领。
5. 认领表达“这道菜由谁负责做”，不自动扣减库存，不默认生成共享购物单。

### 8.2 我带菜

1. 由参与者额外提交一道来自本人持有菜谱的带菜。
2. “我带菜”是附加带菜事实，不替换主理人已确认的最终菜单。
3. 其他参与人只看到“谁带什么菜”，不看到其个人采购明细和个人冰箱状态。
4. 带菜若需要采购，仍只进入带菜责任人的个人购物清单。

### 8.3 二者并存的展示方式

1. 已确认菜单中的每道菜展示“我来做”责任状态。
2. 页面底部或附加区单独展示“我带菜”列表。
3. 若用户既认领菜单菜，又额外带菜，两个动作分别展示，不互相折叠。

## 九、分享快照白名单

饭搭子卡必须在分享前生成不可变快照，且只允许白名单字段进入快照。

允许字段：

1. 餐次日期。
2. 餐次名称和餐次时段。
3. 最终菜单菜名列表。
4. 菜谱封面图或兜底菜名卡。
5. 已确认展示的成员头像与昵称摘要。
6. 掌勺人标识。
7. 可选餐桌照片。
8. 可选一句话。
9. 分享时间和必要的快照版本信息。

禁止字段：

1. 冰箱库存。
2. 购物清单与采购明细。
3. 过敏、忌口、口味原始资料。
4. 内部备注、动态全文、未采用的候选菜和投票明细。
5. 用户私有主键、内部状态码、权限字段和调试字段。

## 十、当前建议与优化点

### 10.1 补充一道

“补充一道”不建议直接自由落入最终候选菜。

建议规则：

1. 先作为“建议菜名”提交。
2. 主理人一键确认后，才进入候选池。
3. 若建议菜无法匹配本人持有菜谱或系统可用菜谱，则只保留文本建议，不直接进最终菜单。

### 10.2 建议菜单

结果汇总页不应只做票数陈列，应提供“建议菜单”：

1. 先按票数排序。
2. 同票时优先“最近没吃”。
3. 再优先“当前冰箱更容易完成”的菜。
4. 最终仍由主理人确认，不自动替代人工决定。

### 10.3 新成员欢迎

新成员进入饭搭子后，不应只展示欢迎语。

建议给 2 个直接动作：

1. `参与当前点菜`
2. `看看大家最近在吃什么`

### 10.4 开饭提醒

“收到 / 晚点到”建议做成更轻的回应结构：

1. `收到`
2. `10 分钟后到`
3. `30 分钟后到`
4. `自定义时间`

## 十一、V1 与 V1.1 分期

### 11.1 V1 必做

1. 关系邀请、加入、成员页与当前饭搭子摘要。
2. 点菜征集、成员选择、备注、补充建议、结果汇总。
3. 最终菜单确认并进入下一餐。
4. 已确认菜单上的“我来做”。
5. “我带菜”附加区。
6. 首页最近 `3~5` 条轻动态卡片。
7. 餐次完成后的可选反馈入口。
8. 饭搭子卡生成、公开字段确认、不可变分享快照。

### 11.2 V1 不做

1. 聊天、群聊、评论、私信、完整动态流列表页。
2. 公开家庭动态流、点赞动态、评论动态。
3. 记忆墙、按月筛选、长期时间线浏览。
4. 二维码扫码加入、通讯录拉人等新邀请形态。
5. 共享冰箱、共享购物清单、食材认领。
6. 自动公开成员头像或默认暴露隐私资料。

### 11.3 V1.1 候选

1. 记忆墙。
2. 动态流完整历史页。
3. 成员待加入占位头像的更丰富视觉表现。
4. 更多饭搭子卡模板与筛选。
5. 扫码加入或新的邀请承载形态。

## 十二、最小 API 草案

本节是当前执行单草案，不等于已发布共享契约。只有同步更新 `docs/api-contract.md`、`docs/client-api.md` 和 `docs/api-index.md` 后，才成为正式接口口径。

### 12.1 草案目标

本轮只冻结 3 组新增接口：

1. 点菜征集。
2. 首页轻动态。
3. “我来做”掌勺认领。

当前 `POST /dining-events/{eventId}/bring` 继续承载“我带菜”，不在本轮额外拆新接口。

### 12.2 路径草案

| 方法 | 路径 | 用途 | 调用方 | 幂等 / 版本 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/meal-polls` | 查询当前饭搭子的征集摘要列表 | 饭搭子成员 | 无 | 首页和征集入口使用；当前只支持按 `diningGroupId / status / planDate / mealSlot / limit` 过滤 |
| `POST` | `/meal-polls` | 发起一条新的点菜征集 | `OWNER / ADMIN` | `Idempotency-Key` | 直接创建 `OPEN` 征集；本地草稿不入服务端 |
| `GET` | `/meal-polls/{pollId}` | 查看单条征集详情、候选菜、回应和结果 | 饭搭子成员 | 无 | 详情返回候选项、成员回应摘要和可确认结果 |
| `POST` | `/meal-polls/{pollId}/vote` | 当前成员提交或覆盖自己的一份征集回应 | 饭搭子成员 | `Idempotency-Key` + `expectedVersion` | 每人每征集只有一份有效回应 |
| `POST` | `/meal-polls/{pollId}/confirm` | 关闭征集、汇总回应并确认最终菜单 | `OWNER / ADMIN` | `Idempotency-Key` + `expectedVersion` | 同事务生成或更新下一餐事实，并写入对应饭局 |
| `GET` | `/dining-group-activities` | 查询当前饭搭子最近 `3~5` 条轻动态 | 饭搭子成员 | 无 | 当前只支持首页卡片，不提供完整历史翻页 |
| `POST` | `/dining-events/{eventId}/cook` | 对已确认菜单中的单道菜执行“我来做”认领或释放 | 本餐次参与人 | `Idempotency-Key` + `expectedVersion` | 只影响单道菜责任人，不改写购物或库存所有权 |

### 12.3 DTO 草案

```ts
type MealPollStatus = "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";
type MealSlot = "BREAKFAST" | "LUNCH" | "DINNER";
type MealPollCandidateStatus = "ACTIVE" | "PENDING" | "REJECTED";
type ActivityState = "PENDING" | "DONE" | "EXPIRED";
type DiningGroupActivityKind =
  | "POLL_OPENED"
  | "POLL_VOTED"
  | "POLL_SUGGESTED"
  | "POLL_NOTED"
  | "MENU_CONFIRMED"
  | "COOK_CLAIMED"
  | "BRING_UPDATED"
  | "MEAL_COMPLETED"
  | "MEMORY_CREATED"
  | "MEMBER_JOINED"
  | "INVITE_PENDING";

interface MealPollSummary {
  id: UUID;
  diningGroupId: UUID;
  title: string;
  planDate: string;
  mealSlot: MealSlot;
  status: MealPollStatus;
  deadlineAt: IsoDateTime;
  choiceLimit: number;
  note: string | null;
  candidateCount: number;
  responseCount: number;
  confirmedPlanItemId: UUID | null;
  confirmedDiningEventId: UUID | null;
  version: number;
  createdAt: IsoDateTime;
}

interface MealPollCandidateSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID | null;
  title: string;
  coverUrl: string | null;
  status: MealPollCandidateStatus;
  sourceType: "RECIPE" | "SUGGESTION";
  suggestedByUid: number | null;
  voteCount: number;
}

interface MealPollResponseSummary {
  id: UUID;
  userUid: number;
  selectedCandidateIds: UUID[];
  suggestionCandidateId: UUID | null;
  note: string | null;
  respondedAt: IsoDateTime;
}

interface MealPollDetail extends MealPollSummary {
  candidates: MealPollCandidateSummary[];
  responses: MealPollResponseSummary[];
}

interface DiningGroupActivitySummary {
  id: UUID;
  diningGroupId: UUID;
  kind: DiningGroupActivityKind;
  state: ActivityState;
  actorUid: number | null;
  actorName: string | null;
  title: string;
  detail: string | null;
  pollId: UUID | null;
  planItemId: UUID | null;
  diningEventId: UUID | null;
  createdAt: IsoDateTime;
}

interface DiningEventMenuItemSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  cookUserUid: number | null;
  cookName: string | null;
}
```

DTO 说明：

1. `MealPollDetail.responses` 当前只服务征集详情和结果汇总，不进入首页轻动态。
2. `MealPollCandidateSummary.sourceType = SUGGESTION` 表示“补充一道”进入候选池前的建议项；只有被主理人采纳并能落到固定菜谱版本时，才能进入最终菜单。
3. `DiningEventMenuItemSummary` 是“我来做”的最小承载对象。当前 `DiningEventSummary.menu: RecipeContentSnapshot` 不足以支持菜级认领，后续正式同步时应改为或补充 `menuItems`。

### 12.4 写请求草案

#### `POST /meal-polls`

```ts
interface CreateMealPollRequest {
  diningGroupId: UUID;
  planDate: string;
  mealSlot: MealSlot;
  deadlineAt: IsoDateTime;
  choiceLimit: number; // 当前固定 1~3
  note: string | null; // 最长 50 字
  candidateRecipeVersionIds: UUID[];
}
```

规则：

1. 当前每个饭搭子同一 `planDate + mealSlot` 只允许一条有效征集。
2. `choiceLimit` 作为实例值冻结到征集，不跟随未来全局配置漂移。
3. 候选菜必须解析到固定 `recipeVersionId`，不能直接写自由文本菜名。

#### `POST /meal-polls/{pollId}/vote`

```ts
interface VoteMealPollRequest {
  expectedVersion: number;
  selectedCandidateIds: UUID[]; // 当前最多 3 个
  suggestionTitle: string | null; // 当前最多 20 字
  note: string | null; // 当前最多 50 字
}
```

规则：

1. 同一成员对同一征集只有一份有效回应，重复提交覆盖自己的旧回应。
2. `suggestionTitle` 只是建议，不直接进入最终菜单。
3. 截止后提交返回明确失败，不静默丢弃。

#### `POST /meal-polls/{pollId}/confirm`

```ts
interface ConfirmMealPollRequest {
  expectedVersion: number;
  finalRecipeVersionIds: UUID[];
  scheduledAt: IsoDateTime | null;
  location: string | null;
}
```

规则：

1. 该接口负责关闭征集、汇总回应、确认最终菜单，并同事务生成或更新当前餐次的 `MealPlanItem` 与对应 `DiningEvent`。
2. 最终菜单中的每一项都必须能落到固定 `recipeVersionId`。
3. 若存在未匹配的自由文本建议，必须在确认前被显式忽略或映射到真实菜谱版本，不能混进最终菜单。

#### `POST /dining-events/{eventId}/cook`

```ts
interface ClaimCookRequest {
  expectedVersion: number;
  menuItemId: UUID;
  action: "CLAIM" | "RELEASE";
}
```

规则：

1. `menuItemId` 必须属于该饭局当前已确认菜单。
2. `CLAIM` 表示当前操作者认领该菜；`RELEASE` 只能释放自己已认领的菜，或由发起人按后续权限规则释放。
3. 同一道菜同一时刻只有一位有效认领人，并发冲突返回 `409`。

### 12.5 现有接口的对齐要求

1. `POST /meal-plans/{planItemId}/dining-event` 仍可保留给“个人计划转饭局”的旧入口；但当餐次是由点菜征集确认而来时，客户端不再拆成“先确认计划，再单独创建饭局”两步。
2. `POST /dining-events/{eventId}/bring` 继续作为“我带菜”写接口，不新增并行路径。
3. `GET /dining-events/{eventId}` 正式收口时需要补 `menuItems`，否则无法支持“我来做”。

## 十三、最小数据表与约束草案

本节只描述新增主事实，不等于本轮已经接受具体 Prisma 名称。后续实现时必须再对照 `api-database-rules.md` 完成字段、外键、唯一约束和迁移评审。

| 主事实 / 关系 | owner | 必要字段 | 生命周期 | 外键 / 唯一 / Check | 说明 |
| --- | --- | --- | --- | --- | --- |
| `meal_polls` | `DINING_GROUP` | `dining_group_id`、`plan_date`、`meal_slot`、`deadline_at`、`choice_limit`、`note`、`status`、`version` | 创建征集 -> 关闭 -> 确认 -> 完成 | `UNIQUE (dining_group_id, plan_date, meal_slot)`；`CHECK (choice_limit between 1 and 3)` | 一个饭搭子同一餐次只保留一条有效征集事实 |
| `meal_poll_candidates` | `MEAL_POLL` | `poll_id`、`recipe_version_id?`、`title`、`source_type`、`status` | 随征集创建；建议菜可被采纳或拒绝 | `FK poll_id`；`CHECK (source_type)` | 候选菜与“补充一道”统一承载 |
| `meal_poll_responses` | `PARTICIPATION` | `poll_id`、`user_id`、`note`、`responded_at` | 成员提交或覆盖自己的回应 | `UNIQUE (poll_id, user_id)` | 每人每征集只有一份回应头 |
| `meal_poll_response_items` | `PARTICIPATION` | `response_id`、`candidate_id` | 随回应覆盖重写 | `UNIQUE (response_id, candidate_id)` | 一道回应里选中的候选项明细 |
| `dining_group_activities` | `DINING_GROUP` | `dining_group_id`、`kind`、`state`、`actor_user_id?`、`title`、`detail?`、`poll_id?`、`plan_item_id?`、`dining_event_id?`、`created_at` | 由关键业务动作追加，首页只读最近 3~5 条 | 需要防重的事件键；外键按关联对象建立 | 这是轻动态，不是聊天消息 |
| `dining_event_menu_items` | `DINING_EVENT` | `dining_event_id`、`recipe_version_id`、`title`、`cook_user_id?`、`version` | 由征集确认时生成；认领或释放时更新 | `FK dining_event_id`；`CHECK (version >= 0)` | 为“我来做”提供菜级稳定主键 |

关键约束：

1. `meal_polls` 必须通过事务与版本控制保证“关闭征集 -> 汇总回应 -> 生成计划 / 饭局”原子完成。
2. `meal_poll_responses` 的覆盖更新必须保证旧选择不残留脏行。
3. `dining_event_menu_items` 的认领必须使用 `expectedVersion` 或等价行锁，避免两人同时认领同一道菜。
4. `dining_group_activities` 只记录结构化事项，不允许存自由聊天文本，也不提供回复链。

当前明确不新增：

1. 动态评论表。
2. 动态已读表。
3. 记忆墙月度索引表。
4. 与扫码入群、通讯录拉人相关的新邀请表。

## 十四、停止条件

出现以下情况时停止实现并重新确认：

1. 需要把饭搭子重新定义为共享空间。
2. 需要把完整动态流、消息中心或聊天能力并入当前范围。
3. 需要让“补充一道”直接写入未冻结的菜谱事实。
4. 需要把“我来做”或“我带菜”直接改写别人的个人购物、冰箱或菜谱所有权。
5. 分享快照需要包含白名单外字段。

## 十五、后续最小纵切顺序

1. 先冻结征集、成员选择、建议菜、轻动态和认领分工的最小合同。
2. 落客户端首页轻动态卡片与征集主路径。
3. 落结果汇总、最终菜单确认和“我来做”。
4. 落“我带菜”附加区与个人购物联动。
5. 最后落饭搭子卡生成、白名单确认和分享快照。

## 十六、范围自检

1. 本文满足的确认规则：保留“饭搭子”命名；“我来做 / 我带菜”并存；首页仅做轻动态；记忆墙延后。
2. 明确没有顺手加入的功能：聊天、公开动态流、记忆墙、扫码入群、共享购物、共享冰箱。
3. 没有提前新增的抽象：本文只定义页面职责、状态和事件，不提前定义 manager、adapter、center 一类通用层。
4. 仍可继续缩小的实现范围：若首轮资源不足，可先不做餐后反馈，只保留“完成 -> 生成饭搭子卡”。
