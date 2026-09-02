<template>
  <page-meta :page-style="themePageStyle" />
  <Layout
    title=""
    full-screen
    :navbar-transparent="true"
    :navbar-placeholder="false"
  >
    <template #navbar-center>
      <view class="detail-nav">
        <text class="detail-nav__title" :style="navTitleStyle">{{ navTitle }}</text>
      </view>
    </template>

    <view class="meal-detail-page">
      <view class="detail-nav-backdrop" :style="navBackdropStyle" />
      <LoginEmptyState
        v-if="!sessionStore.isLoggedIn"
        class="meal-detail-empty"
        title="登录后查看餐次详情"
        description="顶部标题会继续保留；登录后再安排这顿饭、继续发起饭局和查看参与情况。"
      />

      <template v-else-if="loading && !planDetail && !eventDetail">
        <view class="meal-detail-state">加载中...</view>
      </template>
      <template v-else-if="errorText && !planDetail && !eventDetail">
        <view class="meal-detail-state meal-detail-state--error" @click="loadDetail">
          {{ errorText }}
        </view>
      </template>
      <template v-else-if="!planDetail && !eventDetail">
        <view class="meal-detail-empty">
          <Empty title="未找到这条安排" description="可能已被删除，或当前日期范围里暂无这条餐次安排。" />
        </view>
      </template>

      <template v-else>
        <scroll-view
          scroll-y
          scroll-with-animation
          class="meal-detail-scroll"
          :show-scrollbar="false"
          :scroll-into-view="scrollTarget"
          @scroll="handleScroll"
        >
          <view class="meal-detail-body">
            <view v-if="eventDetail" class="meal-hero meal-hero--event" :style="eventHeroStyle">
              <ImageField
                v-if="canUpdateCover"
                class="meal-hero__cover-field"
                variant="cover"
                :image-src="heroCoverUrl || ''"
                :title="eventCoverTitle"
                :description="eventCoverDesc"
                :button-text="coverActionText"
                :clearable="false"
                @select="handleCoverAction"
              />
              <view v-else-if="heroCoverUrl" class="meal-hero__cover-static">
                <image class="meal-hero__cover-image" :src="heroCoverUrl" mode="aspectFill" />
              </view>
              <view v-else class="meal-hero__cover-empty">
                <text class="meal-hero__cover-empty-title">暂未上传聚会照片</text>
                <text class="meal-hero__cover-empty-desc">发起人后续补上封面后，饭局列表会同步显示。</text>
              </view>
            </view>

            <view v-else class="meal-hero meal-hero--plan" :style="heroStyle">
              <view class="meal-hero__title-row">
                <view class="meal-hero__title-main">
                  <text class="meal-hero__title" :style="heroTitleStyle">{{ planHeroTitle }}</text>
                  <text class="meal-hero__eyebrow">{{ planHeroEyebrow }}</text>
                </view>
              </view>
              <text v-if="planHeroMeta" class="meal-hero__meta">{{ planHeroMeta }}</text>
            </view>

            <view class="meal-detail-content" :class="{ 'meal-detail-content--plan-ended': planClosed && !eventDetail }">
              <view class="meal-detail-summary">
                <view class="summary-card">
                  <view class="summary-card__topline">
                    <view class="summary-card__title-row">
                      <text class="summary-card__title">{{ detailTitle }}</text>
                      <text
                        v-if="canEditTitle"
                        class="cookfont icon-edit summary-card__edit"
                        :class="{ 'summary-card__edit--disabled': submitting }"
                        @click="handleTitleAction"
                      />
                    </view>
                    <text v-if="summaryBadgeText" class="summary-card__badge" :class="summaryBadgeClass">{{ summaryBadgeText }}</text>
                  </view>
                  <view class="summary-card__facts">
                    <view v-for="fact in detailFacts" :key="fact.label" class="summary-card__fact">
                      <view class="summary-card__fact-main">
                        <text class="cookfont summary-card__fact-icon" :class="fact.iconClass" />
                        <text class="summary-card__fact-label">{{ fact.label }}</text>
                      </view>
                      <text class="summary-card__fact-value">{{ fact.value }}</text>
                    </view>
                  </view>
                  <view v-if="organizerAvatarItem" class="summary-card__avatars">
                    <view class="summary-card__avatars-head">
                      <text class="summary-card__avatars-title">参与人</text>
                      <view
                        v-if="canManageParticipants"
                        class="meal-inline-action meal-inline-action--ghost summary-card__avatars-action"
                        @click="openParticipantSheet"
                      >
                        <text class="cookfont icon-manage meal-menu__add-icon" />
                        管理
                      </view>
                    </view>
                    <view class="summary-card__avatars-row">
                      <view class="summary-card__avatar-group">
                        <view class="summary-card__avatar" :title="organizerAvatarItem.name">
                          <image v-if="organizerAvatarItem.avatarUrl" class="summary-card__avatar-image" :src="organizerAvatarItem.avatarUrl" mode="aspectFill" />
                          <text v-else class="summary-card__avatar-fallback">{{ organizerAvatarItem.fallback }}</text>
                        </view>
                      </view>
                      <view v-if="showParticipantAvatarGroup" class="summary-card__avatar-divider" />
                      <view v-if="showParticipantAvatarGroup" class="summary-card__avatar-group">
                        <view v-for="item in visibleParticipantAvatarItems" :key="item.key" class="summary-card__avatar" :title="item.name">
                          <image v-if="item.avatarUrl" class="summary-card__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
                          <text v-else class="summary-card__avatar-fallback">{{ item.fallback }}</text>
                        </view>
                        <view v-if="participantAvatarOverflow > 0" class="summary-card__avatar summary-card__avatar--more">
                          <text class="summary-card__avatar-more">+{{ participantAvatarOverflow }}</text>
                        </view>
                        <button
                          v-if="canInviteParticipants"
                          class="summary-card__invite"
                          :class="{ 'summary-card__invite--disabled': inviteSharing }"
                          :disabled="inviteSharing"
                          :open-type="inviteShareReady && !inviteSharing ? 'share' : ''"
                          @click="handleInviteShare"
                        >
                          <text class="cookfont icon-share summary-card__invite-icon" />
                        </button>
                      </view>
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="eventErrorText && !eventDetail" class="meal-panel meal-panel--warning" @click="loadDetail">
                <text class="meal-panel__title">饭局信息暂时加载失败</text>
                <text class="meal-panel__meta">{{ eventErrorText }}</text>
              </view>

              <view v-if="planDetail || eventDetail" id="meal-menu-panel" class="meal-panel" :class="{ 'meal-panel--focus': focusedSection === 'menu' }">
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">{{ menuPanelTitle }}</text>
                  <view class="meal-menu__head-actions">
                    <view
                      v-if="showMenuDeadlineAction"
                      class="meal-inline-action meal-inline-action--ghost meal-menu__deadline-action"
                      @click="handleMenuDeadlineAction"
                    >
                      <text class="cookfont icon-time meal-menu__add-icon" />
                      <text>{{ menuDeadlineText }}</text>
                    </view>
                    <view
                      v-if="canManageMenu"
                      class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                      @click="openMenuSheet"
                    >
                      <text class="cookfont icon-add meal-menu__add-icon" />
                      <text>添加菜单</text>
                    </view>
                  </view>
                </view>

                <view v-if="currentMenuItems.length" class="meal-menu">
                  <view
                    v-for="item in currentMenuItems"
                    :key="item.key"
                    class="meal-menu__row"
                  >
                    <text
                      :class="['meal-menu__name', item.recipeId ? 'meal-menu__name--link' : '']"
                      :hover-class="item.recipeId ? 'meal-menu__name--hover' : ''"
                      hover-stay-time="100"
                      @click="openRecipeDetail(item.recipeId)"
                    >
                      {{ item.title }}
                    </text>
                    <view class="meal-menu__dash" />
                    <view class="meal-menu__status">
                      <text class="meal-menu__status-text">
                        {{ resolveMenuStatusText(item) }}
                      </text>
                    </view>
                  </view>
                </view>

                <view v-else class="meal-menu-empty">
                  <text class="meal-menu-empty__title">菜单待补</text>
                  <text class="meal-menu-empty__text">
                    {{ menuPanelEmptyText }}
                  </text>
                  <view
                    v-if="canManageMenu"
                    class="meal-menu-empty__action"
                    hover-class="meal-menu-empty__action--hover"
                    hover-stay-time="100"
                    @click="openMenuSheet"
                  >
                    添加这顿菜单
                  </view>
                </view>
              </view>

              <view v-if="eventDetail" id="meal-wish-panel" class="meal-panel">
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">我想吃池</text>
                  <view
                    v-if="canChooseWish"
                    class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                    @click="openWishSheet"
                  >
                    <text class="cookfont icon-add meal-menu__add-icon" />
                    <text>我想吃</text>
                  </view>
                </view>

                <view v-if="wishItems.length" class="wish-list">
                  <view v-for="item in wishItems" :key="item.key" class="wish-list__row">
                    <view class="wish-list__main">
                      <view class="wish-list__title-row">
                        <text class="wish-list__title">{{ item.title }}</text>
                        <text v-if="item.suggestedByMe" class="wish-list__tag">我提的</text>
                        <text v-else-if="item.supportedByMe" class="wish-list__tag">已附议</text>
                        <text v-if="item.supportCount > 0" class="wish-list__count">{{ item.supportCount }}人想吃</text>
                      </view>
                      <text class="wish-list__meta">
                        {{ item.inCurrentMenu ? "主家已经把这道菜放进本次菜单。" : "先留在池子里，等主家确认要不要加入本次菜单。" }}
                      </text>
                    </view>
                    <button
                      v-if="isEventOrganizer"
                      class="wish-list__action"
                      :class="{ 'wish-list__action--disabled': item.inCurrentMenu || wishMenuLoadingId === item.id }"
                      :disabled="item.inCurrentMenu || wishMenuLoadingId === item.id"
                      @click="addWishItemToMenu(item)"
                    >
                      {{ item.inCurrentMenu ? "已在菜单" : wishMenuLoadingId === item.id ? "加入中..." : "加入本次菜单" }}
                    </button>
                    <button
                      v-else-if="canChooseWish"
                      class="wish-list__action"
                      :class="{ 'wish-list__action--ghost': item.supportedByMe, 'wish-list__action--disabled': wishActionLoadingId === item.id }"
                      :disabled="wishActionLoadingId === item.id"
                      @click="toggleWishSupport(item)"
                    >
                      {{
                        wishActionLoadingId === item.id
                          ? "处理中..."
                          : item.supportedByMe
                            ? item.suggestedByMe
                              ? "撤下"
                              : "取消附议"
                            : "附议"
                      }}
                    </button>
                  </view>
                </view>

                <view v-else class="meal-menu-empty">
                  <text class="meal-menu-empty__title">还没有人提这顿想吃什么</text>
                  <text class="meal-menu-empty__text">{{ wishPanelEmptyText }}</text>
                </view>
              </view>

              <view v-if="eventDetail" id="meal-bring-panel" class="meal-panel">
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">带菜</text>
                  <view
                    v-if="canChooseBring"
                    class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                    @click="openBringSheet"
                  >
                    <text class="cookfont icon-add meal-menu__add-icon" />
                    <text>我带菜</text>
                  </view>
                </view>

                <view v-if="bringItems.length" class="bring-list">
                  <view v-for="item in bringItems" :key="item.key" class="bring-list__row">
                    <view class="bring-list__avatar">
                      <image v-if="item.avatarUrl" class="bring-list__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
                      <text v-else class="bring-list__avatar-fallback">{{ item.fallback }}</text>
                    </view>
                    <view class="bring-list__main">
                      <text class="bring-list__name">{{ item.name }}</text>
                      <text class="bring-list__dish">{{ item.dishTitle }}</text>
                    </view>
                    <text v-if="item.isSelf" class="bring-list__badge">我带的</text>
                  </view>
                </view>

                <view v-else class="meal-menu-empty">
                  <text class="meal-menu-empty__title">还没人登记带菜</text>
                  <text class="meal-menu-empty__text">{{ bringPanelEmptyText }}</text>
                </view>
              </view>

              <view v-if="eventDetail && !eventClosed" id="meal-shopping-panel" class="meal-panel" :class="{ 'meal-panel--focus': focusedSection === 'shopping' }">
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">采购准备</text>
                  <view
                    class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                    :class="{ 'meal-inline-action--disabled': shoppingActionDisabled }"
                    @click="openShoppingPage"
                  >
                    <text class="cookfont icon-plan meal-menu__add-icon" />
                    <text>{{ shoppingActionText }}</text>
                  </view>
                </view>
                <view class="meal-helper-state">
                  {{ shoppingPanelText }}
                </view>
                <view v-if="currentEventGapItems.length" class="menu-confirm__list meal-shopping-preview">
                  <view v-for="item in currentEventGapItems" :key="item.key" class="menu-confirm__item">
                    <view class="menu-confirm__item-main">
                      <text class="menu-confirm__item-name">{{ item.name }}</text>
                      <text class="menu-confirm__item-meta">{{ item.quantityText || "未填数量" }}</text>
                    </view>
                    <text v-if="item.recipeTitles.length" class="menu-confirm__item-recipes">{{ item.recipeTitles.join(" · ") }}</text>
                  </view>
                </view>
              </view>
              <view
                v-else-if="showShoppingPanel"
                id="meal-shopping-panel"
                class="meal-panel"
                :class="{ 'meal-panel--focus': focusedSection === 'shopping' }"
              >
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">采购准备</text>
                  <view
                    class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                    :class="{ 'meal-inline-action--disabled': shoppingActionDisabled }"
                    @click="openShoppingPage"
                  >
                    <text class="cookfont icon-plan meal-menu__add-icon" />
                    <text>{{ shoppingActionText }}</text>
                  </view>
                </view>
                <view class="meal-helper-state">
                  {{ shoppingPanelText }}
                </view>
              </view>

              <view v-if="planDetail" id="meal-assistant-panel" class="meal-panel" :class="{ 'meal-panel--focus': focusedSection === 'assistant' }">
                <view class="meal-panel__head">
                  <text class="meal-panel__title">做饭助手</text>
                  <text class="meal-panel__meta">{{ cookAssistantMeta }}</text>
                </view>

                <view v-if="cookAssistant?.isStale" class="meal-helper-banner">
                  <text class="meal-helper-banner__title">当前建议已过期</text>
                  <text class="meal-helper-banner__text">菜单或菜谱有变化，原来的做饭安排可能已经不准，建议重新生成后再开始做饭。</text>
                </view>

                <view v-if="!currentMenuItems.length" class="meal-helper-state">
                  先把这顿饭的菜单定下来，后面生成做饭建议和开始做饭都会基于这里继续。
                </view>

                <view v-else-if="cookAssistantLoading && !cookAssistant?.hasSnapshot" class="meal-helper-state">
                  正在准备这顿饭的流程安排...
                </view>

                <view v-else-if="cookAssistant?.hasSnapshot" class="meal-helper">
                  <view class="meal-helper__summary">
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">前期准备</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.prepTaskCount }}项</text>
                    </view>
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">开做步骤</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.timelineStepCount }}步</text>
                    </view>
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">预计总时长</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.totalDurationText || "待估算" }}</text>
                    </view>
                    <view class="meal-helper__summary-item">
                      <text class="meal-helper__summary-label">建议开做</text>
                      <text class="meal-helper__summary-value">{{ cookAssistant.summary.suggestedStartTime || "按这顿饭时间倒推" }}</text>
                    </view>
                  </view>
                </view>

                <view v-else class="meal-helper-state">
                  先整理这桌菜，再开始做饭。做饭助手会按菜单生成一份可执行步骤，后面再打开也能直接接着用。
                </view>

                <view v-if="currentMenuItems.length && !eventClosed && !planClosed" class="meal-helper__actions">
                  <template v-if="cookAssistant?.hasSnapshot && !cookAssistant?.isStale">
                    <button class="meal-helper__button meal-helper__button--primary meal-helper__button--main" @click="openCookAssistantPage">查看做饭助手</button>
                    <text class="meal-helper__text-action" @click="openCookMode">按菜谱做饭</text>
                  </template>
                  <template v-else-if="cookAssistant?.isStale">
                    <button
                      class="meal-helper__button meal-helper__button--primary meal-helper__button--main"
                      :disabled="cookAssistantLoading || submitting"
                      @click="handleCookAssistantAction"
                    >
                      重新生成建议
                    </button>
                    <text class="meal-helper__text-action" @click="openCookMode">按菜谱做饭</text>
                  </template>
                  <template v-else>
                    <button
                      class="meal-helper__button meal-helper__button--primary meal-helper__button--main"
                      :disabled="cookAssistantLoading || submitting"
                      @click="handleCookAssistantAction"
                    >
                      生成做饭建议
                    </button>
                    <text class="meal-helper__text-action" @click="openCookMode">按菜谱做饭</text>
                  </template>
                </view>
              </view>

              <view v-if="eventDetail" class="meal-panel">
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">备注</text>
                  <view
                    v-if="canEditEventNote"
                    class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                    @click="openNoteSheet"
                  >
                    <text class="cookfont icon-edit meal-menu__add-icon" />
                    <text>{{ eventNoteActionText }}</text>
                  </view>
                </view>

                <view v-if="eventNoteText" class="event-note">
                  <text class="event-note__text">{{ eventNoteText }}</text>
                </view>

                <view v-else class="meal-menu-empty">
                  <text class="meal-menu-empty__title">{{ eventNoteEmptyTitle }}</text>
                  <text class="meal-menu-empty__text">{{ eventNoteEmptyText }}</text>
                </view>
              </view>

              <view v-if="showMemoryPanel" id="meal-memory-panel" class="meal-panel" :class="{ 'meal-panel--focus': focusedSection === 'memory' }">
                <view class="meal-panel__head meal-panel__head--row">
                  <text class="meal-panel__title">饭局回忆</text>
                  <view class="meal-inline-action meal-inline-action--ghost meal-menu__add-action" @click="openMemory">
                    <text class="cookfont icon-share meal-menu__add-icon" />
                    <text>{{ memoryActionText }}</text>
                  </view>
                </view>
                <view class="meal-memory-entry">
                  <text class="meal-memory-entry__title">{{ memoryPanelTitle }}</text>
                  <text class="meal-memory-entry__text">{{ memoryPanelText }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>

        <view v-if="footerVisible" id="meal-footer-panel" class="meal-footer" :class="{ 'meal-footer--focus': focusedSection === 'footer' }">
          <view v-if="showFooterStatus" class="meal-footer__status">
            <template v-if="showFooterCountdown && footerCountdownParts">
              <view class="meal-footer__countdown">
                <text class="meal-footer__countdown-prefix">还剩</text>
                <text class="meal-footer__countdown-box">{{ footerCountdownParts.days }}</text>
                <text class="meal-footer__countdown-unit">天</text>
                <text class="meal-footer__countdown-box">{{ footerCountdownParts.hours }}</text>
                <text class="meal-footer__countdown-separator">:</text>
                <text class="meal-footer__countdown-box">{{ footerCountdownParts.minutes }}</text>
                <text class="meal-footer__countdown-separator">:</text>
                <text class="meal-footer__countdown-box">{{ footerCountdownParts.seconds }}</text>
                <text class="meal-footer__countdown-suffix">开饭</text>
              </view>
              <view v-if="pendingCount > 0" class="meal-footer__join">
                <text class="meal-footer__join-label">待加入</text>
                <text class="meal-footer__join-value">{{ pendingCount }}</text>
              </view>
            </template>
            <template v-else>
              <view class="meal-footer__status-main">
                <text class="cookfont meal-footer__status-icon" :class="footerStatusIcon" />
                <text class="meal-footer__status-text">{{ footerStatusText }}</text>
              </view>
              <text v-if="footerStatusMeta" class="meal-footer__status-meta">{{ footerStatusMeta }}</text>
            </template>
          </view>

          <view v-if="endedMemoryAction" class="meal-footer__actions meal-footer__actions--ended">
            <button class="meal-footer__memory" @click="handleFooterAction(endedMemoryAction.key)">
              <text class="cookfont meal-footer__memory-icon" :class="endedMemoryAction.iconClass" />
              <text class="meal-footer__memory-label">{{ endedMemoryAction.label }}</text>
            </button>
          </view>

        <view v-else class="meal-footer__actions">
          <view
            v-if="footerQuickAction && footerQuickAction.key !== 'share-invite'"
            class="meal-footer__quick"
            :class="{ 'meal-footer__quick--disabled': footerQuickAction.disabled }"
            @click="handleFooterAction(footerQuickAction.key)"
          >
            <text class="cookfont meal-footer__quick-icon" :class="footerQuickAction.iconClass" />
            <text class="meal-footer__quick-label">{{ footerQuickAction.label }}</text>
          </view>
          <button
            v-else-if="footerQuickAction"
            class="meal-footer__quick meal-footer__quick--button"
            :class="{ 'meal-footer__quick--disabled': footerQuickAction.disabled }"
            :disabled="footerQuickAction.disabled || submitting"
            :open-type="inviteShareReady && !inviteSharing ? 'share' : ''"
            @click="handleFooterAction(footerQuickAction.key)"
          >
            <text class="cookfont meal-footer__quick-icon" :class="footerQuickAction.iconClass" />
            <text class="meal-footer__quick-label">{{ footerQuickAction.label }}</text>
          </button>

            <view class="meal-footer__buttons" :class="{ 'meal-footer__buttons--single': footerButtonCount === 1 }">
              <button
                v-if="footerSecondaryAction"
                class="meal-footer__button meal-footer__button--ghost"
                :disabled="footerSecondaryAction.disabled || submitting"
                @click="handleFooterAction(footerSecondaryAction.key)"
              >
                {{ footerSecondaryAction.label }}
              </button>
              <button
                v-if="footerPrimaryAction"
                class="meal-footer__button meal-footer__button--primary"
                :disabled="footerPrimaryAction.disabled || submitting"
                @click="handleFooterAction(footerPrimaryAction.key)"
              >
                <text class="meal-footer__button-content">{{ footerPrimaryAction.label }}</text>
                <text v-if="footerPrimaryGapText" class="meal-footer__button-badge">{{ footerPrimaryGapText }}</text>
              </button>
            </view>
          </view>
        </view>

        <ShoppingListPickerSheet
          :visible="shoppingSheetVisible"
          :loading="shoppingListLoading"
          :error-text="shoppingListError"
          :items="shoppingLists"
          :selected-id="selectedShoppingListId"
          :create-name="shoppingCreateName"
          :submitting="shoppingWriting"
          @close="closeShoppingSheet"
          @after-close="handleShoppingSheetAfterClose"
          @retry="loadShoppingLists(true)"
          @create="createShoppingList"
          @confirm="confirmAddToShoppingList"
          @update:selected-id="selectedShoppingListId = $event"
          @update:create-name="shoppingCreateName = $event"
        />

        <ParticipantManageSheet
          :visible="participantSheetVisible"
          :current-items="participantCurrentItems"
          :pending-items="participantPendingItems"
          :declined-items="participantDeclinedItems"
          :can-edit-note="canEditEventNote"
          :note-action-text="eventNoteActionText"
          :note-text="eventNoteText"
          :note-empty-title="eventNoteEmptyTitle"
          :note-empty-text="eventNoteEmptyText"
          :can-invite="canInviteParticipants"
          :invite-ready="inviteShareReady"
          :invite-sharing="inviteSharing"
          :submitting="submitting"
          :action-participant-id="participantActionId"
          @close="closeParticipantSheet"
          @edit-note="openNoteSheet"
          @invite="handleInviteShare"
          @revoke="revokeParticipantInvite"
          @reinvite="reinviteParticipant"
        />

        <MenuConfirmSheet
          :visible="menuConfirmSheetVisible"
          :subtitle="menuConfirmSummaryText"
          :summary-title="menuConfirmSummaryTitle"
          :summary-text="menuConfirmSummaryText"
          :loading="false"
          :items="menuConfirmItems"
          :empty-text="menuConfirmEmptyText"
          :submitting="submitting"
          @close="closeMenuConfirmSheet"
          @confirm="handleConfirmMenuAction"
        />

        <SheetShell
          :visible="recipeSheetVisible"
          :title="recipeSheetTitle"
          :subtitle="recipeSheetSubtitle"
          @close="closeRecipeSheet"
          @after-close="handleRecipeSheetAfterClose"
        >
          <view class="recipe-sheet">
            <text v-if="recipeSheetTipText" class="recipe-sheet__tip">
              {{ recipeSheetTipText }}
            </text>
            <text v-if="recipeSheetMode === 'menu'" class="recipe-sheet__tip">
              没有合适的，可以去
              <text class="recipe-sheet__tip-link" @click="openInspirationSquare">灵感广场</text>
              继续找。
            </text>
            <view v-if="recipeSheetLoading" class="recipe-sheet__state">正在加载我的菜谱...</view>
            <view v-else-if="recipeSheetError" class="recipe-sheet__state recipe-sheet__state--error" @click="retryRecipeSheet">
              {{ recipeSheetError }}
            </view>
            <scroll-view v-else-if="recipeSheetItems.length" scroll-y class="recipe-sheet__scroll" :show-scrollbar="false">
              <view class="recipe-sheet__list">
                <view
                  v-for="item in recipeSheetItems"
                  :key="item.id"
                  class="recipe-sheet__row"
                  :class="{
                    'recipe-sheet__row--pending-add': isRecipePendingAdd(item),
                    'recipe-sheet__row--pending-remove': isRecipePendingRemove(item),
                    'recipe-sheet__row--selected': isRecipeSelected(item),
                    'recipe-sheet__row--submitting': recipeSubmitting || submitting
                  }"
                  @click="toggleRecipeSelection(item)"
                >
                  <view class="recipe-sheet__cover">
                    <image v-if="item.coverImageUrl" class="recipe-sheet__cover-image" :src="item.coverImageUrl" mode="aspectFill" />
                    <view v-else class="recipe-sheet__cover-placeholder">
                      <text class="cookfont icon-recipe recipe-sheet__cover-icon" />
                    </view>
                  </view>
                  <view class="recipe-sheet__main">
                    <text class="recipe-sheet__name">{{ item.title }}</text>
                    <text class="recipe-sheet__meta">
                      {{ item.category?.name || "未分类" }}<text v-if="item.durationText"> · {{ item.durationText }}</text>
                    </text>
                  </view>
                  <view
                    class="recipe-sheet__status"
                    :class="{
                      'recipe-sheet__status--pending-add': isRecipePendingAdd(item),
                      'recipe-sheet__status--added': isRecipeAdded(item) && !isRecipePendingRemove(item),
                      'recipe-sheet__status--pending-remove': isRecipePendingRemove(item),
                      'recipe-sheet__status--selected': (recipeSheetMode === 'bring' || recipeSheetMode === 'wish') && isRecipeSelected(item) && !isRecipeAdded(item)
                    }"
                  >
                    <text class="recipe-sheet__status-text">{{ recipeSheetStatusText(item) }}</text>
                  </view>
                </view>
              </view>
            </scroll-view>
            <view v-else class="recipe-sheet__empty">
              <text class="recipe-sheet__empty-title">{{ recipeSheetEmptyTitle }}</text>
              <text class="recipe-sheet__empty-text">{{ recipeSheetEmptyText }}</text>
            </view>
          </view>

          <template #footer>
            <view class="sheet-actions">
              <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="recipeSubmitting" @click="closeRecipeSheet">
                取消
              </button>
              <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="recipeConfirmDisabled" @click="submitRecipeSheet">
                {{ recipeConfirmButtonText }}
              </button>
            </view>
          </template>
        </SheetShell>

        <TextFieldSheet
          :visible="titleSheetVisible"
          title="修改标题"
          subtitle="留空会恢复成默认的餐次饮食计划名。"
          :model-value="titleDraft"
          placeholder="例如：周末家宴"
          :maxlength="40"
          :submitting="submitting"
          confirm-text="保存标题"
          confirm-loading-text="保存中..."
          @close="closeTitleSheet"
          @after-close="handleTitleSheetAfterClose"
          @confirm="submitTitleUpdate"
          @update:model-value="titleDraft = $event"
        />

        <TextFieldSheet
          :visible="noteSheetVisible"
          title="饭局备注"
          subtitle="写给参与人的公开说明，比如到场提醒、饮食禁忌或临时安排。"
          :model-value="noteDraft"
          placeholder="例如：有人花生过敏，今晚不要带含花生的凉菜"
          :maxlength="255"
          multiline
          :submitting="submitting"
          confirm-text="保存备注"
          confirm-loading-text="保存中..."
          @close="closeNoteSheet"
          @after-close="handleNoteSheetAfterClose"
          @confirm="submitEventNote"
          @update:model-value="noteDraft = $event"
        />

        <EventScheduleSheet
          :visible="showEventEditor"
          :title="eventDetail ? '修改时间' : '发起饭局'"
          subtitle="先把时间定下来，菜单后面仍在这个餐次详情里继续补。"
          date-mode="calendar"
          :date="scheduledDate"
          :month-date="scheduleMonthDate"
          :min-date="scheduleMinDate"
          :time="scheduledTime"
          :meal-slot="planDetail?.mealSlot || 'DINNER'"
          :submitting="submitting"
          :cancel-text="eventDetail ? '先不改' : '先不发起'"
          :confirm-text="eventDetail ? '保存时间' : '确认发起饭局'"
          :confirm-loading-text="eventDetail ? '保存中...' : '创建中...'"
          date-label="安排日期"
          time-label="时间"
          @select-date="handleScheduleDateSelect"
          @month-change="handleScheduleMonthChange"
          @select-time="handleScheduleTimeSelect"
          @confirm="createEvent"
          @close="closeEventEditor"
        />

      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onHide, onLoad, onShareAppMessage, onShow, onUnload } from "@dcloudio/uni-app";
import { mealApi, type DiningEventSummary, type MealPlanCookAssistant, type MealPlanSummary } from "../apis/meal";
import type { UUID } from "@/apis/http";
import { recipeApi, type MyRecipeSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import Layout from "@/components/Layout/Layout.vue";
import EventScheduleSheet from "@/components/Meal/EventScheduleSheet.vue";
import MenuConfirmSheet from "@/components/Meal/MenuConfirmSheet.vue";
import ParticipantManageSheet from "@/components/Meal/ParticipantManageSheet.vue";
import ShoppingListPickerSheet from "@/components/Shopping/ShoppingListPickerSheet.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import TextFieldSheet from "@/components/Sheet/TextFieldSheet.vue";
import ImageField from "@/components/ImageField.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { shoppingApi, type ShoppingGapResponse, type ShoppingGapWindow, type ShoppingListSummary } from "@/apis/shopping";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { formatMealSlot, isPastLocalDateTime, resolveMealSlotExpireMs, resolveMealSlotSuggestedTime } from "@/utils/meal-slot";
import {
  parseRecentArrangementDetailFocus,
  type DetailFocus,
  type RecentArrangementFocus,
  resolveRecentArrangementFocusTargetId
} from "@/utils/recent-arrangement-focus";
import {
  buildDefaultShoppingListName,
  buildMealShoppingListName,
  buildShoppingListDetailPath,
  hasShoppingListLink
} from "@/utils/shopping";
import { formatDateTimeMinute } from "../utils/date";

type MealSlot = MealPlanSummary["mealSlot"];
type MenuEntry = {
  key: string;
  title: string;
  recipeId: UUID | null;
  recipeVersionId: UUID | null;
  menuItemId: UUID | null;
  version: number | null;
  servings: number | null;
  purchaseState: "READY" | "PENDING" | null;
};
type FactItem = {
  label: string;
  value: string;
  iconClass: string;
};
type ProgressStep = {
  label: string;
  done: boolean;
  current: boolean;
};
type ParticipantAvatarItem = {
  key: string;
  name: string;
  avatarUrl: string | null;
  fallback: string;
};
type BringEntry = {
  key: string;
  name: string;
  avatarUrl: string | null;
  fallback: string;
  dishTitle: string;
  isSelf: boolean;
};
type WishEntry = {
  key: string;
  id: UUID;
  title: string;
  supportCount: number;
  supportedByMe: boolean;
  suggestedByMe: boolean;
  inCurrentMenu: boolean;
};
type ParticipantSheetItem = {
  key: string;
  participantId: UUID | null;
  name: string;
  statusText: string;
  avatarUrl: string | null;
  dimmed: boolean;
  canRevoke: boolean;
  canReinvite: boolean;
};
type FooterStage = "MENU_EDITING" | "READY_TO_START" | "TIME_UP" | "CANCELLED";
type FooterActionKey =
  | "share-invite"
  | "recipe"
  | "wish"
  | "bring"
  | "create-event"
  | "confirm-menu"
  | "shopping"
  | "cook-assistant"
  | "share-memory"
  | "view-memory";
type FooterAction = {
  key: FooterActionKey;
  label: string;
  iconClass?: string;
  disabled?: boolean;
};
type MealGapPreviewItem = {
  key: string;
  window: ShoppingGapWindow;
  windowTitle: string;
  name: string;
  quantityText: string | null;
  recipeTitles: string[];
};
type RecipeSheetItem = MyRecipeSummary;
type RecipeSheetMode = "menu" | "bring" | "wish";
const RECIPE_HOME_INTENT_STORAGE_KEY = "recipe-home-intent-tab";

const NAV_FADE_DISTANCE = 132;
const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const { navBarTotalHeight } = useSystemInfo();
const loading = ref(false);
const submitting = ref(false);
const shoppingWriting = ref(false);
const shoppingSheetVisible = ref(false);
const shoppingListLoading = ref(false);
const shoppingListError = ref("");
const shoppingLists = ref<ShoppingListSummary[]>([]);
const selectedShoppingListId = ref<UUID | "">("");
const shoppingCreateName = ref("");
const errorText = ref("");
const eventErrorText = ref("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const eventId = ref<UUID | "">("");
const planDetail = ref<MealPlanSummary | null>(null);
const eventDetail = ref<DiningEventSummary | null>(null);
const showEventEditor = ref(false);
const scheduledDate = ref("");
const scheduledTime = ref("18:30");
const cookAssistantLoading = ref(false);
const cookAssistant = ref<MealPlanCookAssistant | null>(null);
const scrollTop = ref(0);
const scrollTarget = ref("");
const entryFocus = ref<DetailFocus>("");
const focusedSection = ref<DetailFocus>("");
const focusAttempt = ref<{
  requested: DetailFocus;
  targetId: string;
  applied: boolean;
}>({
  requested: "",
  targetId: "",
  applied: false
});
const uploadingCover = ref(false);
const participantSheetVisible = ref(false);
const participantActionId = ref<UUID | null>(null);
const inviteSharing = ref(false);
const activeSharePath = ref("");
const recipeSheetVisible = ref(false);
const recipeSheetMode = ref<RecipeSheetMode>("menu");
const recipeSheetLoading = ref(false);
const recipeSheetError = ref("");
const recipeSheetItems = ref<RecipeSheetItem[]>([]);
const recipeSelectedIds = ref<UUID[]>([]);
const recipeSubmitting = ref(false);
const wishActionLoadingId = ref<UUID | null>(null);
const wishMenuLoadingId = ref<UUID | null>(null);
const titleSheetVisible = ref(false);
const titleDraft = ref("");
const noteSheetVisible = ref(false);
const noteDraft = ref("");
const menuConfirmSheetVisible = ref(false);
const gapLoading = ref(false);
const gapErrorText = ref("");
const gapData = ref<ShoppingGapResponse | null>(null);
const scheduleMonthDate = ref(todayText());
const nowMs = ref(Date.now());
let footerTimer: ReturnType<typeof setInterval> | null = null;
let focusResetTimer: ReturnType<typeof setTimeout> | null = null;
const defaultDetailTitle = computed(() => (planDetail.value ? `${slotLabel(planDetail.value.mealSlot)}饮食计划` : "餐次详情"));

const navTitle = computed(() => detailTitle.value);
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navTitleStyle = computed(() => ({
  opacity: sessionStore.isLoggedIn ? `${navProgress.value}` : "1"
}));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`,
  "--hero-header-offset": `${navBarTotalHeight.value}px`
}));
const eventHeroStyle = computed(() => ({
  "--hero-header-offset": `${navBarTotalHeight.value}px`
}));
const heroTitleStyle = computed(() => ({
  opacity: `${1 - navProgress.value * 0.56}`
}));
const planDateText = computed(() => formatPlanDate(planDetail.value?.planDate || planDate.value));
const heroCoverUrl = computed(() => eventDetail.value?.coverImageUrl || null);
const hasDiningEvent = computed(() => Boolean(eventDetail.value || planDetail.value?.hasDiningEvent));
const planDeadlineMs = computed(() => resolvePlanDeadlineMs(planDetail.value?.planDate, planDetail.value?.mealSlot));
const planAutoEnded = computed(() => Boolean(!eventDetail.value && planDeadlineMs.value > 0 && planDeadlineMs.value <= nowMs.value));
const planClosed = computed(() => Boolean(planDetail.value && (planDetail.value.status === "COMPLETED" || planAutoEnded.value)));
const planHeroTitle = computed(() => "先安排这顿饭");
const planHeroEyebrow = computed(() => {
  if (!planDetail.value) return planDateText.value;
  return `${planDateText.value} · ${slotLabel(planDetail.value.mealSlot)}`;
});
const planHeroMeta = computed(() => {
  if (planClosed.value) return "这顿饭已经过了时间，当前菜单和记录先保留给你回看。";
  if (hasDiningEvent.value) return "这顿饭已经约上饭局，菜单、参与反馈和后续分享都从这里继续。";
  if (planDetail.value?.menuLocked) {
    return "菜单已经固定下来了，后面可以直接开始做饭，也可以再补发起饭局。";
  }
  if (currentMenuItems.value.length) {
    return "菜单、做饭顺序、后续发起饭局，都从这里继续。";
  }
  return "先把这顿饭定下来，后面的菜单和饭局都从这里展开。";
});
const eventCoverTitle = computed(() => "上传聚会封面");
const eventCoverDesc = computed(() => "上传一张聚会照片，饭局列表里也会同步显示缩略图。");
const currentMenuItems = computed<MenuEntry[]>(() => {
  if (eventDetail.value) {
    return eventDetail.value.menuItems.map(item => ({
      key: `event-${item.id}`,
      title: item.title,
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId,
      menuItemId: item.id,
      version: item.version,
      servings: null,
      purchaseState: null
    }));
  }

  return (planDetail.value?.menuItems ?? []).map(item => ({
    key: `plan-${item.recipeVersionId}`,
    title: item.title,
    recipeId: item.recipeId,
    recipeVersionId: item.recipeVersionId,
    menuItemId: null,
    version: null,
    servings: item.servings,
    purchaseState: item.purchaseState
  }));
});
const addedRecipeIds = computed(() => new Set(currentMenuItems.value.map(item => item.recipeId).filter((value): value is UUID => value !== null)));
const currentPlanShoppingItems = computed(() => {
  if (eventDetail.value) return [];
  const seen = new Set<string>();
  return currentMenuItems.value.filter(item => {
    if (!item.recipeId || !item.recipeVersionId || item.purchaseState !== "PENDING") return false;
    const key = `${item.recipeId}:${item.recipeVersionId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});
const currentPlanShoppingCount = computed(() => currentPlanShoppingItems.value.length);
const shoppingLinkTarget = computed(() => eventDetail.value ?? planDetail.value ?? null);
const linkedShoppingListId = computed(() => shoppingLinkTarget.value?.shoppingListId ?? null);
const linkedShoppingListName = computed(() => shoppingLinkTarget.value?.shoppingListName?.trim() || "");
const hasLinkedShoppingList = computed(() => hasShoppingListLink(shoppingLinkTarget.value));
const shoppingActionDisabled = computed(() => !hasLinkedShoppingList.value && (shoppingWriting.value || gapLoading.value));
const shoppingActionText = computed(() => {
  if (hasLinkedShoppingList.value) return "查看清单";
  if (gapLoading.value) return "计算中";
  if (shoppingWriting.value) return "写入中";
  return "去采购";
});
const selectedRecipeIdSet = computed(() => new Set(recipeSelectedIds.value));
const isEventOrganizer = computed(() => Boolean(eventDetail.value && eventDetail.value.organizerUid === sessionStore.uid));
const visibleEventParticipants = computed(() => {
  if (!eventDetail.value) return [];
  return eventDetail.value.participants.filter(item => item.userUid == null || item.userUid !== eventDetail.value!.organizerUid);
});
const acceptedCount = computed(() => visibleEventParticipants.value.filter(item => item.status === "ACCEPTED").length);
const pendingCount = computed(() => visibleEventParticipants.value.filter(item => item.status === "INVITED").length);
const displayParticipants = computed(() => visibleEventParticipants.value.filter(item => item.status !== "REMOVED"));
const menuPanelTitle = computed(() => "菜单");
const detailTitle = computed(() => {
  const title = eventDetail.value?.title?.trim() || planDetail.value?.title?.trim();
  return title || defaultDetailTitle.value;
});
const eventAutoEnded = computed(() => (eventDetail.value ? isEventExpired(eventDetail.value, nowMs.value) : false));
const eventClosed = computed(() => {
  if (!eventDetail.value) return false;
  return isEventClosed(eventDetail.value, nowMs.value);
});
const summaryBadgeText = computed(() => {
  if (eventDetail.value) return formatEventStatus(eventDetail.value, nowMs.value);
  return "";
});
const summaryBadgeClass = computed(() => {
  if (!eventDetail.value) return "";
  if (eventDetail.value?.status === "CANCELLED") return "summary-card__badge--cancelled";
  if (eventDetail.value && (eventAutoEnded.value || eventDetail.value.status === "COMPLETED")) return "summary-card__badge--done";
  if (eventDetail.value?.status === "CONFIRMED" || hasDiningEvent.value || currentMenuItems.value.length) return "summary-card__badge--confirmed";
  return "summary-card__badge--planned";
});
const detailFacts = computed<FactItem[]>(() => {
  const timeText = eventDetail.value
    ? `${formatDateTimeMinute(eventDetail.value.scheduledAt) || "待定"}${planDetail.value ? ` · ${slotLabel(planDetail.value.mealSlot)}` : ""}`
    : `${planDateText.value || "这一天"} · ${planDetail.value ? slotLabel(planDetail.value.mealSlot) : "这顿饭"}`;
  const menuText = currentMenuItems.value.length ? summarizeMenu(currentMenuItems.value) : "待补菜单";

  if (eventDetail.value) {
    return [
      { label: "时间", value: timeText, iconClass: "icon-time" },
      { label: "菜单", value: menuText, iconClass: "icon-dining-event" }
    ];
  }
  return [
    { label: "时间", value: timeText, iconClass: "icon-time" },
    { label: "菜单", value: menuText, iconClass: "icon-plan" }
  ];
});
const canEditTitle = computed(() => Boolean(planDetail.value && (!eventDetail.value || isEventOrganizer.value)));
const canEditEventNote = computed(() => Boolean(eventDetail.value && isEventOrganizer.value && !eventClosed.value));
const eventNoteText = computed(() => eventDetail.value?.note?.trim() || "");
const eventNoteActionText = computed(() => (eventNoteText.value ? "修改" : "添加"));
const eventNoteEmptyTitle = computed(() => (canEditEventNote.value ? "还没补充备注" : "主家还没补充备注"));
const eventNoteEmptyText = computed(() => (
  canEditEventNote.value
    ? "可以补一句到场说明、饮食提醒或其他安排。"
    : "如果主家后面补了到场说明或饮食提醒，会显示在这里。"
));
const organizerAvatarItem = computed<ParticipantAvatarItem | null>(() => {
  if (!eventDetail.value) return null;
  const organizerName = eventDetail.value.organizerName?.trim() || `UID ${eventDetail.value.organizerUid ?? "--"}`;
  return {
    key: `organizer-${eventDetail.value.organizerUid ?? "self"}`,
    name: organizerName,
    avatarUrl: eventDetail.value.organizerAvatarUrl ?? null,
    fallback: buildAvatarFallback(organizerName)
  };
});
const participantAvatarItems = computed<ParticipantAvatarItem[]>(() => {
  if (!eventDetail.value) return [];
  const items: ParticipantAvatarItem[] = [];
  for (const item of displayParticipants.value) {
    const name = item.displayName?.trim() || item.guestName?.trim() || `UID ${item.userUid ?? "--"}`;
    items.push({
      key: `participant-${item.id}`,
      name,
      avatarUrl: item.avatarUrl ?? null,
      fallback: buildAvatarFallback(name)
    });
  }

  return items;
});
const visibleParticipantAvatarItems = computed(() => participantAvatarItems.value.slice(0, 5));
const participantAvatarOverflow = computed(() => Math.max(0, participantAvatarItems.value.length - visibleParticipantAvatarItems.value.length));
const canInviteParticipants = computed(() => {
  if (!eventDetail.value) return false;
  if (eventDetail.value.organizerUid !== sessionStore.uid) return false;
  if (eventClosed.value) return false;
  return true;
});
const showParticipantAvatarGroup = computed(() =>
  Boolean(visibleParticipantAvatarItems.value.length || participantAvatarOverflow.value > 0 || canInviteParticipants.value)
);
const progressSteps = computed<ProgressStep[]>(() => {
  if (eventDetail.value) {
    const eventSteps = eventDetail.value.status === "CANCELLED"
      ? [
          { label: "饭局已创建", done: true },
          { label: "流程已取消", done: true }
        ]
      : [
          { label: "饭局已创建", done: true },
          { label: "时间已定", done: Boolean(eventDetail.value.scheduledAt) },
          { label: "菜单已定", done: currentMenuItems.value.length > 0 },
          { label: "有人响应", done: displayParticipants.value.length > 0 || acceptedCount.value > 0 || pendingCount.value > 0 },
          { label: "饭局已结束", done: eventClosed.value }
        ];
    const firstUndoneIndex = eventSteps.findIndex(item => !item.done);
    return eventSteps.map((item, index) => ({
      ...item,
      current: firstUndoneIndex >= 0 && index === firstUndoneIndex
    }));
  }

  const planSteps = [
    { label: "餐次已创建", done: Boolean(planDetail.value) },
    { label: "菜单已定", done: Boolean(planDetail.value?.menuLocked) },
    { label: "饭局已发起", done: hasDiningEvent.value },
    { label: "做饭建议已生成", done: Boolean(cookAssistant.value?.hasSnapshot && !cookAssistant.value.isStale) },
    { label: "计划已结束", done: planClosed.value }
  ];
  const firstUndoneIndex = planSteps.findIndex(item => !item.done);
  return planSteps.map((item, index) => ({
    ...item,
    current: firstUndoneIndex >= 0 && index === firstUndoneIndex
  }));
});
const progressDoneCount = computed(() => progressSteps.value.filter(item => item.done).length);
const progressTitle = computed(() => (eventDetail.value ? "饭局进度" : "计划进度"));
const progressDesc = computed(() => {
  if (eventDetail.value?.status === "COMPLETED") return "这场饭局已经收尾，后续分享和回看还可以继续处理。";
  if (eventAutoEnded.value) return "已经到开饭时间，这场饭局当前按结束态收口，后续只保留回看和分享。";
  if (eventDetail.value?.status === "CANCELLED") return "这场饭局已取消，当前不再继续推进。";
  if (eventDetail.value) return "时间、菜单和参与反馈会沿着这里继续往下推进。";
  if (planClosed.value) return "这顿饭已经过时，当前不再继续补菜单、发起饭局或生成新的做饭建议。";
  if (planDetail.value?.menuLocked) return "菜单已固定，这顿饭现在可以直接开始做饭，或继续补发起饭局与分享。";
  if (hasDiningEvent.value) return "这顿饭已经挂上饭局，后续菜单和做饭安排继续往下补。";
  return "先把这顿饭安排起来，菜单、饭局和做饭建议会按顺序补齐。";
});
const canEditPlan = computed(() => Boolean(planDetail.value && !eventClosed.value && !planClosed.value));
const canManageMenu = computed(() =>
  Boolean(canEditPlan.value && !planDetail.value?.menuLocked && (!eventDetail.value || isEventOrganizer.value))
);
const currentParticipant = computed(() => visibleEventParticipants.value.find(item => item.userUid === sessionStore.uid) ?? null);
const currentBringRecipeId = computed(() => currentParticipant.value?.bringRecipeId ?? null);
const canChooseWish = computed(() =>
  Boolean(
    eventDetail.value &&
      !eventClosed.value &&
      !isEventOrganizer.value &&
      currentParticipant.value &&
      currentParticipant.value.status !== "DECLINED" &&
      currentParticipant.value.status !== "REMOVED"
  )
);
const canChooseBring = computed(() =>
  Boolean(
    eventDetail.value &&
      !eventClosed.value &&
      !isEventOrganizer.value &&
      currentParticipant.value &&
      currentParticipant.value.status !== "DECLINED" &&
      currentParticipant.value.status !== "REMOVED"
  )
);
const wishItems = computed<WishEntry[]>(() => (
  eventDetail.value?.wishItems.map(item => ({
    key: `wish-${item.id}`,
    id: item.id,
    title: item.title,
    supportCount: item.supportCount,
    supportedByMe: item.supportedByMe,
    suggestedByMe: item.suggestedByMe,
    inCurrentMenu: item.inCurrentMenu
  })) ?? []
));
const supportedWishVersionIds = computed(() => new Set(
  eventDetail.value?.wishItems.filter(item => item.supportedByMe).map(item => item.recipeVersionId) ?? []
));
const bringItems = computed<BringEntry[]>(() => {
  if (!eventDetail.value) return [];
  return visibleEventParticipants.value
    .filter(item => Boolean(item.bringRecipeTitle?.trim()))
    .map(item => {
      const name = item.displayName?.trim() || item.guestName?.trim() || `UID ${item.userUid ?? "--"}`;
      return {
        key: `bring-${item.id}`,
        name,
        avatarUrl: item.avatarUrl ?? null,
        fallback: buildAvatarFallback(name),
        dishTitle: item.bringRecipeTitle?.trim() || "",
        isSelf: item.userUid === sessionStore.uid
      };
    });
});
const showMemoryPanel = computed(() => Boolean(eventDetail.value && eventClosed.value));
const canCreateEvent = computed(() =>
  Boolean(
    planDetail.value &&
      !planClosed.value &&
      !planDetail.value.hasDiningEvent &&
      !eventDetail.value
  )
);
const canManageParticipants = computed(() => Boolean(eventDetail.value && eventDetail.value.organizerUid === sessionStore.uid && !eventClosed.value));
const canUpdateCover = computed(() => Boolean(eventDetail.value && eventDetail.value.organizerUid === sessionStore.uid));
const canQuickShareInvite = computed(() =>
  Boolean(eventDetail.value && !eventClosed.value && (canInviteParticipants.value || activeSharePath.value || eventDetail.value.shareTokenPath))
);
const inviteShareReady = computed(() => Boolean(activeSharePath.value));
const currentEventGapItems = computed<MealGapPreviewItem[]>(() => {
  if (!eventDetail.value || !gapData.value) return [];
  const items: MealGapPreviewItem[] = [];
  for (const section of gapData.value.sections) {
    for (const item of section.items) {
      const matchedEvent = item.events.find(event => event.eventId === eventDetail.value?.id);
      if (!matchedEvent) continue;
      items.push({
        key: `${section.window}:${item.key}`,
        window: section.window,
        windowTitle: section.title,
        name: item.name,
        quantityText: item.quantityText,
        recipeTitles: matchedEvent.recipeTitles
      });
    }
  }
  return items;
});
const currentEventGapCount = computed(() => currentEventGapItems.value.length);
const showShoppingPanel = computed(() => {
  if (eventDetail.value) return !eventClosed.value;
  return Boolean(planDetail.value?.menuLocked && !planClosed.value && currentPlanShoppingCount.value > 0);
});
const footerStage = computed<FooterStage>(() => {
  if (eventDetail.value?.status === "CANCELLED") return "CANCELLED";
  if (eventDetail.value?.status === "COMPLETED" || eventDetail.value?.completedAt) return "TIME_UP";
  if (eventAutoEnded.value) return "TIME_UP";
  if (planClosed.value) return "TIME_UP";
  if (eventDetail.value?.status === "CONFIRMED" || planDetail.value?.menuLocked) return "READY_TO_START";
  return "MENU_EDITING";
});
const scheduledAtMs = computed(() => {
  if (!eventDetail.value?.scheduledAt) return 0;
  const value = new Date(eventDetail.value.scheduledAt).getTime();
  return Number.isFinite(value) ? value : 0;
});
const scheduledCountdownText = computed(() => {
  if (!scheduledAtMs.value || !eventDetail.value || eventClosed.value) return "";
  const diff = scheduledAtMs.value - nowMs.value;
  if (diff <= 0) return "已经到点了";
  return formatCountdown(diff);
});
const showFooterCountdown = computed(() => Boolean(eventDetail.value?.scheduledAt && !eventClosed.value));
const footerCountdownParts = computed(() => {
  if (!showFooterCountdown.value || !scheduledAtMs.value) return null;
  const diff = Math.max(0, scheduledAtMs.value - nowMs.value);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    days: `${days}`.padStart(2, "0"),
    hours: `${hours}`.padStart(2, "0"),
    minutes: `${minutes}`.padStart(2, "0"),
    seconds: `${seconds}`.padStart(2, "0")
  };
});
const menuDeadlineText = computed(() => (eventDetail.value ? "调整时间" : "设置时间"));
const showMenuDeadlineAction = computed(() => Boolean(eventDetail.value && canManageParticipants.value && !eventClosed.value));
const footerVisible = computed(() => {
  if (!planDetail.value || footerStage.value === "CANCELLED") return false;
  if (footerStage.value !== "TIME_UP") return true;
  return Boolean(eventDetail.value);
});
const showFooterStatus = computed(() => Boolean(eventDetail.value && footerStage.value !== "TIME_UP"));
const footerStatusIcon = computed(() => {
  if (eventDetail.value?.scheduledAt && !eventClosed.value) return "icon-time";
  if (footerStage.value === "MENU_EDITING") return "icon-notice";
  return eventDetail.value ? "icon-dining-event" : "icon-plan";
});
const footerStatusText = computed(() => {
  if (eventDetail.value?.scheduledAt && !eventClosed.value) {
    return scheduledCountdownText.value ? `距开饭还剩 ${scheduledCountdownText.value}` : formatDateTimeMinute(eventDetail.value.scheduledAt) || "开饭时间已定";
  }
  if (eventDetail.value) return "开饭时间待定";
  return `${planDateText.value} · ${planDetail.value ? slotLabel(planDetail.value.mealSlot) : "这顿饭"}`;
});
const footerStatusMeta = computed(() => {
  if (footerStage.value === "READY_TO_START" && eventDetail.value) {
    if (gapLoading.value) return "正在按当前菜单刷新这顿饭的缺口。";
    if (currentEventGapCount.value > 0) return `还差 ${currentEventGapCount.value} 样食材，下一步先去采购。`;
    if (!gapErrorText.value && currentMenuItems.value.length) return "当前菜单没有明显缺口，可以直接开始做饭。";
  }
  if (footerStage.value === "READY_TO_START" && !eventDetail.value && currentPlanShoppingCount.value > 0) {
    return `这顿饭还有 ${currentPlanShoppingCount.value} 道菜待补采购，下一步去选一个采购清单。`;
  }
  if (footerStage.value === "MENU_EDITING" && eventDetail.value && currentMenuItems.value.length) {
    if (gapLoading.value) return "当前缺口会跟着菜单实时更新。";
    if (currentEventGapCount.value > 0) return `按当前菜单看，还差 ${currentEventGapCount.value} 样食材。`;
  }
  return "";
});
const endedMemoryAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "TIME_UP" && eventDetail.value) {
    return { key: "share-memory", label: "分享回忆", iconClass: "icon-share" };
  }
  return null;
});
const footerQuickAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "MENU_EDITING") {
    if (eventDetail.value) {
      return canQuickShareInvite.value ? { key: "share-invite", label: "分享邀请", iconClass: "icon-share", disabled: inviteSharing.value } : null;
    }
    return canCreateEvent.value ? { key: "create-event", label: "发起饭局", iconClass: "icon-share" } : null;
  }
  if (footerStage.value === "READY_TO_START" && eventDetail.value) {
    return canQuickShareInvite.value ? { key: "share-invite", label: "分享邀请", iconClass: "icon-share", disabled: inviteSharing.value } : null;
  }
  if (footerStage.value === "READY_TO_START" && !eventDetail.value) {
    return canCreateEvent.value ? { key: "create-event", label: "发起饭局", iconClass: "icon-share" } : null;
  }
  return null;
});
const footerSecondaryAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "MENU_EDITING" && eventDetail.value && canChooseWish.value && canChooseBring.value) {
    return { key: "bring", label: "我带菜" };
  }
  return null;
});
const footerPrimaryAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "CANCELLED" || footerStage.value === "TIME_UP") return null;
  if (footerStage.value === "MENU_EDITING") {
    if (canManageMenu.value) {
      return {
        key: "confirm-menu",
        label: "确认菜单",
        disabled: !currentMenuItems.value.length
      };
    }
    if (eventDetail.value && canChooseWish.value) {
      return { key: "wish", label: "我想吃" };
    }
    return canChooseBring.value ? { key: "bring", label: "我带菜" } : null;
  }
  if (footerStage.value === "READY_TO_START") {
    if (eventDetail.value && currentEventGapCount.value > 0) {
      return {
        key: "shopping",
        label: hasLinkedShoppingList.value ? "查看采购清单" : "去采购",
        disabled: hasLinkedShoppingList.value ? false : shoppingWriting.value || gapLoading.value
      };
    }
    if (!eventDetail.value && currentPlanShoppingCount.value > 0) {
      return {
        key: "shopping",
        label: hasLinkedShoppingList.value ? "查看采购清单" : "去采购",
        disabled: hasLinkedShoppingList.value ? false : shoppingWriting.value
      };
    }
    if (isEventOrganizer.value || !eventDetail.value) {
      return currentMenuItems.value.length ? { key: "cook-assistant", label: "做饭助手" } : null;
    }
    return canChooseBring.value ? { key: "bring", label: "我带菜" } : null;
  }
  return null;
});
const footerPrimaryGapText = computed(() => {
  if (footerPrimaryAction.value?.key === "confirm-menu") {
    return currentMenuItems.value.length ? `${currentMenuItems.value.length}道菜` : "";
  }
  if (footerPrimaryAction.value?.key === "shopping" && eventDetail.value) {
    if (gapLoading.value) return "计算中";
    if (currentEventGapCount.value > 0) return `还差 ${currentEventGapCount.value} 样`;
  }
  return "";
});
const footerButtonCount = computed(() => Number(Boolean(footerSecondaryAction.value)) + Number(Boolean(footerPrimaryAction.value)));
const menuConfirmItems = computed(() => currentMenuItems.value.map(item => ({
  key: item.key,
  name: item.title,
  quantityText: resolveMenuMeta(item) || null,
  recipeTitles: [] as string[]
})));
const menuConfirmSummaryTitle = computed(() => {
  if (!currentMenuItems.value.length) return "这顿饭还没定菜";
  return `这顿饭共 ${currentMenuItems.value.length} 道菜`;
});
const menuConfirmSummaryText = computed(() => {
  if (!currentMenuItems.value.length) return "这次确认只固定这顿吃什么，不处理带菜和采购。";
  return "这次确认只固定主家菜单；带菜不会算进这里，食材缺口确认后再看。";
});
const menuConfirmEmptyText = computed(() => (
  currentMenuItems.value.length ? `已选 ${currentMenuItems.value.length} 道主家菜单。` : "先补一两道主家菜单，再来确认。"
));
const shareHeadline = computed(() => eventDetail.value?.title?.trim() || detailTitle.value);
const recipePendingAddCount = computed(() => {
  if (recipeSheetMode.value === "bring" || recipeSheetMode.value === "wish") {
    if (!recipeSelectedIds.value.length) return 0;
    if (recipeSheetMode.value === "bring") {
      return recipeSelectedIds.value[0] === currentBringRecipeId.value ? 0 : 1;
    }
    const selected = recipeSheetItems.value.find(item => item.id === recipeSelectedIds.value[0]);
    return selected && supportedWishVersionIds.value.has(selected.contentVersionId) ? 0 : 1;
  }
  return recipeSelectedIds.value.filter(id => !addedRecipeIds.value.has(id)).length;
});
const recipePendingRemoveCount = computed(() => {
  if (recipeSheetMode.value === "bring" || recipeSheetMode.value === "wish") return 0;
  return recipeSelectedIds.value.filter(id => addedRecipeIds.value.has(id)).length;
});
const recipeConfirmDisabled = computed(() => {
  if (recipeSubmitting.value) return true;
  if (recipeSheetMode.value === "bring" || recipeSheetMode.value === "wish") return recipePendingAddCount.value === 0;
  return !recipePendingAddCount.value && !recipePendingRemoveCount.value;
});
const recipeSheetTitle = computed(() => {
  if (recipeSheetMode.value === "bring") return "我带菜";
  if (recipeSheetMode.value === "wish") return "我想吃";
  return "添加菜单";
});
const recipeSheetSubtitle = computed(() => (
  recipeSheetMode.value === "bring"
    ? "从我的菜谱里选一道准备带去的菜，单独记在带菜区里。"
    : recipeSheetMode.value === "wish"
      ? "从我的菜谱里选一道这顿想吃的菜，先留给主家参考。"
      : "先从我的菜谱里勾选要加进来的菜单。"
));
const recipeSheetTipText = computed(() => (
  recipeSheetMode.value === "bring"
    ? "这里只显示我的菜谱；带去的菜不会并进主家的菜单和采购清单。"
    : recipeSheetMode.value === "wish"
      ? "这里只显示我的菜谱；提进去的是一道想吃的建议，不会直接并进主家菜单。"
      : ""
));
const recipeSheetEmptyTitle = computed(() => (
  recipeSheetMode.value === "bring"
    ? "还没有可带的菜谱"
    : recipeSheetMode.value === "wish"
      ? "还没有可提的菜谱"
      : "还没有我的菜谱"
));
const recipeSheetEmptyText = computed(() => (
  recipeSheetMode.value === "bring"
    ? "先准备一道自己的拿手菜，再回来登记这场饭局的带菜安排。"
    : recipeSheetMode.value === "wish"
      ? "先把想吃的菜存进自己的菜谱，再回来提给主家参考。"
    : "先去灵感广场看看，看到满意的再回来安排这顿饭。"
));
const recipeConfirmButtonText = computed(() => {
  if (recipeSubmitting.value) return "保存中...";
  if (recipeSheetMode.value === "bring") {
    return currentBringRecipeId.value ? "更新我带菜" : "确认我带菜";
  }
  if (recipeSheetMode.value === "wish") {
    return "放进我想吃池";
  }
  return recipePendingRemoveCount.value > 0 ? "确认调整" : "确认添加";
});
const menuPanelEmptyText = computed(() => {
  if (eventDetail.value) {
    return isEventOrganizer.value
      ? "这顿饭吃什么先由主家安排，后续还可以继续补菜单。"
      : "这顿饭吃什么先由主家安排，等主家定好后你再看是否要带菜。";
  }
  return "先把这顿饭的菜单定下来，后面生成做饭安排和发起饭局都会基于这里继续。";
});
const bringPanelEmptyText = computed(() => (
  canChooseBring.value
    ? "你可以从自己的菜谱里先登记一道要带的菜，避免和主家准备重复。"
    : "后面谁准备带什么，会继续单独记在这里，不和主家菜单混在一起。"
));
const wishPanelEmptyText = computed(() => (
  canChooseWish.value
    ? "你可以先提一道自己想吃的菜，主家后面会从这里决定要不要加入本次菜单。"
    : "后面大家想吃什么，会先匿名留在这里给主家参考。"
));
const scheduleMinDate = computed(() => {
  if (eventDetail.value?.scheduledAt) return todayText();
  return planDetail.value?.planDate || todayText();
});
const coverActionText = computed(() => {
  if (uploadingCover.value) return "上传中...";
  return heroCoverUrl.value ? "更换封面图" : "上传聚会图片";
});
const participantCurrentItems = computed<ParticipantSheetItem[]>(() => {
  if (!eventDetail.value) return [];
  const items: ParticipantSheetItem[] = [
    {
      key: `organizer-${eventDetail.value.organizerUid ?? "self"}`,
      participantId: null,
      name: eventDetail.value.organizerName?.trim() || `UID ${eventDetail.value.organizerUid ?? "--"}`,
      statusText: "发起人",
      avatarUrl: eventDetail.value.organizerAvatarUrl ?? null,
      dimmed: false,
      canRevoke: false,
      canReinvite: false
    }
  ];

  for (const item of visibleEventParticipants.value) {
    if (item.status !== "ACCEPTED") continue;
    items.push({
      key: `participant-${item.id}`,
      participantId: item.id,
      name: item.displayName?.trim() || item.guestName?.trim() || `UID ${item.userUid ?? "--"}`,
      statusText: formatParticipantStatus(item.status),
      avatarUrl: item.avatarUrl ?? null,
      dimmed: false,
      canRevoke: false,
      canReinvite: false
    });
  }

  return items;
});
const participantPendingItems = computed<ParticipantSheetItem[]>(() => {
  if (!eventDetail.value) return [];
  return visibleEventParticipants.value
    .filter(item => item.status === "INVITED")
    .map(item => ({
      key: `participant-${item.id}`,
      participantId: item.id,
      name: item.displayName?.trim() || item.guestName?.trim() || `UID ${item.userUid ?? "--"}`,
      statusText: formatParticipantStatus(item.status),
      avatarUrl: item.avatarUrl ?? null,
      dimmed: true,
      canRevoke: true,
      canReinvite: false
    }));
});
const participantDeclinedItems = computed<ParticipantSheetItem[]>(() => {
  if (!eventDetail.value) return [];
  return visibleEventParticipants.value
    .filter(item => item.status === "DECLINED")
    .map(item => ({
      key: `participant-${item.id}`,
      participantId: item.id,
      name: item.displayName?.trim() || item.guestName?.trim() || `UID ${item.userUid ?? "--"}`,
      statusText: formatParticipantStatus(item.status),
      avatarUrl: item.avatarUrl ?? null,
      dimmed: false,
      canRevoke: false,
      canReinvite: true
    }));
});
const cookAssistantMeta = computed(() => {
  if (eventClosed.value || planClosed.value) return "这顿饭已经结束，当前不再生成新的做饭建议。";
  if (!currentMenuItems.value.length) return "这桌菜还没定下来，先补菜单后再生成做饭建议。";
  if (cookAssistantLoading.value && !cookAssistant.value?.hasSnapshot) return "正在生成这顿饭的流程安排";
  if (!cookAssistant.value?.hasSnapshot) return "先整理这桌菜，再开始做饭。";
  if (cookAssistant.value.isStale) return "菜单或菜谱有变化，建议重新生成。";
  return cookAssistant.value.generatedAt ? `最近生成于 ${formatDateTimeMinute(cookAssistant.value.generatedAt)}` : "已生成";
});
const shoppingPanelText = computed(() => {
  if (eventClosed.value) return "这顿饭已经结束，当前不再补采购。";
  if (!currentMenuItems.value.length) return "先把菜单补齐，后面再看缺什么。";
  if (!eventDetail.value) {
    if (hasLinkedShoppingList.value && linkedShoppingListName.value) {
      return `这顿饭已挂到「${linkedShoppingListName.value}」，后面要补采购时先回这张清单继续。`;
    }
    if (currentPlanShoppingCount.value > 0) {
      return `这顿饭还有 ${currentPlanShoppingCount.value} 道菜待补采购，点击去采购后可以选择已有清单，或现场新建一张。`;
    }
    return "这顿饭当前不用额外采购，可以直接开始做饭。";
  }
  if (gapLoading.value) return "正在按当前菜单刷新这顿饭的缺口。";
  if (hasLinkedShoppingList.value && linkedShoppingListName.value && currentEventGapCount.value > 0) {
    return `当前这顿已挂到「${linkedShoppingListName.value}」，缺的食材继续补到这张清单。`;
  }
  if (currentEventGapCount.value > 0) return `当前这顿还差 ${currentEventGapCount.value} 样食材，确认菜单后就去采购。`;
  if (eventDetail.value?.status === "CONFIRMED") return "菜单已经定下来了，当前没有明显缺口，可以直接开始做饭。";
  if (gapErrorText.value) return "缺口暂时没同步出来，先确认菜单，后面再去缺口页看。";
  return "先确认菜单；确认后这里会继续显示当前饭局还差什么。";
});
const memoryPanelTitle = computed(() => (eventClosed.value ? "这顿饭可以留个回忆了" : "饭局回忆"));
const memoryPanelText = computed(() => {
  if (eventClosed.value) return "聚完了别忘了补一张回忆卡，后面翻这顿饭会更完整。";
  return "这顿饭结束后，可以回来补照片和回忆，后面翻这顿饭时会一起保留。";
});
const memoryActionText = computed(() => (eventClosed.value ? "分享回忆" : "查看回忆入口"));

onLoad(query => {
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  eventId.value = parseQueryId(query?.eventId);
  showEventEditor.value = parseQueryText(query?.mode) === "create-event";
  entryFocus.value = parseRecentArrangementDetailFocus(parseQueryText(query?.focus));
});

onShareAppMessage(() => {
  return {
    title: shareHeadline.value,
    path: activeSharePath.value || "/pages/home/index",
    imageUrl: heroCoverUrl.value || undefined
  };
});

onShow(() => {
  startFooterTimer();
  void loadDetail();
});

onHide(() => {
  stopFooterTimer();
});

onUnload(() => {
  stopFooterTimer();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      clearPageState();
      return;
    }
    void loadDetail();
  }
);

async function loadDetail() {
  if (!sessionStore.isLoggedIn) {
    clearPageState();
    return;
  }
  if (loading.value) return;

  const hasPlanQuery = Boolean(planItemId.value && planDate.value);
  const hasEventQuery = Boolean(eventId.value);
  if (!hasPlanQuery && !hasEventQuery) return;

  loading.value = true;
  errorText.value = "";
  eventErrorText.value = "";
  try {
    const currentEventId = eventId.value;
    if (currentEventId) {
      try {
        eventDetail.value = await mealApi.getDiningEvent(currentEventId);
        eventId.value = eventDetail.value.id;
        activeSharePath.value = eventDetail.value.shareTokenPath || "";
        showEventEditor.value = false;
      } catch (error) {
        eventDetail.value = null;
        activeSharePath.value = "";
        gapData.value = null;
        gapErrorText.value = "";
        if (!hasPlanQuery) {
          errorText.value = "饭局信息暂时没同步出来，点此重试";
          cookAssistant.value = null;
          return;
        }
        eventErrorText.value = "饭局信息暂时没同步出来，点此重试";
      }
    }

    if (!hasPlanQuery) {
      planDetail.value = null;
      cookAssistant.value = null;
      await loadGapPreview();
      await applyEntryFocus();
      return;
    }

    const result = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
    const nextPlan = result.items.find(item => item.id === planItemId.value) ?? null;
    planDetail.value = nextPlan;
    if (nextPlan) {
      planDate.value = nextPlan.planDate;
    }
    if (!nextPlan) {
      if (!eventDetail.value) {
        errorText.value = "这条餐次暂时找不到了，点此重试";
      }
      cookAssistant.value = null;
      await loadGapPreview();
      await applyEntryFocus();
      return;
    }

    resetEventDraft(nextPlan);
    await loadCookAssistant(nextPlan.id);
    const targetEventId = eventId.value || nextPlan.diningEventId;
    if (!targetEventId) {
      eventDetail.value = null;
      activeSharePath.value = "";
      gapData.value = null;
      gapErrorText.value = "";
      await applyEntryFocus();
      return;
    }

    if (!eventDetail.value || eventDetail.value.id !== targetEventId) {
      try {
        const nextEvent = await mealApi.getDiningEvent(targetEventId);
        if (!hasEventQuery && shouldIgnorePlanLinkedEvent(nextPlan, nextEvent)) {
          eventDetail.value = null;
          activeSharePath.value = "";
          gapData.value = null;
          gapErrorText.value = "";
          await applyEntryFocus();
          return;
        }
        eventDetail.value = nextEvent;
        eventId.value = eventDetail.value.id;
        activeSharePath.value = eventDetail.value.shareTokenPath || "";
        showEventEditor.value = false;
      } catch (error) {
        eventDetail.value = null;
        activeSharePath.value = "";
        gapData.value = null;
        gapErrorText.value = "";
        eventErrorText.value = "饭局信息暂时没同步出来，点此重试";
        await applyEntryFocus();
        return;
      }
    }

    await loadGapPreview();
    await applyEntryFocus();
  } catch (error) {
    if (!eventDetail.value) {
      errorText.value = "餐次暂时没加载出来，点此重试";
    }
  } finally {
    loading.value = false;
  }
}

function clearPageState() {
  loading.value = false;
  submitting.value = false;
  uploadingCover.value = false;
  inviteSharing.value = false;
  errorText.value = "";
  eventErrorText.value = "";
  scrollTop.value = 0;
  scrollTarget.value = "";
  entryFocus.value = "";
  focusAttempt.value = {
    requested: "",
    targetId: "",
    applied: false
  };
  clearFocusedSection();
  planDetail.value = null;
  eventDetail.value = null;
  cookAssistant.value = null;
  cookAssistantLoading.value = false;
  showEventEditor.value = false;
  participantActionId.value = null;
  activeSharePath.value = "";
  recipeSheetVisible.value = false;
  recipeSheetMode.value = "menu";
  recipeSheetError.value = "";
  recipeSelectedIds.value = [];
  recipeSubmitting.value = false;
  wishActionLoadingId.value = null;
  wishMenuLoadingId.value = null;
  noteSheetVisible.value = false;
  noteDraft.value = "";
  menuConfirmSheetVisible.value = false;
  gapLoading.value = false;
  gapErrorText.value = "";
  gapData.value = null;
}

async function automatorApplySession(snapshot: { token: string; uid: number; expiresAt: string }) {
  await sessionStore.setSession(snapshot);
  await loadDetail();
}

async function automatorReadFocusState() {
  await nextTick();
  return {
    focusedSection: focusedSection.value,
    focusAttempt: focusAttempt.value,
    hasEventDetail: Boolean(eventDetail.value),
    hasPlanDetail: Boolean(planDetail.value),
    showShoppingPanel: showShoppingPanel.value,
    scrollTarget: scrollTarget.value
  };
}

async function automatorSetNowMs(value: number) {
  stopFooterTimer();
  if (Number.isFinite(value) && value > 0) {
    nowMs.value = value;
  }
  await nextTick();
}

async function automatorReadFooterState() {
  await nextTick();
  return {
    footerStage: footerStage.value,
    footerVisible: footerVisible.value,
    quickActionLabel: footerQuickAction.value?.label ?? "",
    primaryActionLabel: footerPrimaryAction.value?.label ?? "",
    endedActionLabel: endedMemoryAction.value?.label ?? "",
    statusText: footerStatusText.value
  };
}

defineExpose({
  automatorApplySession,
  automatorReadFocusState,
  automatorSetNowMs,
  automatorReadFooterState
});

function resetEventDraft(plan: MealPlanSummary) {
  if (!showEventEditor.value) return;
  if (eventDetail.value?.scheduledAt) {
    const local = new Date(eventDetail.value.scheduledAt);
    scheduledDate.value = `${local.getFullYear()}-${`${local.getMonth() + 1}`.padStart(2, "0")}-${`${local.getDate()}`.padStart(2, "0")}`;
    scheduledTime.value = `${`${local.getHours()}`.padStart(2, "0")}:${`${local.getMinutes()}`.padStart(2, "0")}`;
    scheduleMonthDate.value = scheduledDate.value;
    return;
  }
  scheduledDate.value = plan.planDate || todayText();
  scheduledTime.value = resolveDefaultTime(plan.mealSlot, scheduledDate.value);
  scheduleMonthDate.value = scheduledDate.value;
}

function summarizeMenu(items: MenuEntry[]) {
  return items.map(item => item.title).join(" · ");
}

function buildAvatarFallback(name: string) {
  const text = name.trim();
  return (text[0] || "?").toUpperCase();
}

function slotLabel(slot: MealSlot) {
  return formatMealSlot(slot);
}

function formatPlanDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "这一天";
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function parseQueryId(value: unknown): UUID | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

function parseQueryText(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
}

function openRecipeDetail(recipeId: UUID | null) {
  if (!recipeId) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=my`);
}

function handleTitleAction() {
  if (!planDetail.value || !canEditTitle.value || submitting.value) return;
  titleDraft.value = planDetail.value.title?.trim() || "";
  titleSheetVisible.value = true;
}

function isRecipeAdded(item: RecipeSheetItem) {
  if (recipeSheetMode.value === "bring") {
    return currentBringRecipeId.value === item.id;
  }
  if (recipeSheetMode.value === "wish") {
    return supportedWishVersionIds.value.has(item.contentVersionId);
  }
  return addedRecipeIds.value.has(item.id);
}

function isRecipeSelected(item: RecipeSheetItem) {
  return selectedRecipeIdSet.value.has(item.id);
}

function isRecipePendingAdd(item: RecipeSheetItem) {
  if (recipeSheetMode.value === "bring") {
    return isRecipeSelected(item) && currentBringRecipeId.value !== item.id;
  }
  if (recipeSheetMode.value === "wish") {
    return isRecipeSelected(item) && !isRecipeAdded(item);
  }
  return isRecipeSelected(item) && !isRecipeAdded(item);
}

function isRecipePendingRemove(item: RecipeSheetItem) {
  if (recipeSheetMode.value === "bring" || recipeSheetMode.value === "wish") return false;
  return isRecipeSelected(item) && isRecipeAdded(item);
}

function recipeSheetStatusText(item: RecipeSheetItem) {
  if (recipeSheetMode.value === "bring") {
    if (isRecipeAdded(item)) return "当前带这道";
    if (isRecipePendingAdd(item)) return "待提交";
    return "选择";
  }
  if (recipeSheetMode.value === "wish") {
    if (isRecipeAdded(item)) return "已在池里";
    if (isRecipePendingAdd(item)) return "待提交";
    return "选择";
  }
  if (isRecipePendingRemove(item)) return "取消中";
  if (isRecipeAdded(item)) return "已添加";
  if (isRecipePendingAdd(item)) return "待添加";
  return "添加";
}

async function openRecipeSheet(mode: RecipeSheetMode = recipeSheetMode.value) {
  if (planClosed.value || eventClosed.value) return;
  if (!sessionStore.isLoggedIn) return;
  recipeSheetMode.value = mode;
  recipeSheetVisible.value = true;
  recipeSelectedIds.value = mode === "bring" && currentBringRecipeId.value ? [currentBringRecipeId.value] : [];
  if ((recipeSheetItems.value.length && !recipeSheetError.value) || recipeSheetLoading.value) return;
  recipeSheetLoading.value = true;
  recipeSheetError.value = "";
  try {
    const result = await recipeApi.listMyRecipes({ page: 1, pageSize: 100 });
    recipeSheetItems.value = result.items;
  } catch (error) {
    recipeSheetError.value = error instanceof Error ? error.message : "我的菜谱加载失败，点此重试";
  } finally {
    recipeSheetLoading.value = false;
  }
}

function openMenuSheet() {
  if (!canManageMenu.value) return;
  void openRecipeSheet("menu");
}

function openBringSheet() {
  if (!canChooseBring.value) return;
  void openRecipeSheet("bring");
}

function openWishSheet() {
  if (!canChooseWish.value) return;
  void openRecipeSheet("wish");
}

function retryRecipeSheet() {
  void openRecipeSheet(recipeSheetMode.value);
}

function closeRecipeSheet() {
  if (recipeSubmitting.value) return;
  recipeSheetVisible.value = false;
}

function handleRecipeSheetAfterClose() {
  recipeSelectedIds.value = [];
  recipeSubmitting.value = false;
  recipeSheetMode.value = "menu";
}

function openInspirationSquare() {
  uniPlatform.storage.setSync(RECIPE_HOME_INTENT_STORAGE_KEY, "inspiration");
  closeRecipeSheet();
  void uniPlatform.navigation.switchTab("/pages/recipe/index");
}

function toggleRecipeSelection(item: RecipeSheetItem) {
  if (recipeSubmitting.value || submitting.value) return;
  if (recipeSheetMode.value === "bring" || recipeSheetMode.value === "wish") {
    recipeSelectedIds.value = selectedRecipeIdSet.value.has(item.id) ? [] : [item.id];
    return;
  }
  if (selectedRecipeIdSet.value.has(item.id)) {
    recipeSelectedIds.value = recipeSelectedIds.value.filter(id => id !== item.id);
    return;
  }
  recipeSelectedIds.value = [...recipeSelectedIds.value, item.id];
}

function submitRecipeSheet() {
  if (recipeSheetMode.value === "bring") {
    void confirmBringSelection();
    return;
  }
  if (recipeSheetMode.value === "wish") {
    void confirmWishSelection();
    return;
  }
  void confirmRecipeSelection();
}

function openParticipantSheet() {
  if (!eventDetail.value || !canManageParticipants.value) return;
  participantSheetVisible.value = true;
}

function closeParticipantSheet() {
  participantSheetVisible.value = false;
}

function closeTitleSheet() {
  if (submitting.value) return;
  titleSheetVisible.value = false;
}

function openNoteSheet() {
  if (!eventDetail.value || !canEditEventNote.value || submitting.value) return;
  noteDraft.value = eventDetail.value.note?.trim() || "";
  noteSheetVisible.value = true;
}

function closeNoteSheet() {
  if (submitting.value) return;
  noteSheetVisible.value = false;
}

function closeMenuConfirmSheet() {
  if (submitting.value) return;
  menuConfirmSheetVisible.value = false;
}

async function revokeParticipantInvite(item: ParticipantSheetItem) {
  if (!eventDetail.value || !item.participantId || submitting.value || participantActionId.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "撤回邀请",
    content: `撤回后，${item.name} 这条待确认邀请会失效。`
  });
  if (!confirmed) return;
  submitting.value = true;
  participantActionId.value = item.participantId;
  try {
    eventDetail.value = await mealApi.revokeDiningEventParticipantInvite(eventDetail.value.id, item.participantId, {
      operationId: createOperationId()
    });
    await uniPlatform.feedback.toast({ title: "已撤回邀请", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "撤回失败", icon: "none" });
  } finally {
    participantActionId.value = null;
    submitting.value = false;
  }
}

async function reinviteParticipant(item: ParticipantSheetItem) {
  if (!eventDetail.value || !item.participantId || submitting.value || participantActionId.value) return;
  submitting.value = true;
  participantActionId.value = item.participantId;
  try {
    eventDetail.value = await mealApi.reinviteDiningEventParticipant(eventDetail.value.id, item.participantId, {
      operationId: createOperationId()
    });
    await uniPlatform.feedback.toast({ title: "已重新发出邀请", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "再次邀请失败", icon: "none" });
  } finally {
    participantActionId.value = null;
    submitting.value = false;
  }
}

function handleTitleSheetAfterClose() {
  if (titleSheetVisible.value) return;
  titleDraft.value = planDetail.value?.title?.trim() || "";
}

function handleNoteSheetAfterClose() {
  if (noteSheetVisible.value) return;
  noteDraft.value = eventDetail.value?.note?.trim() || "";
}

function openCookAssistantPage() {
  if (eventClosed.value || planClosed.value) return;
  if (!planDetail.value || !planDate.value || !currentMenuItems.value.length) return;
  const eventQuery = eventDetail.value?.id ? `&eventId=${encodeURIComponent(String(eventDetail.value.id))}` : "";
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/assistant/index?planItemId=${encodeURIComponent(String(planDetail.value.id))}&planDate=${encodeURIComponent(planDate.value)}${eventQuery}`
  );
}

function openCookMode() {
  if (eventClosed.value || planClosed.value) return;
  if (!planDetail.value || !planDate.value || !currentMenuItems.value.length) return;
  const eventQuery = eventDetail.value?.id ? `&eventId=${encodeURIComponent(String(eventDetail.value.id))}` : "";
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/cook-mode/index?source=plan&planItemId=${encodeURIComponent(String(planDetail.value.id))}&planDate=${encodeURIComponent(planDate.value)}${eventQuery}`
  );
}

function openEventEditor() {
  if (!planDetail.value || planClosed.value || eventClosed.value) return;
  showEventEditor.value = true;
  resetEventDraft(planDetail.value);
}

function closeEventEditor() {
  showEventEditor.value = false;
}

function handleScheduleDateSelect(value: string) {
  scheduledDate.value = value;
  scheduleMonthDate.value = value;
  if (isPastLocalDateTime(value, scheduledTime.value)) {
    scheduledTime.value = resolveDefaultTime(planDetail.value?.mealSlot || "DINNER", value);
  }
}

function handleScheduleTimeSelect(nextValue: string) {
  scheduledTime.value = nextValue;
}

function handleScheduleMonthChange(value: string) {
  scheduleMonthDate.value = value;
}

async function createEvent() {
  if (!planDetail.value || submitting.value) return;
  submitting.value = true;
  const updatingSchedule = Boolean(eventDetail.value);
  try {
    const nextDate = scheduledDate.value || planDetail.value.planDate || todayText();
    const nextTime = scheduledTime.value || resolveDefaultTime(planDetail.value.mealSlot, nextDate);
    if (isPastLocalDateTime(nextDate, nextTime)) {
      throw new Error("饭局时间不能早于当前时间");
    }
    const nextScheduledAt = composeScheduledAt(
      nextDate,
      nextTime
    );
    const result = eventDetail.value
      ? await mealApi.updateDiningEventSchedule(eventDetail.value.id, {
          operationId: createOperationId(),
          expectedVersion: eventDetail.value.version,
          scheduledAt: nextScheduledAt,
          location: eventDetail.value.location
        })
      : await mealApi.createDiningEvent(planDetail.value.id, {
          operationId: createOperationId(),
          scheduledAt: nextScheduledAt,
          location: null
        });
    eventId.value = result.id;
    eventDetail.value = result;
    planDetail.value = {
      ...planDetail.value,
      hasDiningEvent: true,
      diningEventId: result.id
    };
    await loadGapPreview();
    showEventEditor.value = false;
    await uniPlatform.feedback.toast({ title: updatingSchedule ? "时间已更新" : "饭局已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function confirmRecipeSelection() {
  if (!planDetail.value || recipeSubmitting.value || submitting.value || !recipeSelectedIds.value.length) return;
  const pendingAddItems = recipeSheetItems.value.filter(item => isRecipePendingAdd(item));
  const pendingRemoveIds = new Set(recipeSheetItems.value.filter(item => isRecipePendingRemove(item)).map(item => item.id));
  if (!pendingAddItems.length && !pendingRemoveIds.size) {
    recipeSelectedIds.value = [];
    return;
  }
  const keptMenuItems = planDetail.value.menuItems.filter(item => !item.recipeId || !pendingRemoveIds.has(item.recipeId));
  const missingRecipeItem = keptMenuItems.find(item => !item.recipeId);
  if (missingRecipeItem) {
    await uniPlatform.feedback.toast({ title: "当前菜单里有一道菜暂时不能编辑，请刷新后再试", icon: "none" });
    return;
  }
  const nextMenuItems = [
    ...keptMenuItems.map(item => ({
      slotType: item.slotType,
      sortOrder: item.sortOrder,
      recipeId: item.recipeId as UUID,
      recipeVersionId: item.recipeVersionId,
      purchaseState: item.purchaseState
    })),
    ...pendingAddItems.map(item => ({
      slotType: null,
      sortOrder: 0,
      recipeId: item.id,
      recipeVersionId: item.contentVersionId,
      purchaseState: "READY" as const
    }))
  ].map((item, index) => ({
    ...item,
    sortOrder: index
  }));
  if (!nextMenuItems.length) {
    await uniPlatform.feedback.toast({ title: "至少保留一道菜", icon: "none" });
    return;
  }

  recipeSubmitting.value = true;
  try {
    const nextPlan = await mealApi.createPlan({
      operationId: createOperationId(),
      planDate: planDetail.value.planDate,
      mealSlot: planDetail.value.mealSlot,
      expectedVersion: planDetail.value.version,
      title: planDetail.value.title?.trim() || null,
      menuItems: nextMenuItems
    });
    planDetail.value = nextPlan;
    syncEventMenusFromPlan(nextPlan);
    if (eventDetail.value) {
      try {
        eventDetail.value = await mealApi.getDiningEvent(eventDetail.value.id);
      } catch {
        // Keep the optimistic menu state and let the normal refresh path reconcile later.
      }
    }
    await loadDetail();
    recipeSheetVisible.value = false;
    recipeSelectedIds.value = [];
    const successText =
      pendingAddItems.length > 0 && pendingRemoveIds.size > 0
        ? "菜单已调整"
        : pendingRemoveIds.size > 0
          ? pendingRemoveIds.size > 1
            ? `已取消${pendingRemoveIds.size}道菜`
            : "这道菜已取消"
          : pendingAddItems.length > 1
            ? `已添加${pendingAddItems.length}道菜`
            : "菜单已添加";
    await uniPlatform.feedback.toast({ title: successText, icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "菜单保存失败", icon: "none" });
  } finally {
    recipeSubmitting.value = false;
  }
}

async function confirmBringSelection() {
  if (!eventDetail.value || !canChooseBring.value || recipeSubmitting.value || submitting.value) return;
  const nextRecipeId = recipeSelectedIds.value[0];
  if (!nextRecipeId || nextRecipeId === currentBringRecipeId.value) return;
  const hadBring = Boolean(currentBringRecipeId.value);

  recipeSubmitting.value = true;
  try {
    eventDetail.value = await mealApi.chooseBringRecipe(eventDetail.value.id, {
      operationId: createOperationId(),
      recipeId: nextRecipeId
    });
    recipeSheetVisible.value = false;
    recipeSelectedIds.value = [];
    await uniPlatform.feedback.toast({ title: hadBring ? "我带菜已更新" : "已登记我带菜", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "登记带菜失败", icon: "none" });
  } finally {
    recipeSubmitting.value = false;
  }
}

async function confirmWishSelection() {
  if (!eventDetail.value || !canChooseWish.value || recipeSubmitting.value || submitting.value) return;
  const nextRecipeId = recipeSelectedIds.value[0];
  if (!nextRecipeId) return;

  recipeSubmitting.value = true;
  try {
    eventDetail.value = await mealApi.chooseDiningEventWishRecipe(eventDetail.value.id, {
      operationId: createOperationId(),
      recipeId: nextRecipeId
    });
    recipeSheetVisible.value = false;
    recipeSelectedIds.value = [];
    await uniPlatform.feedback.toast({ title: "已放进我想吃池", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交我想吃失败", icon: "none" });
  } finally {
    recipeSubmitting.value = false;
  }
}

async function toggleWishSupport(item: WishEntry) {
  if (!eventDetail.value || !canChooseWish.value || wishActionLoadingId.value) return;
  wishActionLoadingId.value = item.id;
  try {
    eventDetail.value = await mealApi.updateDiningEventWishSupport(eventDetail.value.id, item.id, {
      operationId: createOperationId(),
      action: item.supportedByMe ? "UNSUPPORT" : "SUPPORT"
    });
    await uniPlatform.feedback.toast({
      title: item.supportedByMe ? (item.suggestedByMe ? "已撤下这道想吃" : "已取消附议") : "已附议",
      icon: "success"
    });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "我想吃操作失败", icon: "none" });
  } finally {
    wishActionLoadingId.value = null;
  }
}

async function addWishItemToMenu(item: WishEntry) {
  if (!eventDetail.value || !isEventOrganizer.value || item.inCurrentMenu || wishMenuLoadingId.value) return;
  wishMenuLoadingId.value = item.id;
  try {
    eventDetail.value = await mealApi.addDiningEventWishToMenu(eventDetail.value.id, item.id, createOperationId());
    await loadDetail();
    await uniPlatform.feedback.toast({ title: "已加入本次菜单", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入菜单失败", icon: "none" });
  } finally {
    wishMenuLoadingId.value = null;
  }
}

function syncEventMenusFromPlan(plan: MealPlanSummary) {
  if (!eventDetail.value) return;
  const currentItems = new Map(eventDetail.value.menuItems.map(item => [item.recipeVersionId, item] as const));
  let tempId = -1;
  eventDetail.value = {
    ...eventDetail.value,
    menuItems: plan.menuItems.map(item => {
      const existing = currentItems.get(item.recipeVersionId);
      if (existing) return existing;
      return {
        id: tempId--,
        recipeId: item.recipeId,
        recipeVersionId: item.recipeVersionId,
        title: item.title,
        version: 0
      };
    })
  };
}

async function handleCoverAction() {
  if (!eventDetail.value || !canUpdateCover.value || uploadingCover.value) return;

  try {
    const hadCover = Boolean(heroCoverUrl.value);
    const files = await uniPlatform.media.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
      sizeType: ["compressed"]
    });
    const filePath = files[0]?.path?.trim();
    if (!filePath) return;

    uploadingCover.value = true;
    const next = await mealApi.uploadDiningEventCover(eventDetail.value.id, {
      operationId: createOperationId(),
      expectedVersion: eventDetail.value.version,
      filePath
    });
    eventDetail.value = next;
    await uniPlatform.feedback.toast({ title: hadCover ? "封面已更新" : "封面已上传", icon: "success" });
  } catch (error) {
    const message =
      error && typeof error === "object" && "errMsg" in error ? String((error as { errMsg?: string }).errMsg || "") : "";
    if (message.includes("cancel")) return;
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "封面上传失败", icon: "none" });
  } finally {
    uploadingCover.value = false;
  }
}

async function loadCookAssistant(currentPlanItemId: UUID) {
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.getCookAssistant(currentPlanItemId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("计划不存在")) {
      cookAssistant.value = null;
      return;
    }
    if (!cookAssistant.value?.hasSnapshot) {
      cookAssistant.value = null;
    }
  } finally {
    cookAssistantLoading.value = false;
  }
}

async function handleCookAssistantAction() {
  if (!planDetail.value || cookAssistantLoading.value || submitting.value || eventClosed.value || planClosed.value) return;
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.generateCookAssistant(planDetail.value.id, {
      operationId: createOperationId()
    });
    await loadDetail();
    await uniPlatform.feedback.toast({ title: cookAssistant.value.isStale ? "已重新生成" : "已生成做饭安排", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "生成失败", icon: "none" });
  } finally {
    cookAssistantLoading.value = false;
  }
}

async function submitTitleUpdate() {
  if (!planDetail.value || !canEditTitle.value || submitting.value) return;
  submitting.value = true;
  try {
    planDetail.value = await mealApi.updatePlanTitle(planDetail.value.id, {
      operationId: createOperationId(),
      expectedVersion: planDetail.value.version,
      title: titleDraft.value
    });
    titleSheetVisible.value = false;
    await loadDetail();
    await uniPlatform.feedback.toast({ title: "标题已保存", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function submitEventNote() {
  if (!eventDetail.value || !canEditEventNote.value || submitting.value) return;
  submitting.value = true;
  try {
    eventDetail.value = await mealApi.updateDiningEventNote(eventDetail.value.id, {
      operationId: createOperationId(),
      expectedVersion: eventDetail.value.version,
      note: noteDraft.value.trim() || null
    });
    noteSheetVisible.value = false;
    await uniPlatform.feedback.toast({ title: eventDetail.value.note ? "备注已保存" : "备注已清空", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "备注保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function resolveMenuMeta(item: MenuEntry) {
  return item.servings ? `${item.servings}人份` : "";
}

function resolveMenuStatusText(item: MenuEntry) {
  if (eventDetail.value) return "主家菜单";
  return resolveMenuMeta(item) || "待安排";
}

function formatEventStatus(event: DiningEventSummary, currentMs = Date.now()) {
  if (isEventExpired(event, currentMs)) return "已结束";
  const { status } = event;
  if (status === "PLANNED") return "组织中";
  if (status === "CONFIRMED") return "已确认";
  if (status === "CANCELLED") return "已取消";
  return "已完成";
}

function resolveScheduledAtMs(value: string | null | undefined) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function resolvePlanDeadlineMs(dateText: string | null | undefined, mealSlot: MealSlot | null | undefined) {
  if (!dateText || !mealSlot) return 0;
  return resolveMealSlotExpireMs(dateText, mealSlot);
}

function shouldIgnorePlanLinkedEvent(plan: MealPlanSummary, event: DiningEventSummary) {
  if (event.planItemId !== plan.id) return true;
  const deadlineMs = resolvePlanDeadlineMs(plan.planDate, plan.mealSlot);
  if (deadlineMs > nowMs.value && isEventClosed(event, nowMs.value)) return true;
  return false;
}

function isEventExpired(event: DiningEventSummary, currentMs = Date.now()) {
  if (event.status === "CANCELLED" || event.status === "COMPLETED" || event.completedAt) return false;
  const scheduledAt = resolveScheduledAtMs(event.scheduledAt);
  return scheduledAt > 0 && scheduledAt <= currentMs;
}

function isEventClosed(event: DiningEventSummary, currentMs = Date.now()) {
  return event.status === "CANCELLED" || event.status === "COMPLETED" || Boolean(event.completedAt) || isEventExpired(event, currentMs);
}

function formatParticipantStatus(status: DiningEventSummary["participants"][number]["status"]) {
  if (status === "ACCEPTED") return "已接受";
  if (status === "DECLINED") return "已拒绝";
  if (status === "REMOVED") return "已移除";
  return "待回应";
}

function resolveDefaultTime(slot: MealSlot, dateText = todayText()) {
  return resolveMealSlotSuggestedTime(slot, dateText);
}

function composeScheduledAt(dateText: string, timeText: string) {
  const localDate = new Date(`${dateText}T${timeText}:00`);
  return localDate.toISOString();
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCountdown(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = `${Math.floor(totalSeconds / 3600)}`.padStart(2, "0");
  const minutes = `${Math.floor((totalSeconds % 3600) / 60)}`.padStart(2, "0");
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function startFooterTimer() {
  if (footerTimer) return;
  nowMs.value = Date.now();
  footerTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
}

function stopFooterTimer() {
  if (!footerTimer) return;
  clearInterval(footerTimer);
  footerTimer = null;
}

async function prepareInviteShareLink(silent = false) {
  if (!eventDetail.value || inviteSharing.value) return;
  inviteSharing.value = true;
  try {
    const result = await mealApi.createDiningEventShareLink(eventDetail.value.id, createOperationId());
    activeSharePath.value = result.shareTokenPath;
    eventDetail.value = {
      ...eventDetail.value,
      hasActiveShareLink: true,
      shareTokenPath: result.shareTokenPath
    };
    if (!silent) {
      await uniPlatform.feedback.toast({ title: "邀请已准备好，再点一次分享", icon: "none" });
    }
  } catch (error) {
    if (!silent) {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "好友邀请生成失败", icon: "none" });
    }
  } finally {
    inviteSharing.value = false;
  }
}

function handleInviteShare() {
  if (!eventDetail.value || inviteSharing.value || inviteShareReady.value) return;
  if (!canInviteParticipants.value) return;
  void prepareInviteShareLink();
}

function handleMenuDeadlineAction() {
  if (eventDetail.value) {
    openEventEditor();
    return;
  }
  if (canCreateEvent.value) {
    openEventEditor();
  }
}

function openTimePicker() {
  // no-op placeholder for click target; actual time picker is handled by the native picker wrapper
}

async function handleConfirmMenuAction() {
  if (!planDetail.value || !canManageMenu.value || submitting.value) return;
  submitting.value = true;
  try {
    planDetail.value = await mealApi.confirmPlanMenu(planDetail.value.id, {
      operationId: createOperationId(),
      expectedVersion: planDetail.value.version
    });
    if (eventDetail.value) {
      eventDetail.value = await mealApi.getDiningEvent(eventDetail.value.id);
    }
    await loadGapPreview();
    menuConfirmSheetVisible.value = false;
    await uniPlatform.feedback.toast({ title: "菜单已固定", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "确认菜单失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function loadGapPreview() {
  if (!sessionStore.isLoggedIn || !eventDetail.value || eventClosed.value || !currentMenuItems.value.length) {
    gapLoading.value = false;
    gapErrorText.value = "";
    gapData.value = null;
    return;
  }
  if (gapLoading.value) return;
  gapLoading.value = true;
  gapErrorText.value = "";
  try {
    gapData.value = await shoppingApi.previewGap();
  } catch (error) {
    gapErrorText.value = error instanceof Error ? error.message : "缺口暂时没刷新出来";
  } finally {
    gapLoading.value = false;
  }
}

function openMemory() {
  if (!eventId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(eventId.value))}`);
}

function buildShoppingDraftName() {
  if (!planDetail.value) {
    return buildDefaultShoppingListName();
  }
  return buildMealShoppingListName(
    formatMealSlot(planDetail.value.mealSlot),
    new Date(`${planDetail.value.planDate}T00:00:00`)
  );
}

function closeShoppingSheet() {
  shoppingSheetVisible.value = false;
}

function handleShoppingSheetAfterClose() {
  shoppingListError.value = "";
  shoppingCreateName.value = "";
}

async function loadShoppingLists(force = false) {
  if (shoppingListLoading.value && !force) return;
  shoppingListLoading.value = true;
  shoppingListError.value = "";
  try {
    const result = await shoppingApi.listLists("ACTIVE");
    shoppingLists.value = result.items;
    if (selectedShoppingListId.value && !shoppingLists.value.some(item => item.id === selectedShoppingListId.value)) {
      selectedShoppingListId.value = "";
    }
    if (!selectedShoppingListId.value) {
      selectedShoppingListId.value = shoppingLists.value[0]?.id || "";
    }
  } catch (error) {
    shoppingListError.value = error instanceof Error ? error.message : "清单加载失败";
  } finally {
    shoppingListLoading.value = false;
  }
}

function openLinkedShoppingList() {
  if (!linkedShoppingListId.value) return;
  void uniPlatform.navigation.navigateTo(buildShoppingListDetailPath(linkedShoppingListId.value));
}

async function openShoppingPage() {
  if ((!planDetail.value && !eventDetail.value) || planClosed.value || shoppingWriting.value) return;
  if (hasLinkedShoppingList.value) {
    openLinkedShoppingList();
    return;
  }
  if (eventDetail.value && gapLoading.value) return;
  if (!eventDetail.value && !currentPlanShoppingCount.value) {
    await uniPlatform.feedback.toast({ title: "这顿饭当前没有待采购的菜谱", icon: "none" });
    return;
  }
  await loadShoppingLists(true);
  if (!shoppingCreateName.value.trim()) {
    shoppingCreateName.value = buildShoppingDraftName();
  }
  shoppingSheetVisible.value = true;
}

async function createShoppingList() {
  if (shoppingWriting.value) return;
  shoppingWriting.value = true;
  try {
    const created = await shoppingApi.createList({
      operationId: createOperationId(),
      name: shoppingCreateName.value.trim() || buildShoppingDraftName()
    });
    await loadShoppingLists(true);
    selectedShoppingListId.value = created.id;
    shoppingCreateName.value = buildShoppingDraftName();
    await uniPlatform.feedback.toast({ title: "清单已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建清单失败", icon: "none" });
  } finally {
    shoppingWriting.value = false;
  }
}

async function confirmAddToShoppingList() {
  if ((!planDetail.value && !eventDetail.value) || !selectedShoppingListId.value || planClosed.value || shoppingWriting.value) return;
  if (eventDetail.value && gapLoading.value) return;
  shoppingWriting.value = true;
  try {
    const listId = selectedShoppingListId.value;
    if (eventDetail.value) {
      if (!gapData.value) {
        await loadGapPreview();
      }
      if (!currentEventGapItems.value.length) {
        throw new Error(gapErrorText.value || "当前这顿还没有可写入采购清单的缺口");
      }
      await shoppingApi.addEventToList(listId, {
        operationId: createOperationId(),
        eventId: eventDetail.value.id
      });
    } else {
      const currentPlan = planDetail.value;
      if (!currentPlanShoppingCount.value || !currentPlan) {
        throw new Error("这顿饭当前没有待采购的菜谱");
      }
      await shoppingApi.addPlanToList(listId, {
        operationId: createOperationId(),
        planItemId: currentPlan.id
      });
    }
    closeShoppingSheet();
    await uniPlatform.feedback.toast({ title: "已加入采购清单", icon: "success" });
    void uniPlatform.navigation.navigateTo(`/pages_pantry/list-detail/index?id=${encodeURIComponent(String(listId))}`);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入采购清单失败", icon: "none" });
  } finally {
    shoppingWriting.value = false;
  }
}

function goBack() {
  void uniPlatform.navigation.navigateBack().catch(() => {
    void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
  });
}

function handleScroll(event: { detail: { scrollTop?: number } }) {
  scrollTop.value = event.detail.scrollTop ?? 0;
}

function handleFooterAction(action: FooterActionKey) {
  if (action === "share-invite") {
    handleInviteShare();
    return;
  }
  if (action === "recipe") {
    openMenuSheet();
    return;
  }
  if (action === "wish") {
    openWishSheet();
    return;
  }
  if (action === "bring") {
    openBringSheet();
    return;
  }
  if (action === "create-event") {
    openEventEditor();
    return;
  }
  if (action === "confirm-menu") {
    if (eventDetail.value) {
      menuConfirmSheetVisible.value = true;
      return;
    }
    void handleConfirmMenuAction();
    return;
  }
  if (action === "shopping") {
    openShoppingPage();
    return;
  }
  if (action === "cook-assistant") {
    if (cookAssistant.value?.hasSnapshot && !cookAssistant.value.isStale) {
      openCookAssistantPage();
      return;
    }
    void handleCookAssistantAction();
    return;
  }
  if (action === "share-memory" || action === "view-memory") {
    openMemory();
  }
}

async function applyEntryFocus() {
  if (!entryFocus.value || (!planDetail.value && !eventDetail.value)) return;
  const requestedFocus = entryFocus.value;
  focusAttempt.value = {
    requested: requestedFocus,
    targetId: "",
    applied: false
  };
  await nextTick();

  if (requestedFocus === "footer") {
    focusAttempt.value = {
      requested: requestedFocus,
      targetId: "meal-footer-panel",
      applied: true
    };
    highlightSection("footer");
    entryFocus.value = "";
    return;
  }

  const targetId = resolveFocusTargetId(requestedFocus);
  focusAttempt.value = {
    requested: requestedFocus,
    targetId,
    applied: false
  };
  if (!targetId) {
    entryFocus.value = "";
    return;
  }

  scrollTarget.value = "";
  await nextTick();
  scrollTarget.value = targetId;
  highlightSection(requestedFocus);
  focusAttempt.value = {
    requested: requestedFocus,
    targetId,
    applied: true
  };
  setTimeout(() => {
    if (scrollTarget.value === targetId) {
      scrollTarget.value = "";
    }
  }, 320);
  entryFocus.value = "";
}

function resolveFocusTargetId(focus: RecentArrangementFocus) {
  return resolveRecentArrangementFocusTargetId(focus, {
    hasEventDetail: Boolean(eventDetail.value),
    hasPlanDetail: Boolean(planDetail.value),
    showShoppingPanel: showShoppingPanel.value
  });
}

function highlightSection(section: DetailFocus) {
  clearFocusedSection();
  focusedSection.value = section;
  focusResetTimer = setTimeout(() => {
    focusedSection.value = "";
    focusResetTimer = null;
  }, 1600);
}

function clearFocusedSection() {
  if (focusResetTimer) {
    clearTimeout(focusResetTimer);
    focusResetTimer = null;
  }
  focusedSection.value = "";
}
</script>

<style scoped lang="scss">
.meal-detail-page,
.meal-detail-scroll {
  height: 100%;
}

.meal-detail-page {
  display: flex;
  flex: 1;
  min-height: 0;
}

.meal-detail-empty {
  display: flex;
  min-height: 100%;
  padding: 24rpx;
  box-sizing: border-box;
}

.meal-detail-empty :deep(.empty-state--art) {
  width: 100%;
  margin-top: 0;
}

.detail-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  pointer-events: none;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
  transition: opacity 180ms ease;
}

.detail-nav {
  display: flex;
  align-items: center;
  gap: 18rpx;
  width: 100%;
}

.detail-nav__back {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  line-height: 1;
}

.detail-nav__back--hover {
  opacity: 0.68;
}

.detail-nav__title {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease;
}

.meal-detail-state {
  padding: 48rpx var(--space-page);
  color: var(--color-text-secondary);
}

.meal-detail-state--error {
  color: var(--color-state-danger-text);
}

.meal-detail-scroll {
  flex: 1;
  min-height: 0;
}

.meal-detail-body {
  min-height: 100%;
}

.meal-hero {
  position: relative;
  overflow: hidden;
  min-height: 360rpx;
  padding-right: 32rpx;
  padding-bottom: 112rpx;
  padding-left: 32rpx;
  border-bottom-right-radius: 42rpx;
  border-bottom-left-radius: 42rpx;
}

.meal-hero--plan {
  background: var(--color-cover-empty-warm-bg);
}

.meal-hero--event {
  height: 75vw;
  min-height: 420rpx;
  max-height: 660rpx;
  padding-right: 0;
  padding-bottom: 0;
  padding-left: 0;
  background: transparent;
}

.meal-hero--event::before,
.meal-hero--event::after {
  content: none;
}

.meal-hero__cover-field {
  display: block;
  height: 100%;
}

.meal-hero__cover-static {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.meal-hero__cover-image {
  display: block;
  width: 100%;
  height: 100%;
}

.meal-hero__cover-empty {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10rpx;
  padding: 36rpx;
  padding-top: calc(var(--hero-header-offset) + 24rpx);
  background: var(--page-cover-fresh-shell-bg);
  box-sizing: border-box;
}

.meal-hero__cover-empty-title,
.meal-hero__cover-empty-desc {
  display: block;
}

.meal-hero__cover-empty-title {
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.meal-hero__cover-empty-desc {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-hero::before {
  position: absolute;
  top: 56rpx;
  right: -56rpx;
  z-index: 1;
  width: 240rpx;
  height: 186rpx;
  border-radius: 50%;
  background: var(--color-surface-raised);
  content: "";
  pointer-events: none;
  transform: rotate(-18deg);
}

.meal-hero::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 160rpx;
  background: linear-gradient(180deg, transparent 0%, var(--color-page) 100%);
  content: "";
  pointer-events: none;
}

.meal-hero__eyebrow,
.meal-hero__title-row,
.meal-hero__meta,
.meal-hero__tags {
  position: relative;
  z-index: 2;
}

.meal-hero__eyebrow {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-hero__title-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.meal-hero__title-main {
  min-width: 0;
  flex: 1;
}

.meal-hero__title {
  display: block;
  min-width: 0;
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 52rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.12;
  transition: opacity 180ms ease;
}

.meal-hero__meta {
  display: block;
  position: relative;
  z-index: 2;
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.meal-hero__tags {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.meal-hero__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.meal-hero__tag--accent {
  background: var(--color-state-warning-soft);
  color: var(--color-state-warning-text);
}

.meal-hero__tag--done {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.meal-detail-content {
  position: relative;
  margin-top: -30rpx;
  padding: 116rpx var(--space-page) calc(200rpx + env(safe-area-inset-bottom));
  border-top-left-radius: 38rpx;
  border-top-right-radius: 38rpx;
  background: var(--color-surface-overlay-soft);
}

.meal-detail-content--plan-ended {
  padding-bottom: calc(50rpx + env(safe-area-inset-bottom));
}

.meal-detail-summary {
  position: relative;
  z-index: 11;
  margin-top: -132rpx;
}

.meal-detail-panel {
  position: sticky;
  z-index: 12;
  padding-bottom: 20rpx;
  margin-top: 18rpx;
}

.summary-card,
.store-card {
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.summary-card {
  padding: 28rpx 30rpx;
  background: var(--material-card-bg);
  box-shadow:
    var(--material-card-shadow),
    inset 0 0 0 1rpx var(--color-surface-muted-frost);
}

.summary-card__topline {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.summary-card__title-row {
  min-width: 0;
  display: flex;
  align-items: end;
  gap: 14rpx;
}

.summary-card__edit {
  flex: 0 0 auto;
  margin-top: 10rpx;
  color: var(--color-icon-active);
  font-size: 32rpx;
}

.summary-card__edit--disabled {
  opacity: 0.56;
}

.summary-card__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 50rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: opacity 180ms ease;
}

.summary-card__badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.summary-card__badge--planned {
  background: var(--color-tag-warning-bg);
  color: var(--color-tag-warning-text);
}

.summary-card__badge--confirmed,
.summary-card__badge--done {
  background: var(--color-tag-success-bg);
  color: var(--color-tag-success-text);
}

.summary-card__badge--cancelled {
  background: var(--color-tag-danger-bg);
  color: var(--color-tag-danger-text);
}

.summary-card__facts {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 24rpx;
  padding: 4rpx 0;
  border-radius: 24rpx;
  background: var(--color-surface-muted-frost);
}

.summary-card__fact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 88rpx;
  padding: 0 22rpx;
}

.summary-card__fact + .summary-card__fact {
  border-top: 1rpx solid var(--color-border-light);
}

.summary-card__fact-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.summary-card__fact-icon {
  flex: 0 0 auto;
  font-size: 30rpx;
  color: var(--color-icon-active);
}

.summary-card__fact-label {
  flex-shrink: 0;
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.5;
}

.summary-card__fact-value {
  display: block;
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1.5;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-card__avatars {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--color-border-light);
}

.summary-card__avatars-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.summary-card__avatars-title {
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.5;
}

.summary-card__avatars-action {
  flex: 0 0 auto;
}

.summary-card__avatars-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.summary-card__avatar-group {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
}

.summary-card__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
}

.summary-card__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.summary-card__avatar-fallback,
.summary-card__avatar-more {
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.summary-card__avatar-divider {
  flex: 0 0 auto;
  width: 1rpx;
  height: 38rpx;
  background: var(--color-border);
}

.summary-card__invite {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  border: 2rpx dashed var(--color-border-active);
  border-radius: 50%;
  background: var(--color-surface-primary-panel);
  box-sizing: border-box;
}

.summary-card__invite--disabled {
  opacity: 0.42;
}

.summary-card__invite::after {
  border: 0;
}

.summary-card__invite-icon {
  color: var(--color-icon-active);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.summary-card__avatar--more {
  background: var(--color-state-warning-soft);
  box-shadow: none;
}

.store-card {
  margin-top: 18rpx;
  padding: 28rpx 30rpx;
  background: var(--color-state-warning-card-bg);
  box-shadow: var(--material-card-shadow);
}

.store-card--event {
  background: var(--color-state-primary-card-bg);
  box-shadow: var(--material-card-shadow);
}

.store-card__head {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.store-card__main {
  min-width: 0;
  flex: 1;
}

.store-card__title {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.store-card__desc {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.store-card__aside {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.store-card__stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.store-card__stat-number {
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1;
}

.store-card__stat-label {
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.store-card__steps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 22rpx;
}

.store-card__step {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 76rpx;
  padding: 0 18rpx;
  border-radius: 20rpx;
  background: var(--color-surface-overlay-soft);
  color: var(--color-text-secondary);
}

.store-card__step--done {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.store-card__step--current {
  background: var(--color-state-warning-soft);
  color: var(--color-state-warning-text);
}

.store-card__step-dot {
  flex-shrink: 0;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: currentColor;
}

.store-card__step-text {
  min-width: 0;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.5;
}

.meal-panel {
  margin-top: 24rpx;
  padding: 32rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}

.meal-panel--focus {
  box-shadow:
    0 0 0 3rpx var(--color-border-active),
    var(--shadow-card);
  transform: translateY(-4rpx);
}

.meal-panel--warning {
  background: var(--color-state-warning-soft);
}

.meal-panel__head {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.meal-panel__head--row {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.meal-panel__head-main {
  min-width: 0;
  flex: 1;
}

.meal-panel__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
}

.meal-panel__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-panel__facts {
  margin-top: 24rpx;
}

.meal-memory-entry {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 20rpx;
}

.meal-memory-entry__title,
.meal-memory-entry__text {
  display: block;
}

.meal-memory-entry__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.meal-memory-entry__text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.meal-inline-action {
  flex-shrink: 0;
  padding: 14rpx 26rpx;
  border-radius: 999rpx;
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: 600;
}

.meal-inline-action--ghost {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-height: 72rpx;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--color-support-action);
}

.meal-inline-action--disabled {
  opacity: 0.56;
}

.meal-menu {
  display: flex;
  flex-direction: column;
  margin-top: 28rpx;
}

.meal-menu__row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
  min-height: 76rpx;
}

.meal-menu__row + .meal-menu__row {
  margin-top: 12rpx;
}

.meal-menu__name {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--color-text-tertiary);
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.5;
}

.meal-menu__name--link {
  color: var(--color-text-secondary);
}

.meal-menu__name--hover {
  opacity: 0.76;
}

.meal-menu__dash {
  flex: 1;
  min-width: 32rpx;
  border-bottom: 2rpx dashed var(--color-divider);
}

.meal-menu__status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 52rpx;
}

.meal-menu__status--action {
  cursor: pointer;
}

.meal-menu__status--pending {
  opacity: 0.56;
}

.meal-menu__status-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  text-align: right;
}

.meal-menu__status-text--action {
  color: var(--color-support-action);
  font-weight: 600;
}

.meal-menu__status-avatar {
  display: block;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
}

.meal-menu__status-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: 20rpx;
  font-weight: 700;
}

.meal-menu__add-action {
  flex: 0 0 auto;
  font-size: 24rpx;
  font-weight: 600;
}

.meal-menu__add-icon {
  font-size: 22rpx;
  line-height: 1;
}

.meal-menu-empty {
  margin-top: 28rpx;
  padding: 28rpx 26rpx;
  border-radius: 24rpx;
  background: var(--color-support-notice);
}

.meal-menu-empty__title {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.meal-menu-empty__text {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.meal-menu-empty__action {
  margin-top: 20rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  padding: 0 26rpx;
  border-radius: 999rpx;
  background: var(--color-state-warning-soft);
  color: var(--color-state-warning-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.meal-menu-empty__action--hover {
  opacity: 0.92;
}

.wish-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 28rpx;
}

.wish-list__row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: var(--color-surface-primary-panel-soft);
}

.wish-list__main {
  min-width: 0;
  flex: 1;
}

.wish-list__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10rpx;
}

.wish-list__title {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.wish-list__tag,
.wish-list__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;
}

.wish-list__tag {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.wish-list__count {
  background: var(--color-support-notice);
  color: var(--color-text-secondary);
}

.wish-list__meta {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.wish-list__action {
  flex: 0 0 auto;
  min-width: 164rpx;
  min-height: 72rpx;
  padding: 0 22rpx;
  border: none;
  border-radius: 999rpx;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 72rpx;
}

.wish-list__action::after {
  border: none;
}

.wish-list__action--ghost {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
}

.wish-list__action--disabled {
  opacity: 0.48;
}

.bring-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 28rpx;
}

.bring-list__row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.bring-list__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-tag-primary-bg);
  flex: 0 0 auto;
}

.bring-list__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.bring-list__avatar-fallback {
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: 700;
}

.bring-list__main {
  min-width: 0;
  flex: 1;
}

.bring-list__name,
.bring-list__dish,
.bring-list__badge {
  display: block;
}

.bring-list__name {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.bring-list__dish {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.bring-list__badge {
  flex: 0 0 auto;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: 20rpx;
  font-weight: 700;
}

.meal-helper-banner {
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: var(--color-state-warning-soft);
}

.meal-helper-banner__title {
  display: block;
  color: var(--color-state-warning-text);
  font-size: 24rpx;
  font-weight: 600;
}

.meal-helper-banner__text {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.meal-helper-state {
  margin-top: 24rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.meal-helper {
  margin-top: 24rpx;
}

.meal-helper__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.meal-helper__summary-item {
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: var(--color-support-notice);
}

.meal-helper__summary-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.meal-helper__summary-value {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.5;
}

.meal-helper__actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 24rpx;
}

.meal-helper__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 84rpx;
  padding: 0 24rpx;
  margin: 0;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1;
  box-sizing: border-box;
}

.meal-helper__button::after {
  border: none;
}

.meal-helper__button--primary {
  color: var(--color-text-inverse);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
}

.meal-helper__button--main {
  flex: 0 1 70%;
}

.meal-helper__text-action {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.participant-list {
  margin-top: 20rpx;
}

.participant-row {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}

.participant-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.participant-empty {
  margin-top: 20rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.recipe-sheet__tip,
.recipe-sheet__state,
.recipe-sheet__empty-title,
.recipe-sheet__empty-text,
.recipe-sheet__name,
.recipe-sheet__meta,
.recipe-sheet__status-text {
  display: block;
}

.recipe-sheet {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  min-height: 0;
}

.recipe-sheet__tip {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.recipe-sheet__tip-link {
  color: var(--color-support-action);
  font-weight: 600;
}

.recipe-sheet__state {
  padding: 8rpx 6rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.recipe-sheet__state--error {
  color: var(--color-state-danger-text);
}

.recipe-sheet__scroll {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 720rpx;
}

.recipe-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-right: 2rpx;
}

.recipe-sheet__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid transparent;
  border-radius: 24rpx;
  background: var(--color-surface-muted-frost);
}

.recipe-sheet__row--pending-add {
  border-color: var(--color-border-active);
  background: var(--color-support-notice);
}

.recipe-sheet__row--selected {
  border-color: var(--color-border-active);
}

.recipe-sheet__row--pending-remove {
  border-color: var(--color-state-danger-border);
  background: var(--color-state-danger-soft);
}

.recipe-sheet__row--submitting {
  opacity: 0.52;
}

.recipe-sheet__cover {
  flex: 0 0 112rpx;
  width: 112rpx;
  height: 112rpx;
  overflow: hidden;
  border-radius: 24rpx;
  background: var(--color-support-info);
}

.recipe-sheet__cover-image,
.recipe-sheet__cover-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
}

.recipe-sheet__cover-image {
  display: block;
}

.recipe-sheet__cover-placeholder {
  align-items: center;
  justify-content: center;
}

.recipe-sheet__cover-icon {
  color: var(--color-icon-active);
  font-size: 34rpx;
}

.recipe-sheet__main {
  min-width: 0;
  flex: 1;
}

.recipe-sheet__name {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.recipe-sheet__meta,
.recipe-sheet__empty-text {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-sheet__status {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 116rpx;
  min-height: 54rpx;
  padding: 0 18rpx;
  border: 1rpx solid var(--color-border-light);
  border-radius: 999rpx;
  background: var(--color-surface-overlay-weak);
  box-sizing: border-box;
}

.recipe-sheet__status--pending-add {
  border-color: var(--color-border-active);
  background: var(--color-tag-primary-bg);
}

.recipe-sheet__status--selected {
  border-color: var(--color-border-active);
  background: var(--color-tag-primary-bg);
}

.recipe-sheet__status--added {
  border-color: transparent;
  background: var(--color-support-notice);
}

.recipe-sheet__status--pending-remove {
  border-color: transparent;
  background: var(--color-tag-danger-bg);
}

.recipe-sheet__status-text {
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: 700;
}

.event-note {
  padding: 24rpx 28rpx;
  margin-top: 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.event-note__text {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.7;
  white-space: pre-wrap;
}

.recipe-sheet__status--added .recipe-sheet__status-text {
  color: var(--color-tag-primary-text);
}

.recipe-sheet__status--pending-remove .recipe-sheet__status-text {
  color: var(--color-tag-danger-text);
}

.sheet-section {
  margin-top: 24rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin-bottom: 14rpx;
}

.sheet-input,
.schedule-sheet__time {
  width: 100%;
  min-height: 88rpx;
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.sheet-input {
  display: block;
}

.recipe-sheet__empty {
  padding: 8rpx 6rpx 10rpx;
}

.recipe-sheet__empty-title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.share-card {
  padding: 24rpx;
}

.share-card__label,
.share-card__hint,
.share-member__name,
.share-member__meta,
.share-member__check {
  display: block;
}

.share-card__label {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.share-card__hint {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.share-member-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.share-member {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.share-member--active {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
}

.share-member__avatar,
.share-member__check {
  flex: 0 0 auto;
}

.share-member__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--radius-pill);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.share-member__main {
  flex: 1;
  min-width: 0;
}

.share-member__name {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.share-member__meta,
.share-member__check {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.share-member__meta {
  margin-top: 6rpx;
}

.share-member--active .share-member__check {
  color: var(--color-support-action);
  font-weight: var(--font-weight-semibold);
}

.sheet-note {
  margin-top: 20rpx;
}

.sheet-note--error {
  color: var(--color-state-danger-text);
}

.participant-row__name {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.participant-row__meta {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet-actions {
  display: flex;
  gap: 18rpx;
}

.sheet-actions__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 86rpx;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  text-align: center;
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.menu-confirm__item {
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-state-warning-soft);
}

.menu-confirm__item-name {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.menu-confirm__item-meta,
.menu-confirm__item-recipes {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.menu-confirm__item-meta,
.menu-confirm__item-recipes {
  margin-top: 8rpx;
}

.menu-confirm__list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.menu-confirm__item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.menu-confirm__item-meta {
  margin-top: 0;
  white-space: nowrap;
}

.field-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.field-actions__button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.field-actions__button--ghost {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
}

.field-actions__button--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.meal-menu__head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14rpx 22rpx;
}

.meal-menu__deadline-action {
  color: var(--color-support-action);
}

.meal-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  padding: 18rpx var(--space-page) calc(18rpx + env(safe-area-inset-bottom));
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
  box-sizing: border-box;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}

.meal-footer--focus {
  box-shadow:
    0 0 0 3rpx var(--color-border-active),
    var(--shadow-floating);
  transform: translateY(-4rpx);
}

.meal-footer__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 0 8rpx;
}

.meal-footer__countdown {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
  flex-wrap: nowrap;
}

.meal-footer__countdown-prefix,
.meal-footer__countdown-unit,
.meal-footer__countdown-separator,
.meal-footer__countdown-suffix {
  display: block;
  flex: 0 0 auto;
  font-size: 22rpx;
  line-height: 1.5;
}

.meal-footer__countdown-prefix,
.meal-footer__countdown-unit,
.meal-footer__countdown-suffix {
  color: var(--color-text-secondary);
}

.meal-footer__countdown-separator {
  color: var(--color-text);
  font-weight: 700;
}

.meal-footer__countdown-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 8rpx;
  border-radius: 10rpx;
  background: var(--color-tag-danger-bg);
  color: var(--color-tag-danger-text);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1;
  box-sizing: border-box;
}

.meal-footer__join {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  padding-left: 14rpx;
}

.meal-footer__join-label,
.meal-footer__join-value {
  display: block;
  line-height: 1.5;
}

.meal-footer__join-label {
  color: var(--color-state-warning-text);
  font-size: 22rpx;
}

.meal-footer__join-value {
  color: var(--color-state-warning-text);
  font-size: 24rpx;
  font-weight: 700;
}

.meal-footer__status-main {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.meal-footer__status-icon {
  flex: 0 0 auto;
  font-size: 24rpx;
  color: var(--color-icon-active);
}

.meal-footer__status-text,
.meal-footer__status-meta {
  display: block;
  font-size: 22rpx;
  line-height: 1.5;
}

.meal-footer__status-text {
  min-width: 0;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meal-footer__status-meta {
  flex: 0 0 auto;
  color: var(--color-state-warning-text);
  font-weight: 600;
}

.meal-footer__actions {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 16rpx;
  padding: 0;
}

.meal-footer__actions--ended {
  margin-top: 0;
}

.meal-footer__quick {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-width: 86rpx;
}

.meal-footer__quick--button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.meal-footer__quick--button::after {
  border: 0;
}

.meal-footer__quick--disabled {
  opacity: 0.42;
}

.meal-footer__quick-icon {
  font-size: 30rpx;
  color: var(--color-text);
}

.meal-footer__quick-label {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.meal-footer__buttons {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 14rpx;
}

.meal-footer__buttons--single .meal-footer__button {
  width: 100%;
  flex: 1 1 100%;
}

.meal-footer__memory {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  width: 100%;
  min-height: 84rpx;
  padding: 0 24rpx;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  box-sizing: border-box;
}

.meal-footer__memory::after {
  border: 0;
}

.meal-footer__memory-icon {
  color: inherit;
  font-size: 28rpx;
  line-height: 1;
}

.meal-footer__memory-label {
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.meal-footer__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  margin: 0;
  padding: 0 28rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  box-sizing: border-box;
}

.meal-footer__button::after {
  border: none;
}

.meal-footer__button--ghost {
  color: var(--button-secondary-text);
  background: var(--button-secondary-bg);
}

.meal-footer__button--primary {
  color: var(--button-primary-text);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
}

.meal-footer__button-content {
  line-height: 1;
}

.meal-footer__button-badge {
  margin-left: 10rpx;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: var(--color-surface-mask-weak);
  font-size: 22rpx;
  line-height: 1;
}
</style>
