<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ApiClientError, type UUID } from "@/apis/http";
import {
  userApi,
  type AdminUserEntitlementResponse,
  type UserProfile
} from "@/apis/user";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

type UserStatus = "ACTIVE" | "DISABLED";
type UserFormMode = "create" | "edit";

const loading = ref(false);
const users = ref<UserProfile[]>([]);
const total = ref(0);
const entitlementVisible = ref(false);
const entitlementLoading = ref(false);
const entitlement = ref<AdminUserEntitlementResponse | null>(null);
const entitlementError = ref("");
const userDialogVisible = ref(false);
const userDialogMode = ref<UserFormMode>("create");
const userSaving = ref(false);
const editingUserId = ref<UUID | null>(null);
const resetPasswordVisible = ref(false);
const resetPasswordSaving = ref(false);
const resetPasswordUser = ref<UserProfile | null>(null);
const resetPasswordDraft = ref("");
const router = useRouter();
const sessionStore = useSessionStore();
const canViewRecipeDomain = computed(() => sessionStore.admin?.roles.includes("SUPER_ADMIN") ?? false);
const canViewEntitlements = computed(() => sessionStore.admin?.roles.includes("SUPER_ADMIN") ?? false);
const canManageUsers = computed(() => sessionStore.admin?.roles.includes("SUPER_ADMIN") ?? false);
const showActionColumn = computed(() => canViewRecipeDomain.value || canViewEntitlements.value || canManageUsers.value);
let usersRequest = 0;
let entitlementRequest = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: ""
});

const userForm = reactive<{
  phone: string;
  nickname: string;
  password: string;
  status: UserStatus;
}>({
  phone: "",
  nickname: "",
  password: "",
  status: "ACTIVE"
});

async function loadUsers() {
  const requestId = ++usersRequest;
  loading.value = true;
  try {
    const result = await userApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined
    });
    if (requestId !== usersRequest) return;

    users.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (requestId !== usersRequest) return;
    ElMessage.error(error instanceof Error ? error.message : "加载失败");
  } finally {
    if (requestId === usersRequest) {
      loading.value = false;
    }
  }
}

function search() {
  query.page = 1;
  void loadUsers();
}

function openRecipeDomain(row: UserProfile) {
  void router.push({
    name: "user-recipe-domain",
    params: { userId: row.id }
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

function getEntitlementError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === 403) return "当前管理员无权查看用户权益";
    if (error.code === 404) return "用户不存在或不可访问";
  }

  return error instanceof Error ? error.message : "权益加载失败";
}

function clearEntitlement() {
  entitlementRequest += 1;
  entitlementLoading.value = false;
  entitlement.value = null;
  entitlementError.value = "";
}

async function openEntitlement(row: UserProfile) {
  const requestId = ++entitlementRequest;
  entitlementVisible.value = true;
  entitlementLoading.value = true;
  entitlement.value = null;
  entitlementError.value = "";

  try {
    const result = await userApi.getEntitlements(row.id);
    if (requestId !== entitlementRequest || !entitlementVisible.value) return;
    entitlement.value = result;
  } catch (error) {
    if (requestId !== entitlementRequest || !entitlementVisible.value) return;
    entitlement.value = null;
    entitlementError.value = getEntitlementError(error);
    ElMessage.error(entitlementError.value);
  } finally {
    if (requestId === entitlementRequest) {
      entitlementLoading.value = false;
    }
  }
}

function clearUserDialog() {
  userSaving.value = false;
  editingUserId.value = null;
  userForm.phone = "";
  userForm.nickname = "";
  userForm.password = "";
  userForm.status = "ACTIVE";
}

function openCreateUser() {
  userDialogMode.value = "create";
  clearUserDialog();
  userDialogVisible.value = true;
}

function openEditUser(row: UserProfile) {
  userDialogMode.value = "edit";
  clearUserDialog();
  editingUserId.value = row.id;
  userForm.phone = row.phone || "";
  userForm.nickname = row.nickname || "";
  userForm.status = row.status === "DISABLED" ? "DISABLED" : "ACTIVE";
  userDialogVisible.value = true;
}

function validatePhone(value: string) {
  return /^1[3-9]\d{9}$/.test(value.trim());
}

async function submitUser() {
  const phone = userForm.phone.trim();
  const nickname = userForm.nickname.trim();

  if (!validatePhone(phone)) {
    ElMessage.error("请输入合法手机号");
    return;
  }

  if (userDialogMode.value === "create" && userForm.password.trim().length < 6) {
    ElMessage.error("初始密码至少 6 位");
    return;
  }

  if (userDialogMode.value === "edit" && !editingUserId.value) {
    ElMessage.error("用户信息缺失");
    return;
  }

  userSaving.value = true;
  try {
    if (userDialogMode.value === "create") {
      await userApi.create({
        operationId: createOperationId(),
        phone,
        password: userForm.password.trim(),
        nickname: nickname || undefined,
        status: userForm.status
      });
      query.page = 1;
      ElMessage.success("用户已创建");
    } else {
      await userApi.update(editingUserId.value!, {
        operationId: createOperationId(),
        phone,
        nickname
      });
      ElMessage.success("用户已更新");
    }

    userDialogVisible.value = false;
    clearUserDialog();
    await loadUsers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    userSaving.value = false;
  }
}

function clearResetPasswordDialog() {
  resetPasswordSaving.value = false;
  resetPasswordUser.value = null;
  resetPasswordDraft.value = "";
}

function openResetPassword(row: UserProfile) {
  resetPasswordUser.value = row;
  resetPasswordDraft.value = "";
  resetPasswordVisible.value = true;
}

async function submitResetPassword() {
  if (!resetPasswordUser.value) return;
  if (resetPasswordDraft.value.trim().length < 6) {
    ElMessage.error("新密码至少 6 位");
    return;
  }

  resetPasswordSaving.value = true;
  try {
    await userApi.resetPassword(resetPasswordUser.value.id, {
      operationId: createOperationId(),
      newPassword: resetPasswordDraft.value.trim()
    });
    resetPasswordVisible.value = false;
    clearResetPasswordDialog();
    ElMessage.success("密码已重置");
    await loadUsers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "重置失败");
  } finally {
    resetPasswordSaving.value = false;
  }
}

async function toggleUserStatus(row: UserProfile, status: UserStatus) {
  const actionText = status === "ACTIVE" ? "启用" : "禁用";
  try {
    await ElMessageBox.confirm(`确认${actionText}该用户吗？`, `${actionText}用户`, {
      type: status === "ACTIVE" ? "info" : "warning",
      confirmButtonText: actionText,
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await userApi.setStatus(row.id, {
      operationId: createOperationId(),
      status
    });
    ElMessage.success(`已${actionText}`);
    await loadUsers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${actionText}失败`);
  }
}

function statusTagType(status: string) {
  return status === "ACTIVE" ? "success" : "warning";
}

onMounted(loadUsers);
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel">
      <el-input
        v-model="query.keyword"
        class="toolbar-search"
        placeholder="UID / 昵称 / 手机号"
        clearable
        @keyup.enter="search"
      />
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button :icon="Refresh" @click="loadUsers">刷新</el-button>
      <el-button v-if="canManageUsers" type="success" :icon="Plus" @click="openCreateUser">新增用户</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="users" row-key="id">
        <el-table-column prop="uid" label="UID" width="110" />
        <el-table-column prop="nickname" label="昵称" min-width="160">
          <template #default="{ row }">
            {{ row.nickname || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" min-width="150">
          <template #default="{ row }">
            {{ row.phone || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ formatStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="190" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="190" />
        <el-table-column v-if="showActionColumn" label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canViewRecipeDomain" link type="primary" @click="openRecipeDomain(row)">查看菜谱域</el-button>
            <el-button v-if="canViewEntitlements" link type="primary" @click="openEntitlement(row)">查看权益</el-button>
            <el-button v-if="canManageUsers" link type="primary" @click="openEditUser(row)">编辑</el-button>
            <el-button
              v-if="canManageUsers && row.status === 'ACTIVE'"
              link
              type="warning"
              @click="toggleUserStatus(row, 'DISABLED')"
            >
              禁用
            </el-button>
            <el-button
              v-if="canManageUsers && row.status === 'DISABLED'"
              link
              type="success"
              @click="toggleUserStatus(row, 'ACTIVE')"
            >
              启用
            </el-button>
            <el-button v-if="canManageUsers" link type="danger" @click="openResetPassword(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadUsers"
          @size-change="search"
        />
      </div>
    </div>

    <el-dialog
      v-model="userDialogVisible"
      :title="userDialogMode === 'create' ? '新增用户' : '编辑用户'"
      width="480px"
      destroy-on-close
      @close="clearUserDialog"
    >
      <el-form label-position="top">
        <el-form-item label="手机号" required>
          <el-input v-model="userForm.phone" maxlength="11" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="userForm.nickname" maxlength="64" placeholder="留空则不设置昵称" />
        </el-form-item>
        <el-form-item v-if="userDialogMode === 'create'" label="初始密码" required>
          <el-input v-model="userForm.password" type="password" show-password maxlength="128" placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item v-if="userDialogMode === 'create'" label="状态">
          <el-select v-model="userForm.status" style="width: 100%">
            <el-option :label="formatStatusText('ACTIVE')" value="ACTIVE" />
            <el-option :label="formatStatusText('DISABLED')" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button :disabled="userSaving" @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="userSaving" @click="submitUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="resetPasswordVisible"
      title="重置密码"
      width="420px"
      destroy-on-close
      @close="clearResetPasswordDialog"
    >
      <el-form label-position="top">
        <el-form-item label="用户">
          <el-text>{{ resetPasswordUser?.phone || resetPasswordUser?.nickname || resetPasswordUser?.uid || "-" }}</el-text>
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input v-model="resetPasswordDraft" type="password" show-password maxlength="128" placeholder="至少 6 位" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button :disabled="resetPasswordSaving" @click="resetPasswordVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetPasswordSaving" @click="submitResetPassword">确认重置</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="entitlementVisible" title="用户个人权益" size="560px" destroy-on-close @close="clearEntitlement">
      <el-skeleton v-if="entitlementLoading" :rows="10" animated />

      <el-result v-else-if="entitlementError" icon="error" title="权益加载失败" :sub-title="entitlementError" />

      <template v-else-if="entitlement">
        <el-divider content-position="left">用户</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="用户 ID">{{ entitlement.user.id }}</el-descriptions-item>
          <el-descriptions-item label="UID">{{ entitlement.user.uid }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ entitlement.user.nickname || "-" }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ formatStatusText(entitlement.user.status) }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">饭搭子关系</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="主理数量">{{ entitlement.diningGroupUsage.ownedCount }}</el-descriptions-item>
          <el-descriptions-item label="加入数量">{{ entitlement.diningGroupUsage.joinedCount }}</el-descriptions-item>
          <el-descriptions-item label="可加入上限">{{ entitlement.diningGroupUsage.joinLimit }}</el-descriptions-item>
          <el-descriptions-item label="关系状态">{{ entitlement.diningGroupUsage.state }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="entitlement.diningGroups" row-key="id" style="margin-top: 12px">
          <el-table-column prop="name" label="关系名称" min-width="160" />
          <el-table-column label="身份" width="100">
            <template #default="{ row }">
              {{ row.myRole }}
            </template>
          </el-table-column>
          <el-table-column label="成员" width="100">
            <template #default="{ row }">
              {{ row.memberCount }} / {{ row.memberLimit }}
            </template>
          </el-table-column>
          <el-table-column prop="state" label="状态" width="150" />
        </el-table>

        <el-divider content-position="left">个人会员</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="个人套餐">{{ entitlement.membership.tier }}</el-descriptions-item>
          <el-descriptions-item label="有效期">{{ entitlement.membership.validUntil || "长期有效" }}</el-descriptions-item>
          <el-descriptions-item label="我的页背景图">
            {{ entitlement.display.canUseProfileBackground ? "已开放" : "未开放" }}
          </el-descriptions-item>
          <el-descriptions-item label="首页背景图">
            {{ entitlement.display.canUseHomeBackground ? "已开放" : "未开放" }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">个人空间</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="空间状态">{{ entitlement.storage.state }}</el-descriptions-item>
          <el-descriptions-item label="已用空间">{{ formatBytes(entitlement.storage.usedBytes) }}</el-descriptions-item>
          <el-descriptions-item label="空间上限">{{ formatBytes(entitlement.storage.limitBytes) }}</el-descriptions-item>
          <el-descriptions-item label="剩余空间">{{ formatBytes(entitlement.storage.remainingBytes) }}</el-descriptions-item>
          <el-descriptions-item label="计算时间">{{ entitlement.storage.calculatedAt }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">策略摘要</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="菜谱上限">{{ entitlement.recipePolicy.recipeLimit }}</el-descriptions-item>
          <el-descriptions-item label="可邀请成员">{{ entitlement.invitePolicy.inviteLimit }}</el-descriptions-item>
          <el-descriptions-item label="饭搭子成员上限">{{ entitlement.invitePolicy.memberLimit }}</el-descriptions-item>
          <el-descriptions-item label="回收站保留">{{ entitlement.recipePolicy.recycleDays }} 天</el-descriptions-item>
          <el-descriptions-item label="根菜谱派生上限">
            {{ entitlement.recipePolicy.variantLimitPerRoot }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">图片策略</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="质量">{{ entitlement.imagePolicy.quality }}</el-descriptions-item>
          <el-descriptions-item label="最大宽度">{{ entitlement.imagePolicy.maxWidth }} px</el-descriptions-item>
          <el-descriptions-item label="最大高度">{{ entitlement.imagePolicy.maxHeight }} px</el-descriptions-item>
          <el-descriptions-item label="单图输出上限">
            {{ formatBytes(entitlement.imagePolicy.maxOutputBytes) }}
          </el-descriptions-item>
          <el-descriptions-item label="原图输入上限">
            {{ formatBytes(entitlement.imagePolicy.maxInputBytes) }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </section>
</template>
