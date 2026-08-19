<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    title=""
    full-screen
    :show-left="false"
    navbar-layout="custom-left"
    :navbar-transparent="true"
    :navbar-placeholder="false"
  >
    <template #navbar-left>
      <view class="detail-nav">
        <view class="cookfont icon-back detail-nav__back" hover-class="detail-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <text class="detail-nav__title" :style="navTitleStyle">{{ navTitle }}</text>
      </view>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看餐次详情"
      description="安排这顿饭、继续发起饭局和查看参与情况，都需要登录后处理。"
    />

    <view v-else class="meal-detail-page">
      <view class="detail-nav-backdrop" :style="navBackdropStyle" />
      <view v-if="loading && !planDetail" class="meal-detail-state">加载中...</view>
      <view v-else-if="errorText && !planDetail" class="meal-detail-state meal-detail-state--error" @click="loadDetail">
        {{ errorText }}
      </view>
      <view v-else-if="!planDetail" class="meal-detail-empty">
        <Empty title="未找到这条安排" description="可能已被删除，或当前日期范围里暂无这条餐次安排。" />
      </view>

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
                        <view
                          v-if="canInviteParticipants"
                          class="summary-card__invite"
                          :class="{ 'summary-card__invite--disabled': !canInviteParticipants || inviteSharing }"
                          @click="handleInviteShare"
                        >
                          <text class="cookfont icon-add summary-card__invite-icon" />
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="eventErrorText && !eventDetail" class="meal-panel meal-panel--warning" @click="loadDetail">
                <text class="meal-panel__title">饭局信息暂时加载失败</text>
                <text class="meal-panel__meta">{{ eventErrorText }}</text>
              </view>

              <view v-if="planDetail" id="meal-menu-panel" class="meal-panel">
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
                      <text>添加</text>
                    </view>
                    <view
                      v-else-if="canChooseBring"
                      class="meal-inline-action meal-inline-action--ghost meal-menu__add-action"
                      @click="openBringSheet"
                    >
                      <text class="cookfont icon-add meal-menu__add-icon" />
                      <text>我带菜</text>
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
                      <image
                        v-if="eventDetail && organizerAvatarItem?.avatarUrl"
                        class="meal-menu__status-avatar"
                        :src="organizerAvatarItem.avatarUrl"
                        mode="aspectFill"
                      />
                      <text v-else-if="eventDetail && organizerAvatarItem" class="meal-menu__status-fallback">{{ organizerAvatarItem.fallback }}</text>
                      <text v-else class="meal-menu__status-text">{{ resolveMenuMeta(item) }}</text>
                    </view>
                  </view>
                </view>

                <view v-else class="meal-menu-empty">
                  <text class="meal-menu-empty__title">菜单待补</text>
                  <text class="meal-menu-empty__text">
                    {{ menuPanelEmptyText }}
                  </text>
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

              <view v-if="planDetail" class="meal-panel">
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
                    <button class="meal-helper__button meal-helper__button--ghost" @click="openCookAssistantPage">查看做饭建议</button>
                    <button class="meal-helper__button meal-helper__button--primary" @click="openCookMode">按建议开始做饭</button>
                  </template>
                  <template v-else-if="cookAssistant?.isStale">
                    <button
                      class="meal-helper__button meal-helper__button--primary"
                      :disabled="cookAssistantLoading || submitting"
                      @click="handleCookAssistantAction"
                    >
                      重新生成建议
                    </button>
                    <button class="meal-helper__button meal-helper__button--ghost" @click="openCookMode">直接开始做饭</button>
                  </template>
                  <template v-else>
                    <button
                      class="meal-helper__button meal-helper__button--primary"
                      :disabled="cookAssistantLoading || submitting"
                      @click="handleCookAssistantAction"
                    >
                      生成做饭建议
                    </button>
                    <button class="meal-helper__button meal-helper__button--ghost" @click="openCookMode">直接开始做饭</button>
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
            </view>
          </view>
        </scroll-view>

        <view v-if="footerVisible" class="meal-footer">
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
              v-if="footerQuickAction"
              class="meal-footer__quick"
              :class="{ 'meal-footer__quick--disabled': footerQuickAction.disabled }"
              @click="handleFooterAction(footerQuickAction.key)"
            >
              <text class="cookfont meal-footer__quick-icon" :class="footerQuickAction.iconClass" />
              <text class="meal-footer__quick-label">{{ footerQuickAction.label }}</text>
            </view>

            <view class="meal-footer__buttons">
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
                {{ footerPrimaryAction.label }}
              </button>
            </view>
          </view>
        </view>

        <SheetShell
          :visible="participantSheetVisible"
          title="参与人管理"
          subtitle="这里会收口当前参与、待确认和已婉拒的邀请。"
          @close="closeParticipantSheet"
        >
          <view class="participant-sheet">
            <view class="participant-sheet__section">
              <text class="participant-sheet__title">当前参与</text>
              <view class="participant-sheet__list">
                <view
                  v-for="item in participantCurrentItems"
                  :key="item.key"
                  class="participant-sheet__row"
                  :class="{ 'participant-sheet__row--dimmed': item.dimmed }"
                >
                  <view class="participant-sheet__avatar">
                    <image v-if="item.avatarUrl" class="participant-sheet__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
                    <text v-else class="participant-sheet__avatar-fallback">{{ buildAvatarFallback(item.name) }}</text>
                  </view>
                  <view class="participant-sheet__main">
                    <text class="participant-sheet__name">{{ item.name }}</text>
                    <text class="participant-sheet__meta">{{ item.statusText }}</text>
                  </view>
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
            </view>

            <view v-if="participantPendingItems.length" class="participant-sheet__section">
              <text class="participant-sheet__title">待确认</text>
              <view class="participant-sheet__list">
                <view
                  v-for="item in participantPendingItems"
                  :key="item.key"
                  class="participant-sheet__row"
                  :class="{ 'participant-sheet__row--dimmed': item.dimmed }"
                >
                  <view class="participant-sheet__avatar">
                    <image v-if="item.avatarUrl" class="participant-sheet__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
                    <text v-else class="participant-sheet__avatar-fallback">{{ buildAvatarFallback(item.name) }}</text>
                  </view>
                  <view class="participant-sheet__main">
                    <text class="participant-sheet__name">{{ item.name }}</text>
                    <text class="participant-sheet__meta">{{ item.statusText }}</text>
                  </view>
                  <button
                    class="participant-sheet__action"
                    :disabled="submitting || participantActionId === item.participantId"
                    @click="revokeParticipantInvite(item)"
                  >
                    {{ participantActionId === item.participantId ? "处理中..." : "撤回" }}
                  </button>
                </view>
              </view>
            </view>

            <view v-if="participantDeclinedItems.length" class="participant-sheet__section">
              <text class="participant-sheet__title">已婉拒</text>
              <view class="participant-sheet__list">
                <view
                  v-for="item in participantDeclinedItems"
                  :key="item.key"
                  class="participant-sheet__row"
                >
                  <view class="participant-sheet__avatar">
                    <image v-if="item.avatarUrl" class="participant-sheet__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
                    <text v-else class="participant-sheet__avatar-fallback">{{ buildAvatarFallback(item.name) }}</text>
                  </view>
                  <view class="participant-sheet__main">
                    <text class="participant-sheet__name">{{ item.name }}</text>
                    <text class="participant-sheet__meta">{{ item.statusText }}</text>
                  </view>
                  <button
                    class="participant-sheet__action participant-sheet__action--primary"
                    :disabled="submitting || participantActionId === item.participantId"
                    @click="reinviteParticipant(item)"
                  >
                    {{ participantActionId === item.participantId ? "处理中..." : "再邀" }}
                  </button>
                </view>
              </view>
            </view>

            <view v-if="canInviteParticipants" class="participant-sheet__section">
              <text class="participant-sheet__title">邀请入口</text>
              <view
                class="participant-sheet__invite"
                :class="{ 'participant-sheet__invite--disabled': !canInviteParticipants || inviteSharing }"
                @click="handleInviteShare"
              >
                <text class="cookfont icon-share participant-sheet__invite-icon" />
                <text class="participant-sheet__invite-text">分享邀请</text>
              </view>
            </view>
          </view>
        </SheetShell>

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
                      {{ item.category.name }}<text v-if="item.durationText"> · {{ item.durationText }}</text>
                    </text>
                  </view>
                  <view
                    class="recipe-sheet__status"
                    :class="{
                      'recipe-sheet__status--pending-add': isRecipePendingAdd(item),
                      'recipe-sheet__status--added': isRecipeAdded(item) && !isRecipePendingRemove(item),
                      'recipe-sheet__status--pending-remove': isRecipePendingRemove(item),
                      'recipe-sheet__status--selected': recipeSheetMode === 'bring' && isRecipeSelected(item) && !isRecipeAdded(item)
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

        <SheetShell
          :visible="titleSheetVisible"
          title="修改标题"
          subtitle="留空会恢复成默认的餐次饮食计划名。"
          @close="closeTitleSheet"
          @after-close="handleTitleSheetAfterClose"
        >
          <view class="sheet-section">
            <input
              v-model="titleDraft"
              class="sheet-input title-sheet__input"
              maxlength="40"
              placeholder="例如：周末家宴"
              placeholder-class="sheet-input__placeholder"
            />
          </view>

          <template #footer>
            <view class="sheet-actions">
              <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeTitleSheet">取消</button>
              <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting" @click="submitTitleUpdate">
                {{ submitting ? "保存中..." : "保存标题" }}
              </button>
            </view>
          </template>
        </SheetShell>

        <SheetShell
          :visible="noteSheetVisible"
          title="饭局备注"
          subtitle="写给参与人的公开说明，比如到场提醒、饮食禁忌或临时安排。"
          @close="closeNoteSheet"
          @after-close="handleNoteSheetAfterClose"
        >
          <view class="sheet-section">
            <textarea
              v-model="noteDraft"
              class="sheet-input note-sheet__input"
              maxlength="255"
              placeholder="例如：有人花生过敏，今晚不要带含花生的凉菜"
              placeholder-class="sheet-input__placeholder"
            />
          </view>

          <template #footer>
            <view class="sheet-actions">
              <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeNoteSheet">取消</button>
              <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting" @click="submitEventNote">
                {{ submitting ? "保存中..." : "保存备注" }}
              </button>
            </view>
          </template>
        </SheetShell>

        <SheetShell
          :visible="showEventEditor"
          :title="eventDetail ? '修改时间' : '发起饭局'"
          subtitle="先把时间定下来，菜单后面仍在这个餐次详情里继续补。"
          @close="closeEventEditor"
        >
          <view class="schedule-sheet">
            <view class="sheet-section">
              <MealMonthCalendar
                :selected-date="scheduledDate"
                :month-date="scheduleMonthDate"
                :min-date="scheduleMinDate"
                @select="handleScheduleDateSelect"
                @month-change="handleScheduleMonthChange"
              />
            </view>

            <view class="sheet-section">
              <picker mode="time" :value="scheduledTime" @change="handleTimeChange">
                <view class="schedule-sheet__time">
                  <text class="cookfont icon-time schedule-sheet__time-icon" />
                  <text class="schedule-sheet__time-text">{{ scheduledTime }}</text>
                </view>
              </picker>
            </view>
          </view>

          <template #footer>
            <view class="sheet-actions">
              <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeEventEditor">
                {{ eventDetail ? "先不改" : "先不发起" }}
              </button>
              <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting" @click="createEvent">
                {{ submitting ? (eventDetail ? "保存中..." : "创建中...") : eventDetail ? "保存时间" : "确认发起饭局" }}
              </button>
            </view>
          </template>
        </SheetShell>

        <InviteShareSheet
          :visible="shareSheetVisible"
          title="分享邀请"
          :subtitle="shareSheetSubtitle"
          single-share
          :friend-action="inviteFriendAction"
          :error-text="shareLinkError"
          @close="closeShareSheet"
          @after-close="handleShareSheetAfterClose"
          @friend="handleShareFriendClick"
        />
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onHide, onLoad, onShareAppMessage, onShow, onUnload } from "@dcloudio/uni-app";
import { mealApi, type DiningEventSummary, type MealPlanCookAssistant, type MealPlanSummary } from "../apis/meal";
import type { UUID } from "@/apis/http";
import { recipeApi, type MyRecipeSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Login from "@/components/Login/Login.vue";
import Layout from "@/components/Layout/Layout.vue";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import InviteShareSheet from "@/components/Share/InviteShareSheet.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import ImageField from "@/components/ImageField.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { formatMealSlot, mealSlotDefaultTime } from "@/utils/meal-slot";
import { formatDateTimeMinute } from "../utils/date";

type MealSlot = MealPlanSummary["mealSlot"];
type MenuEntry = {
  key: string;
  title: string;
  recipeId: UUID | null;
  menuItemId: UUID | null;
  version: number | null;
  cookUserUid: number | null;
  cookName: string | null;
  servings: number | null;
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
  | "bring"
  | "create-event"
  | "confirm-menu"
  | "cook-assistant"
  | "share-memory"
  | "view-memory";
type FooterAction = {
  key: FooterActionKey;
  label: string;
  iconClass?: string;
  disabled?: boolean;
};
type RecipeSheetItem = MyRecipeSummary;
type RecipeSheetMode = "menu" | "bring";
const RECIPE_HOME_INTENT_STORAGE_KEY = "recipe-home-intent-tab";

const NAV_FADE_DISTANCE = 132;
const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const { navBarTotalHeight } = useSystemInfo();
const loading = ref(false);
const submitting = ref(false);
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
const uploadingCover = ref(false);
const participantSheetVisible = ref(false);
const participantActionId = ref<UUID | null>(null);
const inviteSharing = ref(false);
const shareSheetVisible = ref(false);
const shareLinkError = ref("");
const activeSharePath = ref("");
const recipeSheetVisible = ref(false);
const recipeSheetMode = ref<RecipeSheetMode>("menu");
const recipeSheetLoading = ref(false);
const recipeSheetError = ref("");
const recipeSheetItems = ref<RecipeSheetItem[]>([]);
const recipeSelectedIds = ref<UUID[]>([]);
const recipeSubmitting = ref(false);
const claimingMenuItemId = ref<UUID | null>(null);
const titleSheetVisible = ref(false);
const titleDraft = ref("");
const noteSheetVisible = ref(false);
const noteDraft = ref("");
const scheduleMonthDate = ref(todayText());
const nowMs = ref(Date.now());
let footerTimer: ReturnType<typeof setInterval> | null = null;
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
const planDeadlineMs = computed(() => {
  if (!planDetail.value) return 0;
  return resolvePlanDeadlineMs(planDetail.value.planDate, planDetail.value.mealSlot);
});
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
      menuItemId: item.id,
      version: item.version,
      cookUserUid: item.cookUserUid,
      cookName: item.cookName,
      servings: null
    }));
  }

  return (planDetail.value?.menuItems ?? []).map(item => ({
    key: `plan-${item.recipeVersionId}`,
    title: item.title,
    recipeId: item.recipeId,
    menuItemId: null,
    version: null,
    cookUserUid: null,
    cookName: null,
    servings: item.servings
  }));
});
const addedRecipeIds = computed(() => new Set(currentMenuItems.value.map(item => item.recipeId).filter((value): value is UUID => value !== null)));
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
      return canQuickShareInvite.value ? { key: "share-invite", label: "快捷分享", iconClass: "icon-share" } : null;
    }
    return canCreateEvent.value ? { key: "create-event", label: "发起饭局", iconClass: "icon-share" } : null;
  }
  if (footerStage.value === "READY_TO_START" && eventDetail.value) {
    return canQuickShareInvite.value ? { key: "share-invite", label: "快捷分享", iconClass: "icon-share", disabled: inviteSharing.value } : null;
  }
  if (footerStage.value === "READY_TO_START" && !eventDetail.value) {
    return canCreateEvent.value ? { key: "create-event", label: "发起饭局", iconClass: "icon-share" } : null;
  }
  return null;
});
const footerSecondaryAction = computed<FooterAction | null>(() => {
  if (footerStage.value === "MENU_EDITING" && canManageMenu.value) return { key: "recipe", label: "添加菜单" };
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
    return canChooseBring.value ? { key: "bring", label: "我带菜" } : null;
  }
  if (footerStage.value === "READY_TO_START") {
    if (isEventOrganizer.value || !eventDetail.value) {
      return currentMenuItems.value.length ? { key: "cook-assistant", label: "做饭助手" } : null;
    }
    return canChooseBring.value ? { key: "bring", label: "我带菜" } : null;
  }
  return null;
});
const shareSheetSubtitle = computed(() => (
  "会在你打开这里时先准备好当前这条好友邀请，方便直接转发。"
));
const shareHeadline = computed(() => eventDetail.value?.title?.trim() || detailTitle.value);
const inviteFriendAction = computed(() => ({
  label: inviteSharing.value ? "准备好友邀请中..." : "分享给好友",
  hint: inviteSharing.value
    ? "正在准备当前这条好友邀请，请稍候。"
    : activeSharePath.value
      ? "会使用当前已准备好的好友邀请，直接转发给朋友。"
      : canInviteParticipants.value
        ? "会生成一条可直接转发给好友的饭局邀请。"
        : "请先让发起人准备好友邀请，再回来直接转发。",
  disabled: inviteSharing.value || (!activeSharePath.value && !canInviteParticipants.value),
  openType: activeSharePath.value && !inviteSharing.value ? "share" : ""
}));
const recipePendingAddCount = computed(() => {
  if (recipeSheetMode.value === "bring") {
    if (!recipeSelectedIds.value.length) return 0;
    return recipeSelectedIds.value[0] === currentBringRecipeId.value ? 0 : 1;
  }
  return recipeSelectedIds.value.filter(id => !addedRecipeIds.value.has(id)).length;
});
const recipePendingRemoveCount = computed(() => {
  if (recipeSheetMode.value === "bring") return 0;
  return recipeSelectedIds.value.filter(id => addedRecipeIds.value.has(id)).length;
});
const recipeConfirmDisabled = computed(() => {
  if (recipeSubmitting.value) return true;
  if (recipeSheetMode.value === "bring") return recipePendingAddCount.value === 0;
  return !recipePendingAddCount.value && !recipePendingRemoveCount.value;
});
const recipeSheetTitle = computed(() => (recipeSheetMode.value === "bring" ? "我带菜" : "添加菜单"));
const recipeSheetSubtitle = computed(() => (
  recipeSheetMode.value === "bring"
    ? "从我的菜谱里选一道准备带去的菜，单独记在带菜区里。"
    : "先从我的菜谱里勾选要加进来的菜单。"
));
const recipeSheetTipText = computed(() => (
  recipeSheetMode.value === "bring" ? "这里只显示我的菜谱；带去的菜不会并进主家的菜单和购物清单。" : ""
));
const recipeSheetEmptyTitle = computed(() => (recipeSheetMode.value === "bring" ? "还没有可带的菜谱" : "还没有我的菜谱"));
const recipeSheetEmptyText = computed(() => (
  recipeSheetMode.value === "bring"
    ? "先准备一道自己的拿手菜，再回来登记这场饭局的带菜安排。"
    : "先去灵感广场看看，看到满意的再回来安排这顿饭。"
));
const recipeConfirmButtonText = computed(() => {
  if (recipeSubmitting.value) return "保存中...";
  if (recipeSheetMode.value === "bring") {
    return currentBringRecipeId.value ? "更新我带菜" : "确认我带菜";
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

onLoad(query => {
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  eventId.value = parseQueryId(query?.eventId);
  showEventEditor.value = parseQueryText(query?.mode) === "create-event";
});

onShareAppMessage(() => {
  shareSheetVisible.value = false;
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
  if (!planItemId.value || !planDate.value || loading.value) return;

  loading.value = true;
  errorText.value = "";
  eventErrorText.value = "";
  try {
    const result = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
    const nextPlan = result.items.find(item => item.id === planItemId.value) ?? null;
    planDetail.value = nextPlan;
    if (!nextPlan) {
      errorText.value = "这条餐次暂时找不到了，点此重试";
      eventDetail.value = null;
      activeSharePath.value = "";
      cookAssistant.value = null;
      return;
    }

    resetEventDraft(nextPlan);
    await loadCookAssistant(nextPlan.id);
    const targetEventId = eventId.value || nextPlan.diningEventId;
    if (!targetEventId) {
      eventDetail.value = null;
      activeSharePath.value = "";
      return;
    }

    try {
      eventDetail.value = await mealApi.getDiningEvent(targetEventId);
      eventId.value = eventDetail.value.id;
      activeSharePath.value = eventDetail.value.shareTokenPath || "";
      showEventEditor.value = false;
    } catch (error) {
      eventDetail.value = null;
      activeSharePath.value = "";
      eventErrorText.value = "饭局信息暂时没同步出来，点此重试";
    }
  } catch (error) {
    errorText.value = "餐次暂时没加载出来，点此重试";
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
  planDetail.value = null;
  eventDetail.value = null;
  cookAssistant.value = null;
  cookAssistantLoading.value = false;
  showEventEditor.value = false;
  shareSheetVisible.value = false;
  participantActionId.value = null;
  shareLinkError.value = "";
  activeSharePath.value = "";
  recipeSheetVisible.value = false;
  recipeSheetMode.value = "menu";
  recipeSheetError.value = "";
  recipeSelectedIds.value = [];
  recipeSubmitting.value = false;
  noteSheetVisible.value = false;
  noteDraft.value = "";
}

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
  scheduledTime.value = resolveDefaultTime(plan.mealSlot);
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
  return addedRecipeIds.value.has(item.id);
}

function isRecipeSelected(item: RecipeSheetItem) {
  return selectedRecipeIdSet.value.has(item.id);
}

function isRecipePendingAdd(item: RecipeSheetItem) {
  if (recipeSheetMode.value === "bring") {
    return isRecipeSelected(item) && currentBringRecipeId.value !== item.id;
  }
  return isRecipeSelected(item) && !isRecipeAdded(item);
}

function isRecipePendingRemove(item: RecipeSheetItem) {
  if (recipeSheetMode.value === "bring") return false;
  return isRecipeSelected(item) && isRecipeAdded(item);
}

function recipeSheetStatusText(item: RecipeSheetItem) {
  if (recipeSheetMode.value === "bring") {
    if (isRecipeAdded(item)) return "当前带这道";
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
  if (recipeSheetMode.value === "bring") {
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

function closeShareSheet() {
  if (inviteSharing.value) return;
  shareSheetVisible.value = false;
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

function handleShareSheetAfterClose() {
  if (shareSheetVisible.value) return;
  shareLinkError.value = "";
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
}

function handleTimeChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
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
    const nextScheduledAt = composeScheduledAt(
      scheduledDate.value || planDetail.value.planDate || todayText(),
      scheduledTime.value || resolveDefaultTime(planDetail.value.mealSlot)
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
        cookUserUid: null,
        cookName: null,
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

function resolvePlanDeadlineMs(dateText: string | null | undefined, slot: MealSlot | null | undefined) {
  if (!dateText || !slot) return 0;
  const localDate = new Date(`${dateText}T${mealSlotDefaultTime(slot)}:00`);
  const time = localDate.getTime();
  return Number.isFinite(time) ? time : 0;
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

function resolveDefaultTime(slot: MealSlot) {
  return mealSlotDefaultTime(slot);
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

async function handleInviteShare() {
  if (!eventDetail.value || inviteSharing.value) return;
  const existingSharePath = activeSharePath.value || eventDetail.value.shareTokenPath || "";
  if (!canQuickShareInvite.value && !existingSharePath) {
    const message = canInviteParticipants.value
      ? "分享入口准备中"
      : "请先让发起人准备分享邀请";
    void uniPlatform.feedback.toast({ title: message, icon: "none" });
    return;
  }
  if (!activeSharePath.value && existingSharePath) {
    activeSharePath.value = existingSharePath;
  }
  shareLinkError.value = "";
  shareSheetVisible.value = true;
  if (!activeSharePath.value && canInviteParticipants.value) {
    void prepareInviteShareLink(true);
  }
}

async function prepareInviteShareLink(silent = false) {
  if (!eventDetail.value || inviteSharing.value) return;
  inviteSharing.value = true;
  shareLinkError.value = "";
  try {
    const result = await mealApi.createDiningEventShareLink(eventDetail.value.id, createOperationId());
    activeSharePath.value = result.shareTokenPath;
    eventDetail.value = {
      ...eventDetail.value,
      hasActiveShareLink: true,
      shareTokenPath: result.shareTokenPath
    };
  } catch (error) {
    shareLinkError.value = error instanceof Error ? error.message : "好友邀请生成失败";
    if (!silent) {
      await uniPlatform.feedback.toast({ title: shareLinkError.value, icon: "none" });
    }
  } finally {
    inviteSharing.value = false;
  }
}

function handleShareFriendClick() {
  if (!eventDetail.value) return;
  if (activeSharePath.value) return;
  if (!activeSharePath.value) {
    if (canInviteParticipants.value) {
      void prepareInviteShareLink();
      return;
    }
    void uniPlatform.feedback.toast({ title: "请先让发起人准备分享邀请", icon: "none" });
  }
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
    await uniPlatform.feedback.toast({ title: "菜单已固定", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "确认菜单失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function openMemory() {
  if (!eventId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(eventId.value))}`);
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
  if (action === "bring") {
    openBringSheet();
    return;
  }
  if (action === "create-event") {
    openEventEditor();
    return;
  }
  if (action === "confirm-menu") {
    void handleConfirmMenuAction();
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
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-tabbar-bg);
  box-shadow: 0 10rpx 24rpx var(--color-surface-mask-weak);
  pointer-events: none;
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  transition: opacity 180ms ease;
}

.detail-nav {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
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
  color: var(--color-danger);
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
  background:
    radial-gradient(circle at 12% 12%, color-mix(in srgb, var(--color-warning-soft) 70%, transparent) 0, transparent 28%),
    radial-gradient(circle at 88% 18%, color-mix(in srgb, var(--color-primary-soft) 58%, transparent) 0, transparent 26%),
    linear-gradient(160deg, color-mix(in srgb, var(--entry-board-bg) 88%, white 12%), color-mix(in srgb, var(--entry-primary-bg) 86%, var(--color-warning-soft) 14%));
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

.meal-hero__cover-static,
.meal-hero__cover-empty {
  position: relative;
  width: 100%;
  height: 100%;
}

.meal-hero__cover-static {
  overflow: hidden;
}

.meal-hero__cover-image {
  display: block;
  width: 100%;
  height: 100%;
}

.meal-hero__cover-empty {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10rpx;
  padding: 36rpx;
  padding-top: calc(var(--hero-header-offset) + 24rpx);
  background:
    linear-gradient(140deg, var(--entry-side-mint-bg) 0%, var(--entry-board-bg) 48%, var(--entry-photo-bg) 100%),
    linear-gradient(180deg, var(--color-surface-mask-weak) 0%, var(--color-surface-mask-medium) 100%);
  box-sizing: border-box;
}

.meal-hero__cover-empty-title,
.meal-hero__cover-empty-desc {
  display: block;
}

.meal-hero__cover-empty-title {
  color: var(--entry-ink);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.meal-hero__cover-empty-desc {
  color: var(--entry-side-muted-text);
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
  background: color-mix(in srgb, var(--color-surface-mask-weak) 82%, white 18%);
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
  background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-page) 92%, transparent) 100%);
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
  background: color-mix(in srgb, var(--color-warning-soft) 68%, var(--color-surface) 32%);
  color: var(--color-warning-text);
}

.meal-hero__tag--done {
  background: color-mix(in srgb, var(--color-primary-soft) 78%, var(--color-surface) 22%);
  color: var(--color-primary);
}

.meal-detail-content {
  position: relative;
  margin-top: -30rpx;
  padding: 116rpx var(--space-page) calc(200rpx + env(safe-area-inset-bottom));
  border-top-left-radius: 38rpx;
  border-top-right-radius: 38rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-page) 6%);
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
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.summary-card {
  padding: 28rpx 30rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-page) 6%);
  box-shadow:
    0 18rpx 42rpx color-mix(in srgb, var(--color-primary-soft) 32%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-surface) 74%, transparent);
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
  color: var(--theme-primary);
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
  background: color-mix(in srgb, var(--color-warning-soft) 76%, var(--color-surface) 24%);
  color: var(--color-warning-text);
}

.summary-card__badge--confirmed,
.summary-card__badge--done {
  background: color-mix(in srgb, var(--color-primary-soft) 78%, var(--color-surface) 22%);
  color: var(--color-primary);
}

.summary-card__badge--cancelled {
  background: color-mix(in srgb, var(--color-danger-soft) 76%, var(--color-surface) 24%);
  color: var(--color-danger-text);
}

.summary-card__facts {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 24rpx;
  padding: 4rpx 0;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface-muted) 68%, transparent);
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
  border-top: 1rpx solid color-mix(in srgb, var(--color-border-light) 82%, transparent);
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
  color: var(--theme-primary);
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
  border-top: 1rpx solid color-mix(in srgb, var(--color-border-light) 78%, transparent);
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
  background: color-mix(in srgb, var(--theme-primary) 12%, var(--color-surface));
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--theme-primary) 14%, transparent);
}

.summary-card__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.summary-card__avatar-fallback,
.summary-card__avatar-more {
  color: var(--theme-primary);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.summary-card__avatar-divider {
  flex: 0 0 auto;
  width: 1rpx;
  height: 38rpx;
  background: color-mix(in srgb, var(--color-border) 78%, transparent);
}

.summary-card__invite {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border: 2rpx dashed color-mix(in srgb, var(--color-primary) 52%, var(--color-text-tertiary) 48%);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-surface) 82%, var(--color-primary-soft) 18%);
}

.summary-card__invite--disabled {
  opacity: 0.42;
}

.summary-card__invite-icon {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.summary-card__avatar--more {
  background: color-mix(in srgb, var(--color-warning-soft) 72%, var(--color-surface) 28%);
  box-shadow: none;
}

.store-card {
  margin-top: 18rpx;
  padding: 28rpx 30rpx;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-warning-soft) 68%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-warning-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-warning-soft) 26%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-warning-soft) 34%, transparent);
}

.store-card--event {
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-primary-soft) 62%, transparent) 0 26%, transparent 27%),
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 95%, var(--color-primary-soft) 5%) 0%, var(--color-surface) 100%);
  box-shadow:
    0 20rpx 42rpx color-mix(in srgb, var(--color-primary-soft) 24%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-primary-soft) 28%, transparent);
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
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
  color: var(--color-text-secondary);
}

.store-card__step--done {
  background: color-mix(in srgb, var(--theme-primary) 14%, var(--color-surface));
  color: var(--theme-primary);
}

.store-card__step--current {
  background: color-mix(in srgb, var(--color-warning-soft) 70%, var(--color-surface) 30%);
  color: var(--color-warning-text);
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
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.meal-panel--warning {
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
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

.meal-inline-action {
  flex-shrink: 0;
  padding: 14rpx 26rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
  color: var(--theme-primary);
  font-size: 24rpx;
  font-weight: 600;
}

.meal-inline-action--ghost {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--theme-primary);
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
  border-bottom: 2rpx dashed color-mix(in srgb, var(--theme-primary) 18%, var(--color-divider));
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

.meal-menu__status-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  text-align: right;
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
  background: color-mix(in srgb, var(--theme-primary) 12%, var(--color-surface));
  color: var(--theme-primary);
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
  background: color-mix(in srgb, var(--theme-primary) 5%, var(--color-surface));
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
  background: color-mix(in srgb, var(--color-surface-muted) 78%, transparent);
}

.bring-list__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
  flex: 0 0 auto;
}

.bring-list__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.bring-list__avatar-fallback {
  color: var(--theme-primary);
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
  background: color-mix(in srgb, var(--color-primary-soft) 82%, var(--color-surface) 18%);
  color: var(--color-primary);
  font-size: 20rpx;
  font-weight: 700;
}

.meal-helper-banner {
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
}

.meal-helper-banner__title {
  display: block;
  color: var(--color-warning);
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
  background: color-mix(in srgb, var(--theme-primary) 6%, var(--color-surface));
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
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
  color: #fff;
  background: linear-gradient(135deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
  box-shadow: var(--button-primary-shadow);
}

.meal-helper__button--ghost {
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
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

.participant-sheet {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.participant-sheet__section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.participant-sheet__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.participant-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.participant-sheet__row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface-muted) 68%, transparent);
}

.participant-sheet__row--dimmed {
  opacity: 0.56;
}

.participant-sheet__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--theme-primary) 12%, var(--color-surface));
}

.participant-sheet__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.participant-sheet__avatar-fallback {
  color: var(--theme-primary);
  font-size: 24rpx;
  font-weight: 700;
}

.participant-sheet__main {
  min-width: 0;
  flex: 1;
}

.participant-sheet__name,
.participant-sheet__meta {
  display: block;
}

.participant-sheet__name {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.participant-sheet__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.5;
}

.participant-sheet__action {
  flex: 0 0 auto;
  min-width: 112rpx;
  min-height: 64rpx;
  padding: 0 22rpx;
  margin: 0;
  border: 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-text-secondary);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}

.participant-sheet__action::after {
  border: 0;
}

.participant-sheet__action--primary {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary);
}

.participant-sheet__invite {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-height: 92rpx;
  border: 2rpx dashed color-mix(in srgb, var(--color-primary) 38%, var(--color-border) 62%);
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface) 86%, var(--color-primary-soft) 14%);
}

.participant-sheet__invite--disabled {
  opacity: 0.42;
}

.participant-sheet__invite-icon {
  font-size: 24rpx;
}

.participant-sheet__invite-text {
  color: var(--color-primary);
  font-size: 26rpx;
  font-weight: 600;
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
  color: var(--color-primary);
  font-weight: 600;
}

.recipe-sheet__state {
  padding: 8rpx 6rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.recipe-sheet__state--error {
  color: var(--color-danger-text);
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
  background: color-mix(in srgb, var(--color-surface-muted) 76%, transparent);
}

.recipe-sheet__row--pending-add {
  border-color: color-mix(in srgb, var(--color-primary) 24%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 82%, var(--color-surface) 18%);
}

.recipe-sheet__row--selected {
  border-color: color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.recipe-sheet__row--pending-remove {
  border-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
  background: color-mix(in srgb, var(--color-danger-soft) 68%, var(--color-surface) 32%);
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
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
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
  color: color-mix(in srgb, var(--theme-primary) 72%, white 28%);
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
  border: 1rpx solid color-mix(in srgb, var(--color-border) 88%, transparent);
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  box-sizing: border-box;
}

.recipe-sheet__status--pending-add {
  border-color: color-mix(in srgb, var(--color-primary) 24%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 84%, var(--color-surface) 16%);
}

.recipe-sheet__status--selected {
  border-color: color-mix(in srgb, var(--color-primary) 24%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 84%, var(--color-surface) 16%);
}

.recipe-sheet__status--added {
  border-color: transparent;
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
}

.recipe-sheet__status--pending-remove {
  border-color: transparent;
  background: color-mix(in srgb, var(--color-danger-soft) 76%, var(--color-surface) 24%);
}

.recipe-sheet__status-text {
  color: var(--color-primary);
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
  color: var(--theme-primary);
}

.recipe-sheet__status--pending-remove .recipe-sheet__status-text {
  color: var(--color-danger-text);
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

.sheet-input__placeholder {
  color: var(--color-text-tertiary);
}

.title-sheet__input {
  width: 100%;
}

.note-sheet__input {
  width: 100%;
  min-height: 240rpx;
  height: 240rpx;
  padding: 24rpx;
  line-height: 1.7;
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
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 2rpx var(--color-border);
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
  background: var(--color-primary-soft);
  color: var(--color-primary);
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
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.sheet-note {
  margin-top: 20rpx;
}

.sheet-note--error {
  color: var(--color-danger-text);
}

.schedule-sheet {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.schedule-sheet__time {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.schedule-sheet__time-icon,
.schedule-sheet__time-text {
  color: var(--color-primary);
}

.schedule-sheet__time-icon {
  font-size: 28rpx;
}

.schedule-sheet__time-text {
  font-size: 30rpx;
  font-weight: 600;
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
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text-secondary);
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
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
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
  color: var(--color-text);
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
  color: var(--color-primary);
}

.meal-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  padding: 18rpx var(--space-page) calc(18rpx + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--color-surface) 94%, white 6%);
  box-shadow: var(--shadow-floating);
  -webkit-backdrop-filter: blur(12rpx);
  backdrop-filter: blur(12rpx);
  box-sizing: border-box;
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
  background: color-mix(in srgb, var(--color-danger) 88%, white 12%);
  color: #fff;
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
  color: var(--color-warning);
  font-size: 22rpx;
}

.meal-footer__join-value {
  color: var(--color-warning);
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
  color: var(--color-primary);
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
  color: var(--color-warning);
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
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 14rpx;
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
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
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
  height: 84rpx;
  margin: 0;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 84rpx;
}

.meal-footer__button::after {
  border: none;
}

.meal-footer__button--ghost {
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
}

.meal-footer__button--primary {
  color: var(--button-primary-text);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
}
</style>
