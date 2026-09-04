# Cook 登录体系实现方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次性完成 Cook 的统一登录体系：手机号主账号、微信手机号快捷登录、短信验证码兜底、手机号密码备用登录、登录态自动续期、退出登录清理、全局风控和成本限制。

**Architecture:** 手机号是唯一主账号，微信 openid/unionid、短信验证码、手机号密码都只能登录或绑定到同一个 `user_id`。前端统一使用全局 `LoginModal` 承接所有需要登录的业务动作，后端统一用 `access_token + refresh_token + auth_sessions` 管理登录态，并在付费通道和账号安全两个层面做频控。

**Tech Stack:** Cook 现有 uni-app 小程序客户端、Nest/API 后端、微信 `wx.login` 与手机号快捷验证能力、阿里云短信服务、服务端数据库、现有测试与 HBuilderX/微信开发者工具验证链路。

**Spec:** 本文件即实现规格和交付计划。

## Global Constraints

- V1 不接邮箱登录，不接邮件通知。
- `phone` 是 Cook 的主账号标识，必须唯一。
- 微信快捷登录、短信验证码登录、手机号密码登录都必须归并到同一个 `user_id`。
- 已绑定 openid 的用户通过 `wx.login` 静默登录，不重复调用微信手机号快捷验证，避免重复扣费。
- 短信发送和微信手机号快捷验证属于付费通道，必须单独限流。
- 手机号密码登录不消耗短信和微信额度，但必须受全局账号安全风控限制。
- 用户主动退出后，不自动恢复完整登录，必须用户重新触发登录。
- 业务页不各自实现登录空状态，继续使用全局 `LoginModal`。
- 自动化检查不能替代 HBuilderX/微信开发者工具和真机关键流程验证。

---

## 1. 账号与身份模型

### 1.1 主账号规则

Cook 账号以手机号为主账号：

```text
user_id
phone
wechat_openid / unionid
password_hash
```

规则：

- 一个手机号只能对应一个用户。
- 一个微信 openid 在同一个小程序 appid 下只能绑定一个用户。
- 微信快捷登录拿到手机号后，按 `phone` 查用户，有则绑定微信身份，无则创建用户。
- 短信验证码登录按 `phone` 查用户，有则登录，无则创建用户。
- 手机号密码登录按 `phone + password` 登录。
- 不允许微信、短信、密码登录分别创建多个账号。

### 1.2 用户状态

用户状态建议：

```text
active
blocked
deleted
```

登录前统一检查：

- `active`：允许登录。
- `blocked`：拒绝登录，返回 `USER_BLOCKED`。
- `deleted`：拒绝登录或按现有注销恢复规则处理。

## 2. 登录态规则

### 2.1 Token 模型

使用：

```text
access_token：短有效期，用于接口鉴权
refresh_token：长有效期，用于自动续期
auth_sessions：服务端 session，保存 refresh_token 哈希、设备、IP、过期和吊销状态
```

建议：

- `access_token` 有效期：2 小时以内。
- `refresh_token` 有效期：30 天以内。
- refresh_token 只保存 hash，不保存明文。

### 2.2 自动续期规则

```text
业务请求前发现 access_token 快过期
  -> 前端静默调用 /api/auth/refresh
  -> refresh 有效：签发新 access_token
  -> refresh 失效：清本地登录态，进入 guest
```

接口 401 处理：

```text
收到 401
  -> 若当前不是主动退出状态，尝试 refresh
    -> refresh 成功：重放原请求
    -> refresh 失败：清登录态，按业务需要打开 LoginModal
  -> 若当前是主动退出状态，不自动 refresh，不静默恢复完整登录
```

要求：

- refresh 并发必须合并，多个请求同时 401 时只能发一个 refresh。
- refresh 失败后不能无限重试。
- 登录弹窗不能叠加。

### 2.3 主动退出规则

主动退出必须：

```text
调用 /api/auth/logout
后端吊销 auth_session
前端清 access_token
前端清 refresh_token
前端清 user
前端清通知角标缓存
前端设置 logoutExplicit = true
关闭需要登录的临时态
```

主动退出后：

- 不允许启动时通过 `wx.login` 直接恢复完整登录。
- 用户再次点击登录按钮后，才允许重新登录。

## 3. 前端整体流程

### 3.1 小程序启动流程

```text
打开 Cook 小程序
  -> 读取本地 auth 状态
    -> access_token 有效：进入业务
    -> access_token 快过期：静默 refresh
    -> access_token 无效：进入微信静默识别

微信静默识别：
  -> wx.login 获取 code
  -> POST /api/auth/wechat/session
    -> status=bound：保存 token 和 user，静默登录
    -> status=unbound：保存 wechatSessionId，保持 guest
    -> status=blocked：保持 guest，展示错误或冷却
```

### 3.2 业务入口登录校验

业务入口统一调用：

```ts
loginModal.open({
  scene: 'theme_confirm' | 'plan_action' | 'reminder_setting' | 'profile' | 'other',
  afterLogin: () => {
    // 恢复用户原本要做的操作
  },
})
```

规则：

- 未登录点击需要登录的功能时，打开 `LoginModal`。
- 登录成功后执行 `afterLogin`。
- 不做额外跳转，除非原入口明确需要跳转。
- 提醒设置、我的勋章、主题确认、计划相关入口继续由入口层拦截，不跳到独立登录页。

### 3.3 LoginModal 结构

默认展示：

```text
标题：登录后继续使用
主按钮：微信手机号快捷登录
次入口：手机号验证码登录
弱入口：手机号 + 密码登录
```

必须支持：

- 微信手机号快捷登录。
- 手机号验证码登录。
- 手机号密码登录。
- 登录成功回调。
- 登录失败错误展示。
- 短信冷却倒计时。
- 风控冷却提示。

## 4. 后端接口

### 4.1 微信静默识别

```text
POST /api/auth/wechat/session
```

请求：

```json
{
  "code": "wx.login 返回的 code",
  "deviceId": "客户端设备标识"
}
```

返回：已绑定

```json
{
  "status": "bound",
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": 1,
    "phone": "13800000000"
  }
}
```

返回：未绑定

```json
{
  "status": "unbound",
  "wechatSessionId": "短期微信会话凭证"
}
```

返回：受限

```json
{
  "status": "blocked",
  "code": "RISK_BLOCKED",
  "message": "登录请求过于频繁，请稍后再试"
}
```

后端逻辑：

```text
校验 wx.login code
调用微信 code2session
获取 openid/unionid/session_key
按 appid + openid 查询绑定关系
  已绑定：检查用户状态，签发 token
  未绑定：创建 wechat_login_sessions，返回 wechatSessionId
记录登录事件
```

### 4.2 微信手机号快捷登录

```text
POST /api/auth/wechat/phone-login
```

请求：

```json
{
  "wechatSessionId": "短期微信会话凭证",
  "phoneCode": "微信手机号组件返回的 code",
  "scene": "login",
  "deviceId": "客户端设备标识"
}
```

后端逻辑：

```text
校验 wechatSessionId 存在、未过期、未消费
校验 phoneCode 未被消费
校验微信手机号快捷登录频控
校验全局风控
调用微信接口换取手机号
按 phone 查询用户
  有用户：绑定当前 appid + openid 到该 user_id
  无用户：创建 users，再绑定 appid + openid
消费 wechatSessionId 或标记本次绑定完成
签发 access_token + refresh_token
记录登录日志
返回 token 和 user
```

限制：

```text
同 openid：每天最多 3-5 次手机号换取
同设备：每天最多 5 次手机号换取
同 IP：短时间异常直接拦截或要求图形验证码
wechatSessionId 有效期：5-10 分钟
phoneCode 一次性使用，不能重放
```

### 4.3 短信验证码发送

```text
POST /api/auth/sms/send
```

请求：

```json
{
  "phone": "13800000000",
  "scene": "login",
  "deviceId": "客户端设备标识"
}
```

返回：

```json
{
  "cooldownSeconds": 60
}
```

后端逻辑：

```text
校验手机号格式
校验短信频控
校验全局风控
调用阿里云 PNVS 短信认证生成 6 位验证码
保存 provider_out_id、过期时间、场景、IP、设备
返回 cooldownSeconds
```

短信频控：

```text
同手机号：60 秒 1 次
同手机号：1 小时 5 次
同手机号：1 天 10 次
同 IP：1 分钟 10 次
同设备：1 小时 10 次
```

### 4.4 短信验证码登录

```text
POST /api/auth/sms/login
```

请求：

```json
{
  "phone": "13800000000",
  "code": "123456",
  "scene": "login",
  "wechatSessionId": "可选，有则登录后顺便绑定微信",
  "deviceId": "客户端设备标识"
}
```

后端逻辑：

```text
校验验证码存在、未过期、未消费
调用 PNVS 校验验证码
按 phone 查询用户
  有用户：登录
  无用户：创建用户
如果带 wechatSessionId：绑定当前微信 openid/unionid
消费验证码
签发 access_token + refresh_token
记录登录日志
```

规则：

- 验证码只能消费一次。
- 验证码过期后不能使用。
- 同一个手机号不会因为短信登录重复创建用户。

### 4.5 手机号密码登录

```text
POST /api/auth/password/login
```

请求：

```json
{
  "phone": "13800000000",
  "password": "用户输入的密码",
  "deviceId": "客户端设备标识"
}
```

后端逻辑：

```text
校验手机号格式
校验全局风控
查询用户
校验用户状态
校验 password_hash
密码正确：签发 access_token + refresh_token
密码错误：记录失败次数和风险事件
```

规则：

- 密码登录不消耗短信和微信快捷额度。
- 短信次数用完但密码正确时，允许登录。
- 命中全局风控时，微信、短信、密码三种登录方式都受限。
- 同手机号连续失败 5 次，锁定 15 分钟或要求图形验证码。
- 同 IP / 设备大量失败，限制所有登录入口。

### 4.6 设置和修改密码

```text
POST /api/auth/password/set
POST /api/auth/password/change
```

规则：

- 已登录用户可以设置密码。
- 修改密码需要已登录。
- 高风险场景可要求短信验证码二次验证。
- 密码 hash 使用服务端安全算法，禁止明文存储。

### 4.7 自动续期

```text
POST /api/auth/refresh
```

请求：

```json
{
  "refreshToken": "...",
  "deviceId": "客户端设备标识"
}
```

后端逻辑：

```text
校验 refresh_token hash
校验 auth_session 未过期、未吊销
校验用户状态
签发新 access_token
必要时轮换 refresh_token
记录 refresh 日志
```

### 4.8 退出登录

```text
POST /api/auth/logout
```

请求：

```json
{
  "refreshToken": "...",
  "deviceId": "客户端设备标识"
}
```

后端逻辑：

```text
定位 auth_session
设置 revoked_at
记录 logout 日志
返回成功
```

### 4.9 当前用户信息

```text
GET /api/auth/me
```

返回：

```json
{
  "id": 1,
  "phone": "13800000000",
  "status": "active"
}
```

## 5. 数据表设计

### 5.1 users

```text
id
phone
password_hash
status
created_at
updated_at
```

约束：

```text
phone 唯一
status in active / blocked / deleted
```

### 5.2 user_wechat_identities

```text
id
user_id
appid
openid
unionid
created_at
updated_at
```

约束：

```text
appid + openid 唯一
user_id 外键关联 users
```

### 5.3 auth_sessions

```text
id
user_id
refresh_token_hash
device_id
ip
user_agent
expires_at
revoked_at
created_at
updated_at
```

### 5.4 wechat_login_sessions

```text
id
appid
openid
unionid
session_key_hash
wechat_session_id_hash
expires_at
consumed_at
created_at
```

说明：

- `wechatSessionId` 只给前端短期使用。
- 不直接暴露 openid 和 session_key。
- 不建议落库 session_key 明文。

### 5.5 sms_codes

```text
id
phone
scene
code_hash（企业短信本地核销时使用，个人资质 PNVS 阶段可空）
provider_out_id
expires_at
consumed_at
ip
device_id
created_at
```

### 5.6 auth_risk_events

```text
id
scene
phone
openid
ip
device_id
decision
reason
created_at
```

## 6. 风控和成本控制

### 6.1 付费通道限制

限制对象：

```text
短信发送
微信手机号快捷验证
```

目的：

```text
防短信盗刷
防微信手机号接口重复调用扣费
控制每日成本上限
```

建议配置：

```text
短信每日成本上限
短信余额告警
短信发送失败率告警
微信手机号快捷调用每日上限
微信手机号快捷异常调用告警
```

### 6.2 账号安全限制

限制对象：

```text
微信手机号快捷登录
短信验证码登录
手机号密码登录
```

触发条件：

```text
同手机号短时间大量失败
同 IP 尝试大量手机号
同设备频繁切换手机号
同 openid 频繁请求手机号授权
异常 User-Agent 或请求头
服务端识别为脚本请求
```

命中后：

```text
返回明确错误码
进入冷却
要求图形验证码
严重时临时封禁 IP / 设备 / 手机号
```

## 7. 错误码

```text
AUTH_REQUIRED
TOKEN_EXPIRED
REFRESH_EXPIRED
SESSION_REVOKED
WECHAT_SESSION_EXPIRED
WECHAT_PHONE_CODE_INVALID
PHONE_ALREADY_BOUND
SMS_COOLDOWN
SMS_DAILY_LIMIT
VERIFY_CODE_INVALID
VERIFY_CODE_EXPIRED
PASSWORD_INVALID
LOGIN_LOCKED
RISK_BLOCKED
USER_BLOCKED
```

## 8. 前端实现任务

- [ ] 建立统一 auth store，管理 `accessToken`、`refreshToken`、`user`、`authStatus`、`logoutExplicit`、`refreshing`。
- [ ] 在请求层实现 access token 快过期自动 refresh。
- [ ] 在请求层实现 401 后 refresh、重放原请求、失败后进入 guest。
- [ ] 实现 refresh 并发合并，禁止多个请求同时刷新 token。
- [ ] 接入 `wx.login` 启动静默识别。
- [ ] 接入 `/api/auth/wechat/session`，处理 `bound`、`unbound`、`blocked`。
- [ ] 在全局 `LoginModal` 增加微信手机号快捷登录入口。
- [ ] 在全局 `LoginModal` 增加短信验证码登录入口。
- [ ] 在全局 `LoginModal` 增加手机号密码登录入口。
- [ ] 登录成功后保存 token、刷新用户信息、关闭弹窗、执行 `afterLogin`。
- [ ] 主动退出时清 token、user、通知角标缓存，并设置 `logoutExplicit = true`。
- [ ] 保持业务入口层登录校验，不把未登录用户跳到独立登录页。

## 9. 后端实现任务

- [ ] 建立或调整 `users`、`user_wechat_identities`、`auth_sessions`、`wechat_login_sessions`、`sms_codes`、`auth_risk_events` 数据表。
- [ ] 实现 `POST /api/auth/wechat/session`。
- [ ] 实现 `POST /api/auth/wechat/phone-login`。
- [ ] 实现 `POST /api/auth/sms/send`。
- [ ] 实现 `POST /api/auth/sms/login`。
- [ ] 实现 `POST /api/auth/password/login`。
- [ ] 实现 `POST /api/auth/password/set`。
- [ ] 实现 `POST /api/auth/password/change`。
- [ ] 实现 `POST /api/auth/refresh`。
- [ ] 实现 `POST /api/auth/logout`。
- [ ] 实现 `GET /api/auth/me`。
- [ ] 实现短信发送频控。
- [ ] 实现微信手机号快捷验证频控。
- [ ] 实现全局账号安全风控。
- [ ] PNVS 验证码不保存明文，refresh token 只保存 hash。
- [ ] 所有登录入口记录登录日志和风险事件。

## 10. 安全要求

- 阿里云短信 AccessKey 只放后端环境变量。
- 不允许前端、小程序、仓库里出现短信密钥。
- 使用 RAM 子账号，只授予短信发送所需权限。
- 短信模板固定，不允许前端传短信内容。
- PNVS 验证码由平台生成和校验，服务端只保存挑战流水和消费状态，不保存明文。
- refresh_token 只保存 hash，不保存明文。
- 微信 openid/session_key 不直接返回给前端。
- 登录日志记录 IP、设备、场景、结果。
- 设置每日短信成本上限和告警。
- 设置微信手机号快捷调用每日上限和告警。

## 11. 验收标准

- [ ] access_token 快过期时可以自动续期。
- [ ] refresh_token 有效时不会弹登录框。
- [ ] refresh_token 失效时会清登录态并弹登录框。
- [ ] 用户主动退出后不会自动恢复完整登录。
- [ ] openid 已绑定用户启动时可静默登录。
- [ ] openid 未绑定用户启动时不创建用户。
- [ ] 微信手机号快捷登录可创建新用户。
- [ ] 微信手机号快捷登录可绑定已有手机号用户。
- [ ] 同一个手机号不会因为微信、短信、密码生成多个用户。
- [ ] 短信验证码发送受频控限制。
- [ ] 短信验证码不能重复消费。
- [ ] 短信次数用完后，手机号密码正确仍可登录。
- [ ] 全局风控命中后，微信、短信、密码都受限。
- [ ] 密码连续失败会锁定或要求验证码。
- [ ] LoginModal 登录成功后能恢复原业务操作。
- [ ] 退出登录后通知角标缓存被清空。
- [ ] HBuilderX/微信开发者工具验证关键登录路径。
- [ ] 真机验证微信手机号授权、拒绝授权、短信兜底、退出再登录。

## 12. 最终结论

Cook 的登录体系以手机号为唯一主账号。微信用于低成本快捷登录和静默恢复，短信用于兜底，手机号密码用于备用。所有登录方式最终都落到同一个 `user_id`。付费通道单独限流，账号安全全局限流。只有主动退出、refresh 失效、未绑定、风控拦截等明确情况才弹 `LoginModal`。
