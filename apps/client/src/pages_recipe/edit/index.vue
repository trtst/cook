<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    :title="''"
    full-screen
    :navbar-transparent="true"
    :navbar-opacity="navOpacity"
    :navbar-placeholder="false"
  >
    <view class="edit-nav-backdrop" :style="navBackdropStyle" />

    <template #navbar-right>
      <view class="edit-nav-actions">
        <view
          class="edit-nav-action"
          :class="{ 'edit-nav-action--disabled': submitting }"
          @click="openPreviewSheet"
        >
          预览
        </view>
        <view
          class="edit-nav-action"
          :class="{ 'edit-nav-action--disabled': submitting }"
          @click="saveDraft"
        >
          存草稿
        </view>
      </view>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后维护菜谱"
      description="登录后才能选择食材、保存草稿和发布你自己的菜谱。"
      @success="handleLoginSuccess"
    />
    <view v-else-if="loading" class="notice notice--state" :style="noticeStyle">
      <image class="notice__art" :src="loadingIllustration" mode="aspectFit" />
      <text class="notice__title">正在准备菜谱</text>
      <text class="notice__desc">草稿内容正在就位，马上就好。</text>
    </view>
    <view v-else-if="errorText" class="notice notice--state notice--error" :style="noticeStyle" @click="loadPage">
      <image class="notice__art" :src="loadingIllustration" mode="aspectFit" />
      <text class="notice__title">加载出了点问题</text>
      <text class="notice__desc">{{ errorText }}</text>
      <text class="notice__action">点一下重新加载</text>
    </view>

    <view v-else class="edit-page">
      <scroll-view scroll-y class="edit-scroll" show-scrollbar="false" @scroll="handleEditScroll">
        <view class="hero" :style="heroStyle">
          <ImageField
            class="hero__cover"
            variant="cover"
            :image-src="currentCoverImage"
            title="菜谱封面图（4:3）"
            description="清晰的封面会让菜谱更容易被看到"
            :button-text="coverButtonText"
            @select="selectCoverImage"
            @clear="clearCoverImage"
          />
        </view>

        <view class="content">
          <view class="title-block">
            <view class="title-block__field">
              <textarea
                :value="form.name"
                auto-height
                class="title-block__input"
                :maxlength="TITLE_LIMIT"
                placeholder="添加菜谱标题"
                placeholder-class="title-block__placeholder"
                @focus="handleFormFieldFocus"
                @blur="handleFormFieldBlur"
                @input="handleNameInput"
              />
              <text class="input-count">{{ titleCount }}/{{ TITLE_LIMIT }}</text>
            </view>
            <view class="title-block__field title-block__field--story">
              <textarea
                :value="form.story"
                auto-height
                class="story-block__input"
                :maxlength="STORY_LIMIT"
                placeholder="输入这道美食背后的故事"
                placeholder-class="story-block__placeholder"
                @focus="handleFormFieldFocus"
                @blur="handleFormFieldBlur"
                @input="handleStoryInput"
              />
              <text class="input-count input-count--story">{{ storyCount }}/{{ STORY_LIMIT }}</text>
            </view>
          </view>

          <view class="panel">
            <view class="panel__head panel__head--ingredient">
              <view class="panel__meta">
                <view class="panel__meta panel__meta--inline">
                  <text class="panel__title">食材</text>
                  <text class="panel__count">{{ ingredientCount }} 项</text>
                </view>
                <text class="panel__desc">建议按主食材、辅食材、配料顺序添加，后续查看会更清晰。</text>
              </view>
            </view>

            <view v-if="!ingredientRows.length" class="ingredient-empty" @click="openIngredientSheet">
              <text class="ingredient-empty__text">暂无食材，可点击下方“添加食材”补充</text>
            </view>

            <view id="ingredient-stack" v-else class="ingredient-stack ingredient-stack--compact">
              <view
                v-for="row in ingredientRows"
                :id="`ingredient-row-${row.localId}`"
                :key="row.localId"
                class="ingredient-line"
                :class="{ 'ingredient-line--placeholder': ingredientDraggingId === row.localId }"
              >
                <text
                  v-if="showIngredientDragHandle"
                  class="cookfont icon-drag ingredient-line__drag"
                  @touchstart.stop.prevent="handleIngredientDragTouchStart(row.localId, $event)"
                  @touchmove.stop.prevent="handleIngredientDragTouchMove"
                  @touchend.stop="finishIngredientDrag"
                  @touchcancel.stop="finishIngredientDrag"
                />
                <input
                  v-model="row.name"
                  class="ingredient-line__field ingredient-line__field--name"
                  maxlength="30"
                  placeholder="食材"
                  placeholder-class="ingredient-line__input-placeholder"
                  @focus="handleFormFieldFocus"
                  @blur="handleFormFieldBlur"
                />
                <input
                  v-model="row.quantity"
                  class="ingredient-line__field ingredient-line__field--quantity"
                  maxlength="20"
                  type="digit"
                  confirm-type="done"
                  placeholder="数量"
                  placeholder-class="ingredient-line__input-placeholder"
                  @focus="handleFormFieldFocus"
                  @blur="handleFormFieldBlur"
                  @input="handleQuantityInput(row.localId)"
                />
                <view class="ingredient-line__field ingredient-line__field--unit" @click="openUnitSheet(row.localId)">
                  <text :class="{ 'ingredient-line__placeholder': !getRowUnitText(row) }">
                    {{ getRowUnitText(row) || "单位" }}
                  </text>
                </view>
                <text class="cookfont icon-close ingredient-line__remove" @click="removeIngredientRow(row.localId)" />
              </view>
            </view>

            <view class="ingredient-add" @click="openIngredientSheet">
              <text class="cookfont icon-add ingredient-add__icon" />
              <text>添加食材</text>
            </view>
          </view>

          <view v-if="ingredientGhostRow" class="ingredient-drag-layer">
            <view class="ingredient-line ingredient-line--ghost" :style="ingredientGhostStyle">
              <text class="cookfont icon-drag ingredient-line__drag ingredient-line__drag--ghost" />
              <view class="ingredient-line__field ingredient-line__field--name">
                {{ ingredientGhostRow.name || "食材" }}
              </view>
              <view class="ingredient-line__field ingredient-line__field--quantity">
                {{ ingredientGhostRow.quantity || "数量" }}
              </view>
              <view class="ingredient-line__field ingredient-line__field--unit">
                <text :class="{ 'ingredient-line__placeholder': !getRowUnitText(ingredientGhostRow) }">
                  {{ getRowUnitText(ingredientGhostRow) || "单位" }}
                </text>
              </view>
            </view>
          </view>

          <view class="panel">
            <view class="panel__head panel__head--center">
              <text class="panel__title">做法</text>
              <view class="panel__tools">
                <view v-if="showStepSortEntry" class="panel__pill panel__pill--ghost" @click="openStepSort">调整步骤</view>
                <view class="panel__pill panel__pill--ghost" @click="handleStepImages">批量传图</view>
              </view>
            </view>

            <view class="step-stack">
              <view
                v-for="(row, index) in stepRows"
                :key="row.localId"
                class="step-card"
              >
                <view class="step-card__head">
                  <text class="step-card__title">步骤 {{ index + 1 }}</text>
                  <text class="step-card__remove" @click="removeStepRow(row.localId)">删除</text>
                </view>

                <ImageField
                  class="step-card__image"
                  variant="card"
                  :image-src="getStepImageSrc(row)"
                  title="步骤图"
                  description="清晰的步骤会让菜谱更受欢迎"
                  button-text="更换"
                  @select="selectStepImage(row.localId)"
                  @clear="clearStepImage(row.localId)"
                />

                <view class="step-card__field">
                  <textarea
                    v-model="row.text"
                    auto-height
                    class="step-card__textarea"
                    :maxlength="STEP_LIMIT"
                    :placeholder="`添加步骤 ${index + 1} 说明`"
                    :placeholder-class="'step-card__placeholder'"
                    @focus="handleFormFieldFocus"
                    @blur="handleFormFieldBlur"
                  />
                  <text class="input-count step-card__count">{{ row.text.length }}/{{ STEP_LIMIT }}</text>
                </view>
              </view>
            </view>

            <view class="panel__footer">
              <view class="ingredient-add ingredient-add--secondary" @click="addStepRow">
                <text class="cookfont icon-add ingredient-add__icon" />
                <text>再增加一步</text>
              </view>
            </view>
          </view>

          <view class="advanced-row" @click="openAdvancedSheet">
            <view class="advanced-row__main">
              <view class="advanced-row__top">
                <view class="advanced-row__head">
                  <text class="advanced-row__title">高级设置</text>
                  <text class="advanced-row__count">{{ advancedCountText }}</text>
                </view>
                <text class="cookfont icon-back advanced-row__arrow" />
              </view>
              <text class="advanced-row__desc">{{ advancedSummary }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

        <view v-if="stepSortVisible" class="step-sort" :class="{ 'step-sort--open': stepSortOpen }">
          <view class="step-sort__mask" @click="cancelStepSort" />
          <view
            class="step-sort__panel"
            :style="stepSortStyle"
            @click.stop
            @touchmove.stop="handleStepSortTouchMove"
            @touchend.stop="finishStepSortDrag"
            @touchcancel.stop="finishStepSortDrag"
          >
            <view class="step-sort__head">
              <view class="step-sort__title-row">
                <text class="step-sort__title">制作步骤</text>
                <text class="step-sort__count">{{ stepSortCountText }}</text>
              </view>
              <text class="cookfont icon-close step-sort__close" @click="cancelStepSort" />
            </view>
            <text class="step-sort__desc">长按卡片拖动调整顺序</text>

            <scroll-view
              id="step-sort-scroll"
              class="step-sort__scroll"
              :scroll-y="!stepSortDragging"
              show-scrollbar="false"
              @scroll="handleStepSortScroll"
            >
              <transition-group id="step-sort-list" name="step-sort-list" tag="view" class="step-sort__list">
                <view
                  v-for="(row, index) in stepSortRows"
                  :id="`step-sort-card-${row.localId}`"
                  :key="row.localId"
                  class="step-sort-card"
                  :class="{ 'step-sort-card--placeholder': stepSortDraggingId === row.localId }"
                  @touchstart.stop="handleStepSortTouchStart(row.localId, $event)"
                >
                  <view class="step-sort-card__index">{{ formatStepIndex(index) }}</view>
                  <view class="step-sort-card__thumb">
                    <image v-if="getStepImageSrc(row)" class="step-sort-card__thumb-image" :src="getStepImageSrc(row)" mode="aspectFill" />
                    <text v-else class="step-sort-card__thumb-text">暂无步骤图</text>
                  </view>
                  <view class="step-sort-card__copy">
                    <text class="step-sort-card__text">{{ getStepSortText(row.text) }}</text>
                  </view>
                </view>
              </transition-group>
            </scroll-view>

            <view class="step-sort__footer">
              <button class="step-sort__confirm" @click="confirmStepSort">确认</button>
            </view>
          </view>

          <view v-if="stepSortGhostRow" class="step-sort__ghost" :style="stepSortGhostStyle">
            <view class="step-sort-card step-sort-card--ghost">
              <view class="step-sort-card__index">{{ formatStepIndex(stepSortGhostIndex) }}</view>
              <view class="step-sort-card__thumb">
                <image
                  v-if="getStepImageSrc(stepSortGhostRow)"
                  class="step-sort-card__thumb-image"
                  :src="getStepImageSrc(stepSortGhostRow)"
                  mode="aspectFill"
                />
                <text v-else class="step-sort-card__thumb-text">暂无步骤图</text>
              </view>
              <view class="step-sort-card__copy">
                <text class="step-sort-card__text">{{ getStepSortText(stepSortGhostRow.text) }}</text>
              </view>
            </view>
          </view>
        </view>

        <SheetShell
          v-if="sheetMode"
          :visible="sheetVisible"
          :title="sheetTitle"
          :subtitle="sheetSubtitle"
          body-padding="none"
          @close="closeSheet"
          @after-close="handleSheetAfterClose"
        >
            <template v-if="sheetTitleTag" #title-extra>
              <text class="sheet__title-tag">{{ sheetTitleTag }}</text>
            </template>

            <template v-if="sheetMode === 'ingredient'">
              <text class="ingredient-picker__hint">{{ ingredientHintText }}</text>

              <view v-if="!ingredientCreateVisible" class="sheet-search">
                <RecipeSearchBar
                  v-model="ingredientKeyword"
                  class="sheet-search__bar"
                  placeholder="搜索食材名称"
                  @confirm="dismissSheetKeyboard"
                  @clear="exitIngredientSearch"
                />
              </view>

              <view v-if="!ingredientCreateVisible && !ingredientSearchMode" class="ingredient-filter">
                <view
                  class="ingredient-filter__chip"
                  :class="{ 'ingredient-filter__chip--active': ingredientAllActive }"
                  @click="clearIngredientCategory"
                >
                  全部食材
                </view>
                <view class="ingredient-filter__right">
                  <view
                    class="ingredient-filter__action"
                    :class="{ 'ingredient-filter__action--hidden': !showIngredientPersonalActions }"
                    @click="startIngredientCreate()"
                  >
                    添加食材
                  </view>
                  <view
                    class="ingredient-filter__chip"
                    :class="{ 'ingredient-filter__chip--active': ingredientSourceFilter === 'PERSONAL' }"
                    @click="changeIngredientSourceFilter('PERSONAL')"
                  >
                    我的食材
                    <text class="cookfont icon-filter ingredient-filter__icon" />
                  </view>
                </view>
              </view>

              <view class="ingredient-stage">
                <view v-if="!ingredientCreateVisible" class="ingredient-stage__pane">
                    <template v-if="ingredientSearchMode">
                      <view v-if="ingredientSearchLoading && !searchedIngredients.length" class="ingredient-picker__empty ingredient-picker__empty--create">
                        <text class="ingredient-picker__empty-text">加载中...</text>
                      </view>
                      <view v-else-if="searchedIngredients.length" class="ingredient-search">
                        <text class="ingredient-search__count">搜索结果 {{ searchedIngredients.length }} 条</text>
                        <scroll-view
                          class="ingredient-search__scroll"
                          scroll-y
                          lower-threshold="240"
                          @scrolltolower="loadMoreIngredients"
                        >
                          <view class="ingredient-grid ingredient-grid--search">
                          <view
                            v-for="item in searchedIngredients"
                            :key="item.id"
                            class="ingredient-choice"
                            :class="{ 'ingredient-choice--active': pendingIngredientIds.includes(item.id) }"
                            @click="togglePendingIngredient(item.id)"
                          >
                            <view class="ingredient-choice__head">
                              <text class="ingredient-choice__name">{{ item.name }}</text>
                            </view>
                            <view v-if="showIngredientItemActions(item)" class="ingredient-choice__actions">
                              <text v-if="canEditIngredient(item)" class="ingredient-choice__action" @click.stop="startIngredientEdit(item)">编辑</text>
                              <text
                                v-if="canRecommendIngredient(item)"
                                class="ingredient-choice__action ingredient-choice__action--primary"
                                @click.stop="recommendIngredient(item)"
                              >
                                推荐
                              </text>
                              <text v-else-if="isIngredientRecommendationPending(item)" class="ingredient-choice__status">审核中</text>
                            </view>
                          </view>
                          </view>
                          <text v-if="ingredientFooterText" class="ingredient-search__footer">{{ ingredientFooterText }}</text>
                        </scroll-view>
                      </view>
                      <view v-else class="ingredient-picker__empty ingredient-picker__empty--create">
                        <text class="ingredient-picker__empty-text">没有搜索到“{{ ingredientSearchText }}”</text>
                        <button class="ingredient-picker__create" @click="startIngredientCreate()">
                          创建 {{ ingredientSearchText }}
                        </button>
                      </view>
                    </template>
                    <view v-else class="ingredient-picker">
                      <view id="ingredient-picker-side" class="ingredient-picker__side">
                        <view
                          v-for="item in ingredientCategories"
                          :key="item.id"
                          class="ingredient-category"
                          :class="{ 'ingredient-category--active': ingredientCategoryId === item.id }"
                          @click="changeIngredientCategory(item.id)"
                        >
                          {{ item.name }}
                        </view>
                      </view>

                      <view class="ingredient-picker__main" :style="ingredientPickerMainStyle">
                        <view v-if="ingredientLoading && !categoryIngredients.length" class="ingredient-picker__empty">
                          <text class="ingredient-picker__empty-text">加载中...</text>
                        </view>
                        <scroll-view
                          v-else-if="categoryIngredients.length"
                          class="ingredient-picker__scroll"
                          scroll-y
                          show-scrollbar="false"
                          lower-threshold="240"
                          @scrolltolower="loadMoreIngredients"
                        >
                          <view class="ingredient-grid">
                            <view
                              v-for="item in categoryIngredients"
                              :key="item.id"
                              class="ingredient-choice"
                              :class="{ 'ingredient-choice--active': pendingIngredientIds.includes(item.id) }"
                              @click="togglePendingIngredient(item.id)"
                            >
                              <view class="ingredient-choice__head">
                                <text class="ingredient-choice__name">{{ item.name }}</text>
                              </view>
                              <view v-if="showIngredientItemActions(item)" class="ingredient-choice__actions">
                                <text v-if="canEditIngredient(item)" class="ingredient-choice__action" @click.stop="startIngredientEdit(item)">编辑</text>
                                <text
                                  v-if="canRecommendIngredient(item)"
                                  class="ingredient-choice__action ingredient-choice__action--primary"
                                  @click.stop="recommendIngredient(item)"
                                >
                                  推荐
                                </text>
                                <text v-else-if="isIngredientRecommendationPending(item)" class="ingredient-choice__status">审核中</text>
                              </view>
                            </view>
                          </view>
                          <text v-if="ingredientFooterText" class="ingredient-search__footer">{{ ingredientFooterText }}</text>
                        </scroll-view>
                        <view v-else class="ingredient-picker__empty">
                          <text class="ingredient-picker__empty-text">{{ ingredientEmptyText }}</text>
                          <button
                            v-if="showIngredientEmptyCreate"
                            class="ingredient-picker__create"
                            @click="startIngredientCreate()"
                          >
                            创建个人食材
                          </button>
                        </view>
                      </view>
                    </view>

                    <view class="ingredient-picker__footer">
                      <scroll-view scroll-x class="ingredient-selected" show-scrollbar="false">
                        <view class="ingredient-selected__track">
                          <view
                            v-for="item in pendingSelectedIngredients"
                            :key="item.id"
                            class="ingredient-selected__chip"
                          >
                            <text class="ingredient-selected__name">{{ item.name }}</text>
                            <text class="cookfont icon-close ingredient-selected__remove" @click.stop="removePendingIngredient(item.id)" />
                          </view>
                        </view>
                      </scroll-view>
                      <button
                        v-if="ingredientSearchMode"
                        class="sheet-cancel"
                        @click="exitIngredientSearch"
                      >
                        取消
                      </button>
                      <button
                        class="sheet-confirm"
                        :disabled="ingredientConfirmDisabled"
                        @click="confirmIngredientSelection"
                      >
                        确认
                      </button>
                    </view>
                </view>

                <view v-else class="ingredient-stage__pane">
                    <view class="ingredient-create">
                      <view class="ingredient-create__summary">
                        <view class="ingredient-create__card ingredient-create__card--field">
                          <input
                            v-model="ingredientCreateDraft.name"
                            class="ingredient-create__input"
                            maxlength="30"
                            placeholder="请输入食材名字"
                            placeholder-class="ingredient-create__input-placeholder"
                          />
                        </view>
                        <view
                          class="ingredient-create__card ingredient-create__card--action"
                          :class="{ 'ingredient-create__card--active': ingredientCreateSection === 'category' }"
                          @click="toggleIngredientCreateSection('category')"
                        >
                          <text
                            class="ingredient-create__value"
                            :class="{ 'ingredient-create__value--placeholder': !ingredientCreateCategoryName }"
                          >
                            {{ ingredientCreateCategoryName || "选择分类" }}
                          </text>
                        </view>
                        <view
                          class="ingredient-create__card ingredient-create__card--action"
                          :class="{ 'ingredient-create__card--active': ingredientCreateSection === 'unit' }"
                          @click="toggleIngredientCreateSection('unit')"
                        >
                          <text
                            class="ingredient-create__value"
                            :class="{ 'ingredient-create__value--placeholder': !ingredientCreateUnitName }"
                          >
                            {{ ingredientCreateUnitName || "选择单位" }}
                          </text>
                        </view>
                      </view>

                      <view v-if="ingredientCreateSection === 'category'" class="ingredient-create__group">
                        <text class="ingredient-create__group-title">分类：</text>
                        <view class="ingredient-grid ingredient-grid--create">
                          <view
                            v-for="item in ingredientCategories"
                            :key="item.id"
                            class="ingredient-choice"
                            :class="{ 'ingredient-choice--active': ingredientCreateDraft.categoryId === item.id }"
                            @click="selectIngredientCreateCategory(item.id)"
                          >
                            <text class="ingredient-choice__name">{{ item.name }}</text>
                          </view>
                        </view>
                      </view>

                      <view v-if="ingredientCreateSection === 'unit'" class="ingredient-create__group">
                        <text class="ingredient-create__group-title">单位：</text>
                        <view class="ingredient-unit-groups">
                          <view v-for="group in unitGroups" :key="group.type" class="ingredient-unit-group">
                            <text class="ingredient-unit-group__title">{{ group.label }}</text>
                            <view class="ingredient-grid ingredient-grid--create ingredient-grid--unit">
                              <view
                                v-for="item in group.items"
                                :key="item.id"
                                class="ingredient-choice"
                                :class="{ 'ingredient-choice--active': ingredientCreateDraft.unitId === item.id }"
                                @click="selectIngredientCreateUnit(item.id)"
                              >
                                <text class="ingredient-choice__name">{{ item.name }}</text>
                              </view>
                            </view>
                          </view>
                        </view>
                      </view>
                    </view>

                    <view class="ingredient-create__footer">
                      <button class="sheet-cancel" @click="cancelIngredientCreate">取消</button>
                      <button
                        class="sheet-confirm"
                        :disabled="ingredientCreateSubmitting"
                        @click="confirmIngredientEditor"
                      >
                        {{ ingredientCreateDraft.id ? "保存" : "确定" }}
                      </button>
                    </view>
                </view>
              </view>
            </template>

            <template v-else-if="sheetMode === 'unit'">
              <view
                v-for="group in unitGroups"
                :key="group.type"
                class="sheet-section"
              >
                <text class="sheet-section__title">{{ group.label }}</text>
                <view class="chip-row">
                  <view
                    v-for="item in group.items"
                    :key="item.id"
                    class="chip"
                    @click="selectUnitOption(item.id)"
                  >
                    {{ item.name }}
                  </view>
                </view>
              </view>
            </template>

            <template v-else-if="sheetMode === 'advanced'">
              <view class="sheet-section">
                <view class="sheet-section__head">
                  <view class="sheet-section__meta">
                    <text class="sheet-section__title">个人分类</text>
                    <text class="sheet-section__tag">最多4字</text>
                  </view>
                  <view class="sheet-section__action" @click="toggleCategoryCreator">
                    {{ showCategoryCreator ? "取消" : "添加分类" }}
                  </view>
                </view>
                <view v-if="showCategoryCreator" class="sheet-creator">
                  <input
                    v-model="categoryDraftName"
                    class="sheet-creator__input"
                    maxlength="4"
                    placeholder="输入分类名称"
                    :disabled="categorySubmitting"
                  />
                  <button
                    class="sheet-creator__button"
                    :disabled="categorySubmitting || !categoryDraftName.trim()"
                    @click="createCategoryTag"
                  >
                    {{ categorySubmitting ? "添加中" : "确定" }}
                  </button>
                </view>
                <view v-if="categories.length" class="chip-row">
                  <view
                    v-for="item in categories"
                    :key="item.id"
                    class="chip"
                    :class="{ 'chip--active': advancedForm.categoryId === item.id }"
                    @click="advancedForm.categoryId = item.id"
                  >
                    {{ item.name }}
                  </view>
                </view>
                <text v-else class="sheet-section__hint">当前还没有个人分类。</text>
              </view>

              <view class="sheet-section">
                <view class="sheet-section__head">
                  <view class="sheet-section__meta">
                    <text class="sheet-section__title">系统分类</text>
                    <text class="sheet-section__tag">用于筛选</text>
                  </view>
                </view>
                <view v-if="inspirationCategories.length" class="chip-row">
                  <view
                    v-for="item in inspirationCategories"
                    :key="item.id"
                    class="chip"
                    :class="{ 'chip--active': advancedForm.inspirationCategoryId === item.id }"
                    @click="advancedForm.inspirationCategoryId = advancedForm.inspirationCategoryId === item.id ? null : item.id"
                  >
                    {{ item.name }}
                  </view>
                </view>
                <text v-else class="sheet-section__hint">当前还没有可选的系统分类。</text>
              </view>

              <view class="sheet-section editor-grid">
                <view class="editor-field">
                  <view class="editor-field__head">
                    <text class="editor-field__label">人数</text>
                    <view
                      class="editor-field__action"
                      :class="{ 'editor-field__action--active': showCustomBaseServings }"
                      @click="openCustomBaseServings"
                    >
                      自定义人数
                    </view>
                  </view>
                  <view class="chip-row servings-chip-row">
                    <view
                      v-for="item in baseServingsOptions"
                      :key="item"
                      class="chip"
                      :class="{ 'chip--active': advancedForm.baseServingsText === item }"
                      @click="selectBaseServingsOption(item)"
                    >
                      {{ item }} 人
                    </view>
                  </view>
                  <view v-if="showCustomBaseServings" class="sheet-creator servings-custom">
                    <input
                      :value="advancedForm.baseServingsText"
                      type="number"
                      maxlength="3"
                      class="sheet-creator__input"
                      placeholder="请输入人数"
                      placeholder-class="sheet-textarea__placeholder"
                      @input="handleBaseServingsInput"
                    />
                  </view>
                </view>
              </view>

              <view class="sheet-section">
                <text class="sheet-section__title">难度</text>
                <view class="chip-row">
                  <view
                    v-for="item in difficultyOptions"
                    :key="item.value"
                    class="chip"
                    :class="{ 'chip--active': advancedForm.difficulty === item.value }"
                    @click="toggleAdvancedDifficulty(item.value)"
                  >
                    {{ item.label }}
                  </view>
                </view>
              </view>

              <view class="sheet-section">
                <text class="sheet-section__title">烹饪时长</text>
                <view class="chip-row">
                  <view
                    v-for="item in durationOptions"
                    :key="item.value"
                    class="chip"
                    :class="{ 'chip--active': advancedForm.duration === item.value }"
                    @click="toggleAdvancedDuration(item.value)"
                  >
                    {{ item.label }}
                  </view>
                </view>
              </view>

              <view class="sheet-section">
                <text class="sheet-section__title">小贴士</text>
                <textarea
                  v-model="advancedForm.tips"
                  auto-height
                  class="sheet-textarea"
                  maxlength="1000"
                  placeholder="例如：番茄先出汁会更下饭"
                  placeholder-class="sheet-textarea__placeholder"
                />
                <button class="sheet-apply" @click="applyAdvancedForm">确定</button>
              </view>

            </template>

        </SheetShell>

        <view class="bottom-bar" :class="{ 'bottom-bar--hidden': formFieldFocused || stepSortVisible || ingredientDragging }">
          <button class="bar-button bar-button--primary bottom-bar__publish" :disabled="submitting" @click="publishDraft">发布这个菜谱</button>
        </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import loadingIllustration from "@/assets/recipe-page/loading-state.svg";
import {
  recipeApi,
  type IngredientCategorySummary,
  type IngredientSource,
  type IngredientSummary,
  type InspirationCategorySummary,
  type MyRecipeDetail,
  type RecipeDraftContentInput,
  type RecipeDraftIngredientInput,
  type RecipeDraftDetail,
  type RecipeDifficulty,
  type RecipeDuration,
  type RecipeIngredientInput,
  type RecipeCategorySummary,
  type UploadAssetScene,
  type UnitSummary
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import Login from "@/components/Login/Login.vue";
import Layout from "@/components/Layout/Layout.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useImageCropFlow } from "../composables/useImageCropFlow";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import {
  imageCropPresets,
  releaseImageFile,
  type ImageCropResult
} from "../utils/image-crop";
import {
  readRecipeEditCacheItem,
  removeRecipeEditCacheItem,
  writeRecipeEditCacheItem
} from "@/utils/recipe-edit-cache";
import { restoreAppSession } from "@/utils/session";
import { markRecipeHomeDirty, markRecipeManageDirty } from "@/pages/recipe/utils/recipe-view-sync";
import ImageField from "@/components/ImageField.vue";
import { useRecipePreviewStore } from "../stores/recipe-preview";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";
import {
  difficultyOptions,
  difficultyText as recipeDifficultyText,
  durationOptions,
  durationText as recipeDurationText
} from "@/utils/recipe-meta";

type FuzzyAmount = "适量" | "少许" | "按需";
type SheetMode = "" | "ingredient" | "unit" | "advanced";
type ResourceId = UUID;
type OptionalResourceId = UUID | "";
type NullableResourceId = UUID | null;

interface IngredientRow {
  localId: string;
  ingredientId: OptionalResourceId;
  name: string;
  quantity: string;
  unitId: OptionalResourceId;
  fuzzyText: FuzzyAmount | "";
  categoryId: OptionalResourceId;
  defaultUnitId: OptionalResourceId;
  source: IngredientSource | "";
}

interface StepRow {
  localId: string;
  slotKey: string;
  text: string;
  uploadId: NullableResourceId;
  imageUrl: string;
  localImagePath: string;
}

interface RecipeEditCacheFormSnapshot {
  name: string;
  story: string;
  categoryId: NullableResourceId;
  inspirationCategoryId: NullableResourceId;
  sceneIds: ResourceId[];
  coverUploadId: NullableResourceId;
  coverImageUrl: string;
  coverLocalImagePath: string;
  baseServingsText: string;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  tips: string;
}

interface RecipeEditCacheIngredientSnapshot {
  ingredientId: OptionalResourceId;
  name: string;
  quantity: string;
  unitId: OptionalResourceId;
  fuzzyText: FuzzyAmount | "";
  categoryId: OptionalResourceId;
  defaultUnitId: OptionalResourceId;
  source: IngredientSource | "";
}

interface RecipeEditCacheStepSnapshot {
  slotKey: string;
  text: string;
  uploadId: NullableResourceId;
  imageUrl: string;
  localImagePath: string;
}

interface RecipeEditCacheEntry {
  sourceVersion: number | null;
  savedAt: string;
  form: RecipeEditCacheFormSnapshot;
  ingredientRows: RecipeEditCacheIngredientSnapshot[];
  stepRows: RecipeEditCacheStepSnapshot[];
}

type CropTarget =
  | {
      kind: "cover";
    }
  | {
      kind: "step";
      localId: string;
      appendIfMissing: boolean;
    };

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const userStore = useUserStore();
const recipePreviewStore = useRecipePreviewStore();
const { navBarTotalHeight, systemInfo } = useSystemInfo();
const TITLE_LIMIT = 30;
const STORY_LIMIT = 150;
const STEP_LIMIT = 200;
const SHEET_ANIMATION_MS = 260;
const NAV_FADE_RANGE = 132;
const RECIPE_EDIT_CACHE_KEY_NEW = "new";
const RECIPE_EDIT_CACHE_DEBOUNCE_MS = 320;
const INGREDIENT_DRAG_PRESS_DELAY_MS = 260;
const INGREDIENT_DRAG_PRESS_MOVE_PX = 8;
const INGREDIENT_DRAG_GAP_RPX = 16;
const INGREDIENT_PAGE_SIZE = 20;
const INGREDIENT_ALL_PAGE_SIZE = 48;
const INGREDIENT_ALL_REVEAL_STEP = 12;
const INGREDIENT_SEARCH_DEBOUNCE_MS = 240;
const STEP_SORT_PRESS_DELAY_MS = 260;
const STEP_SORT_PRESS_MOVE_PX = 8;
const STEP_SORT_GAP_RPX = 20;

const recipeId = ref<OptionalResourceId>("");
const draftId = ref<OptionalResourceId>("");
const originVersionId = ref<NullableResourceId>(null);
const originCoverImageUrl = ref("");
const coverUploadId = ref<NullableResourceId>(null);
const coverImageUrl = ref("");
const coverLocalImagePath = ref("");
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const navOpacity = ref(0);
const draftVersion = ref<number | null>(null);
const recipeVersion = ref<number | null>(null);
const stepSortVisible = ref(false);
const stepSortOpen = ref(false);
const stepSortRows = ref<StepRow[]>([]);
const stepSortDraggingId = ref("");
const stepSortListTop = ref(0);
const stepSortCardLeft = ref(0);
const stepSortCardWidth = ref(0);
const stepSortCardHeight = ref(0);
const stepSortGhostTop = ref(0);
const stepSortStartTouchY = ref(0);
const stepSortStartCardTop = ref(0);
const stepSortScrollTop = ref(0);
const ingredientDraggingId = ref("");
const ingredientStackTop = ref(0);
const ingredientGhostTop = ref(0);
const ingredientGhostLeft = ref(0);
const ingredientGhostWidth = ref(0);
const ingredientRowHeight = ref(0);
const ingredientDragStartTouchY = ref(0);
const ingredientDragStartTop = ref(0);
const sheetMode = ref<SheetMode>("");
const sheetVisible = ref(false);
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recipe-edit-sheet"));

let rowSeed = 0;
let stepSortTimer: ReturnType<typeof setTimeout> | null = null;
let stepSortPressTimer: ReturnType<typeof setTimeout> | null = null;
let ingredientDragPressTimer: ReturnType<typeof setTimeout> | null = null;
let recipeEditCacheTimer: ReturnType<typeof setTimeout> | null = null;
let recipeEditCacheBaseline = "";
let recipeEditCacheSuspended = true;
let advancedOptionsPromise: Promise<void> | null = null;
let inspirationCategoriesPromise: Promise<void> | null = null;
let ingredientCategoryPromise: Promise<void> | null = null;
let ingredientSearchTimer: ReturnType<typeof setTimeout> | null = null;
let ingredientRequestSeed = 0;
let unitPromise: Promise<void> | null = null;
let ingredientDragPressId = "";
let ingredientDragPressTouchY = 0;
let stepSortPressId = "";
let stepSortPressTouchY = 0;

const categories = ref<RecipeCategorySummary[]>([]);
const inspirationCategories = ref<InspirationCategorySummary[]>([]);
const ingredientCategories = ref<IngredientCategorySummary[]>([]);
const ingredients = ref<IngredientSummary[]>([]);
const ingredientOptions = ref<IngredientSummary[]>([]);
const units = ref<UnitSummary[]>([]);
const ingredientRows = ref<IngredientRow[]>([]);
const stepRows = ref<StepRow[]>([createStepRow()]);
const ingredientKeyword = ref("");
const ingredientCategoryId = ref<OptionalResourceId>("");
const ingredientSourceFilter = ref<"ALL" | "PERSONAL">("ALL");
const ingredientPage = ref(1);
const ingredientHasNext = ref(false);
const ingredientLoading = ref(false);
const ingredientLoadingMore = ref(false);
const ingredientSearchPending = ref(false);
const ingredientVisibleCount = ref(0);
const ingredientPickerHeight = ref(0);
const pendingIngredientIds = ref<ResourceId[]>([]);
const ingredientCreateVisible = ref(false);
const ingredientCreateSubmitting = ref(false);
const ingredientCreateSection = ref<"" | "category" | "unit">("");
const formFieldFocused = ref(false);
const activeUnitRowId = ref("");
const categoriesLoaded = ref(false);
const inspirationCategoriesLoaded = ref(false);
const ingredientCategoriesLoaded = ref(false);
const unitsLoaded = ref(false);
const ingredientCreateDraft = reactive({
  id: "" as OptionalResourceId,
  version: null as number | null,
  name: "",
  categoryId: "" as OptionalResourceId,
  unitId: "" as OptionalResourceId
});

const {
  queueCrop,
  queueCrops,
  consumeCropResult,
  clearCropQueue
} = useImageCropFlow<CropTarget>({
  tokenPrefix: "recipe-crop",
  onApply: applyCropResult,
  async onOpenError(error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "打开裁剪页失败", icon: "none" });
  }
});

const form = reactive({
  name: "",
  story: "",
  categoryId: null as NullableResourceId,
  inspirationCategoryId: null as NullableResourceId,
  sceneIds: [] as ResourceId[],
  baseServingsText: "",
  difficulty: null as RecipeDifficulty | null,
  duration: null as RecipeDuration | null,
  tips: ""
});

const advancedForm = reactive({
  categoryId: null as NullableResourceId,
  inspirationCategoryId: null as NullableResourceId,
  sceneIds: [] as ResourceId[],
  baseServingsText: "",
  difficulty: null as RecipeDifficulty | null,
  duration: null as RecipeDuration | null,
  tips: ""
});
const showCategoryCreator = ref(false);
const showCustomBaseServings = ref(false);
const categoryDraftName = ref("");
const categorySubmitting = ref(false);

const baseServingsOptions = ["1", "2", "3", "4", "6", "8", "10"];
const unitTypeLabelMap: Record<UnitSummary["type"], string> = {
  WEIGHT: "重量",
  VOLUME: "体积",
  COMMON: "常用",
  PACKAGE: "包装"
};

const heroStyle = computed(() => ({
  "--hero-header-offset": `${navBarTotalHeight.value}px`
}));
const currentCoverImage = computed(() => coverLocalImagePath.value || coverImageUrl.value);
const coverButtonText = computed(() => (currentCoverImage.value ? "更换封面图" : "上传封面图"));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: navOpacity.value
}));
const noticeStyle = computed(() => ({
  marginTop: `${navBarTotalHeight.value}px`,
  minHeight: `calc(100vh - ${navBarTotalHeight.value}px)`
}));
const titleCount = computed(() => form.name.length);
const storyCount = computed(() => form.story.length);
const ingredientCount = computed(() => ingredientRows.value.length);
const ingredientSearchText = computed(() => ingredientKeyword.value.trim());
const ingredientSearchMode = computed(() => Boolean(ingredientSearchText.value));
const ingredientLoadedKeyword = ref("");
const ingredientAllActive = computed(() => ingredientSourceFilter.value === "ALL" && !ingredientCategoryId.value);
const ingredientUseWindowedList = computed(() => !ingredientSearchMode.value);
const ingredientSearchReady = computed(() => ingredientLoadedKeyword.value === ingredientSearchText.value);
const ingredientSearchLoading = computed(() => ingredientSearchMode.value && (ingredientSearchPending.value || ingredientLoading.value));
const ingredientConfirmDisabled = computed(() => !ingredientSearchMode.value && !pendingIngredientIds.value.length);
const showIngredientPersonalActions = computed(() => ingredientSourceFilter.value === "PERSONAL");
const pendingIngredientMap = computed(() => new Map(ingredients.value.map(item => [item.id, item])));
const pendingIngredients = computed(() => {
  return pendingIngredientIds.value
    .map(id => pendingIngredientMap.value.get(id))
    .filter((item): item is IngredientSummary => Boolean(item));
});
const pendingSelectedIngredients = computed(() => [...pendingIngredients.value].reverse());
const pendingIngredientAddCount = computed(() => {
  const existingIds = new Set(ingredientRows.value.map(item => item.ingredientId).filter(Boolean));
  return pendingIngredients.value.filter(item => !existingIds.has(item.id)).length;
});
const ingredientHintText = computed(() => {
  if (ingredientCreateVisible.value) {
    return ingredientCreateDraft.id
      ? "修改个人食材后会同步到当前菜谱里已选中的同一食材。"
      : "补充分类和默认单位，创建后可直接加入当前菜谱。";
  }
  return "建议优先选择主食材，再补充辅食材和配料。";
});
const sheetTitle = computed(() => {
  if (sheetMode.value === "ingredient") {
    if (ingredientCreateVisible.value) return ingredientCreateDraft.id ? "编辑食材" : "创建食材";
    return "选择食材";
  }
  if (sheetMode.value === "unit") return "选择单位";
  return "高级设置";
});
const sheetSubtitle = computed(() => {
  if (sheetMode.value === "unit") {
    return "优先选更明确的单位，如：克、毫升";
  }
  return "";
});
const sheetTitleTag = computed(() => {
  if (sheetMode.value !== "ingredient" || ingredientCreateVisible.value || !pendingIngredientAddCount.value) {
    return "";
  }
  return `新增 ${pendingIngredientAddCount.value} 项`;
});
const categoryIngredients = computed(() => {
  if (!ingredientUseWindowedList.value) return ingredientOptions.value;
  return ingredientOptions.value.slice(0, ingredientVisibleCount.value);
});
const searchedIngredients = computed(() => {
  if (ingredientSearchMode.value && !ingredientSearchReady.value) {
    return [];
  }
  return ingredientOptions.value;
});
const ingredientCreateCategoryName = computed(() => {
  return ingredientCategories.value.find(item => item.id === ingredientCreateDraft.categoryId)?.name || "";
});
const ingredientCreateUnitName = computed(() => {
  return units.value.find(item => item.id === ingredientCreateDraft.unitId)?.name || "";
});
const ingredientEmptyText = computed(() => {
  if (ingredientSourceFilter.value === "PERSONAL") {
    return "当前分类下还没有你的个人食材";
  }
  return "没有符合条件的食材";
});
const showIngredientEmptyCreate = computed(() => ingredientSourceFilter.value === "PERSONAL");
const ingredientFooterText = computed(() => {
  if (ingredientLoadingMore.value) return "加载中...";
  if (ingredientOptions.value.length) return "没有更多了";
  return "";
});
const ingredientPickerMainStyle = computed(() => {
  if (!ingredientPickerHeight.value) return undefined;
  return {
    height: `${ingredientPickerHeight.value}px`
  };
});
const activeUnitRow = computed(() => ingredientRows.value.find(item => item.localId === activeUnitRowId.value) || null);
const unitGroups = computed(() => {
  const groups = new Map<UnitSummary["type"], UnitSummary[]>();
  units.value.forEach(item => {
    const list = groups.get(item.type) || [];
    list.push(item);
    groups.set(item.type, list);
  });
  return (["WEIGHT", "VOLUME", "COMMON", "PACKAGE"] as const)
    .map(type => ({
      type,
      label: unitTypeLabelMap[type],
      items: groups.get(type) || []
    }))
    .filter(group => group.items.length > 0);
});
const difficultyText = computed(() => {
  return recipeDifficultyText(form.difficulty, "未设置");
});
const durationText = computed(() => {
  return recipeDurationText(form.duration, "未设置");
});
const advancedTotalCount = 5;
const advancedItems = computed(() => {
  const items: string[] = [];
  const categoryName = categories.value.find(item => item.id === form.categoryId)?.name;
  if (categoryName) {
    items.push(categoryName);
  }
  const inspirationCategoryName = inspirationCategories.value.find(item => item.id === form.inspirationCategoryId)?.name;
  if (inspirationCategoryName) {
    items.push(inspirationCategoryName);
  }
  if (form.baseServingsText.trim()) {
    items.push(`${form.baseServingsText.trim()} 人`);
  }
  const difficultyName = recipeDifficultyText(form.difficulty);
  if (difficultyName) {
    items.push(difficultyName);
  }
  if (form.duration) {
    items.push(durationText.value);
  }
  return items;
});
const advancedCountText = computed(() => `已设 ${advancedItems.value.length} / ${advancedTotalCount}`);
const advancedSummary = computed(() => {
  if (!advancedItems.value.length) {
		return "还没设置分类、系统分类、人数、难度和时长";
  }
  return advancedItems.value.join(" · ");
});
const showIngredientDragHandle = computed(() => ingredientRows.value.length > 1);
const ingredientDragging = computed(() => Boolean(ingredientDraggingId.value));
const ingredientGhostRow = computed(() => {
  return ingredientRows.value.find(item => item.localId === ingredientDraggingId.value) || null;
});
const ingredientGhostStyle = computed(() => ({
  top: `${ingredientGhostTop.value}px`,
  left: `${ingredientGhostLeft.value}px`,
  width: `${ingredientGhostWidth.value}px`
}));
const canGenerateRecipeAssistant = computed(() => Boolean(userStore.profile && userStore.profile.membership.tier !== "FREE"));

const showStepSortEntry = computed(() => stepRows.value.length > 1);
const stepSortDragging = computed(() => Boolean(stepSortDraggingId.value));
const stepSortCountText = computed(() => `${stepSortRows.value.length} 步`);
const stepSortGhostRow = computed(() => {
  return stepSortRows.value.find(item => item.localId === stepSortDraggingId.value) || null;
});
const stepSortGhostIndex = computed(() => {
  const index = stepSortRows.value.findIndex(item => item.localId === stepSortDraggingId.value);
  return index >= 0 ? index : 0;
});
const stepSortStyle = computed(() => ({
  top: `${navBarTotalHeight.value}px`
}));
const stepSortGhostStyle = computed(() => ({
  top: `${stepSortGhostTop.value}px`,
  left: `${stepSortCardLeft.value}px`,
  width: `${stepSortCardWidth.value}px`
}));

function parseQueryId(value: unknown): OptionalResourceId {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

onLoad((query) => {
  recipeId.value = parseQueryId(query?.recipeId);
  draftId.value = parseQueryId(query?.draftId);
  void loadPage();
});

function handleEditScroll(event: { detail?: { scrollTop?: number } }) {
  const scrollTop = event.detail?.scrollTop ?? 0;
  navOpacity.value = Math.max(0, Math.min(1, scrollTop / NAV_FADE_RANGE));
}

onHide(() => {
  flushRecipeEditCache();
});

onShow(() => {
  void consumeCropResult();
});

onUnload(() => {
  flushRecipeEditCache();
  clearRecipeEditCacheTimer();
  clearIngredientDragPressTimer();
  clearStepSortPressTimer();
  if (stepSortTimer) {
    clearTimeout(stepSortTimer);
    stepSortTimer = null;
  }
  if (ingredientSearchTimer) {
    clearTimeout(ingredientSearchTimer);
    ingredientSearchTimer = null;
  }
  clearCropQueue();
});

watch(
  [
    () => form.name,
	    () => form.story,
	    () => form.categoryId,
	    () => form.inspirationCategoryId,
	    () => [...form.sceneIds],
    () => coverUploadId.value,
    () => coverImageUrl.value,
    () => coverLocalImagePath.value,
    () => form.baseServingsText,
    () => form.difficulty,
    () => form.duration,
    () => form.tips,
    ingredientRows,
    stepRows
  ],
  () => {
    scheduleRecipeEditCachePersist();
  },
  { deep: true }
);

watch(
  () => ingredientKeyword.value,
  () => {
    if (sheetMode.value !== "ingredient" || ingredientCreateVisible.value) return;
    ingredientSearchPending.value = ingredientSearchMode.value;
    if (ingredientSearchTimer) {
      clearTimeout(ingredientSearchTimer);
    }
    ingredientSearchTimer = setTimeout(() => {
      ingredientSearchTimer = null;
      void reloadIngredientOptions();
    }, INGREDIENT_SEARCH_DEBOUNCE_MS);
  }
);

watch(
  [
    () => sheetMode.value,
    () => sheetVisible.value,
    () => ingredientCreateVisible.value,
    () => ingredientSearchMode.value,
    () => ingredientCategories.value.length
  ],
  () => {
    void syncIngredientPickerHeight();
  }
);

watch(
  () => sheetVisible.value,
  (visible) => {
    setPageLocked(visible || stepSortVisible.value || ingredientDragging.value);
  },
  { immediate: true }
);

watch(
  () => stepSortVisible.value,
  (visible) => {
    setPageLocked(sheetVisible.value || visible || ingredientDragging.value);
  }
);

watch(
  () => ingredientDragging.value,
  (visible) => {
    setPageLocked(sheetVisible.value || stepSortVisible.value || visible);
  }
);

function handleNameInput(event: Event) {
  form.name = readInputValue(event);
}

function handleStoryInput(event: Event) {
  form.story = readInputValue(event);
}

function handleFormFieldFocus() {
  formFieldFocused.value = true;
}

function handleFormFieldBlur() {
  formFieldFocused.value = false;
}

async function syncIngredientPickerHeight() {
  if (
    sheetMode.value !== "ingredient" ||
    !sheetVisible.value ||
    ingredientCreateVisible.value ||
    ingredientSearchMode.value ||
    !ingredientCategories.value.length
  ) {
    ingredientPickerHeight.value = 0;
    return;
  }

  await nextTick();
  const rect = await uniPlatform.system.measure("#ingredient-picker-side");
  ingredientPickerHeight.value = rect?.height ? Math.round(rect.height) : 0;
}

function handleLoginSuccess() {
  void loadPage();
}

function mergeUnits(nextItems: UnitSummary[]) {
  if (!nextItems.length) return;
  const unitMap = new Map(units.value.map(item => [item.id, item]));
  nextItems.forEach(item => {
    unitMap.set(item.id, item);
  });
  units.value = Array.from(unitMap.values());
}

function mergeIngredients(nextItems: IngredientSummary[]) {
  if (!nextItems.length) return;
  const ingredientMap = new Map(ingredients.value.map(item => [item.id, item]));
  nextItems.forEach(item => {
    ingredientMap.set(item.id, item);
  });
  ingredients.value = Array.from(ingredientMap.values());
  mergeUnits(nextItems.map(item => item.defaultUnit));
}

function updateIngredientOptions(nextItems: IngredientSummary[], reset: boolean) {
  if (reset) {
    ingredientOptions.value = nextItems;
    return;
  }

  const optionMap = new Map(ingredientOptions.value.map(item => [item.id, item]));
  nextItems.forEach(item => {
    optionMap.set(item.id, item);
  });
  ingredientOptions.value = Array.from(optionMap.values());
}

function applyEditRefs(ingredientItems: IngredientSummary[], unitItems: UnitSummary[], detail: Pick<RecipeDraftDetail, "ingredientRefs" | "unitRefs">) {
  ingredients.value = ingredientItems;
  ingredientOptions.value = ingredientItems;
  units.value = unitItems;
  mergeIngredients(detail.ingredientRefs);
  mergeUnits(detail.unitRefs);
  updateIngredientOptions(detail.ingredientRefs, false);
}

async function ensureAdvancedOptionsLoaded() {
  if (categoriesLoaded.value && inspirationCategoriesLoaded.value) return;
  if (advancedOptionsPromise) {
    await advancedOptionsPromise;
    return;
  }

  advancedOptionsPromise = Promise.all([
    categoriesLoaded.value ? Promise.resolve(categories.value) : recipeApi.listCategories(),
    inspirationCategoriesLoaded.value ? Promise.resolve(inspirationCategories.value) : recipeApi.listInspirationCategories()
  ])
    .then(([categoryList, inspirationCategoryList]) => {
      categories.value = categoryList;
      inspirationCategories.value = inspirationCategoryList;
      categoriesLoaded.value = true;
      inspirationCategoriesLoaded.value = true;
    })
    .finally(() => {
      advancedOptionsPromise = null;
    });

  await advancedOptionsPromise;
}

async function ensureIngredientCategoriesLoaded() {
  if (ingredientCategoriesLoaded.value) return;
  if (ingredientCategoryPromise) {
    await ingredientCategoryPromise;
    return;
  }

  ingredientCategoryPromise = recipeApi
    .listIngredientCategories()
    .then(result => {
      ingredientCategories.value = result;
      ingredientCategoriesLoaded.value = true;
    })
    .finally(() => {
      ingredientCategoryPromise = null;
    });

  await ingredientCategoryPromise;
}

async function ensureUnitsLoaded() {
  if (unitsLoaded.value) return;
  if (unitPromise) {
    await unitPromise;
    return;
  }

  unitPromise = recipeApi
    .listUnits({ page: 1, pageSize: 100, source: "SYSTEM" })
    .then(result => {
      mergeUnits(result.items);
      unitsLoaded.value = true;
    })
    .finally(() => {
      unitPromise = null;
    });

  await unitPromise;
}

function buildIngredientPageSize() {
  if (ingredientUseWindowedList.value) return INGREDIENT_ALL_PAGE_SIZE;
  return INGREDIENT_PAGE_SIZE;
}

function syncIngredientVisibleCount(reset: boolean) {
  if (!ingredientUseWindowedList.value) {
    ingredientVisibleCount.value = ingredientOptions.value.length;
    return;
  }
  if (reset) {
    ingredientVisibleCount.value = Math.min(INGREDIENT_ALL_PAGE_SIZE, ingredientOptions.value.length);
    return;
  }
  ingredientVisibleCount.value = Math.min(ingredientVisibleCount.value + INGREDIENT_ALL_REVEAL_STEP, ingredientOptions.value.length);
}

function revealMoreIngredientOptions() {
  if (!ingredientUseWindowedList.value) return false;
  if (ingredientVisibleCount.value >= ingredientOptions.value.length) return false;
  ingredientVisibleCount.value = Math.min(ingredientVisibleCount.value + INGREDIENT_ALL_REVEAL_STEP, ingredientOptions.value.length);
  return true;
}

function buildIngredientQuery(page: number) {
  const searchMode = ingredientSearchMode.value;
  return {
    page,
    pageSize: buildIngredientPageSize(),
    keyword: ingredientSearchText.value || undefined,
    categoryId: searchMode ? undefined : ingredientCategoryId.value || undefined,
    source: searchMode ? undefined : ingredientSourceFilter.value
  } as const;
}

async function loadIngredientOptionsPage(reset: boolean) {
  if (!reset && (ingredientLoading.value || ingredientLoadingMore.value || !ingredientHasNext.value)) return;

  const requestId = ingredientRequestSeed + 1;
  const queryKeyword = ingredientSearchText.value;
  ingredientRequestSeed = requestId;
  if (reset) {
    ingredientLoading.value = true;
  } else {
    ingredientLoadingMore.value = true;
  }

  try {
    const nextPage = reset ? 1 : ingredientPage.value + 1;
    const result = await recipeApi.listIngredients(buildIngredientQuery(nextPage));
    if (requestId !== ingredientRequestSeed) return;

    ingredientPage.value = result.page;
    ingredientHasNext.value = result.hasNext;
    ingredientLoadedKeyword.value = queryKeyword;
    ingredientSearchPending.value = ingredientSearchText.value !== queryKeyword;
    mergeIngredients(result.items);
    updateIngredientOptions(result.items, reset);
    syncIngredientVisibleCount(reset);
  } catch (error) {
    if (requestId === ingredientRequestSeed && ingredientSearchText.value === queryKeyword) {
      ingredientSearchPending.value = false;
    }
    throw error;
  } finally {
    if (requestId === ingredientRequestSeed) {
      ingredientLoading.value = false;
      ingredientLoadingMore.value = false;
    }
  }
}

async function reloadIngredientOptions(showError = true) {
  try {
    await loadIngredientOptionsPage(true);
    return true;
  } catch (error) {
    if (showError) {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "食材加载失败", icon: "none" });
    }
    return false;
  }
}

async function loadMoreIngredients() {
  try {
    if (revealMoreIngredientOptions()) return;
    await loadIngredientOptionsPage(false);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "食材加载失败", icon: "none" });
  }
}

async function loadPage() {
  if (loading.value) return;
  recipeEditCacheSuspended = true;
  clearRecipeEditCacheTimer();
  const draftSeed = !draftId.value && !recipeId.value ? recipePreviewStore.draftSeed : null;
  let usedDraftSeed = false;
  if (!sessionStore.restored) {
    await restoreAppSession();
  }
  if (!sessionStore.isLoggedIn) {
    errorText.value = "";
    resetRows();
    syncRecipeEditCacheBaseline();
    recipeEditCacheSuspended = false;
    return;
  }
  loading.value = true;
  errorText.value = "";
  try {
    if (draftId.value) {
      const [categoryList, ingredientCategoryList, ingredientResult, unitResult, draft] = await Promise.all([
        recipeApi.listCategories(),
        recipeApi.listIngredientCategories(),
        recipeApi.listIngredients({ page: 1, pageSize: 100 }),
        recipeApi.listUnits({ page: 1, pageSize: 100, source: "SYSTEM" }),
        recipeApi.getDraft(draftId.value)
      ]);
      categories.value = categoryList;
      ingredientCategories.value = ingredientCategoryList;
      applyEditRefs(ingredientResult.items, unitResult.items, draft);
      categoriesLoaded.value = true;
      ingredientCategoriesLoaded.value = true;
      unitsLoaded.value = true;
      fillFromDraft(draft);
    } else if (recipeId.value) {
      const [categoryList, ingredientCategoryList, ingredientResult, unitResult, recipe] = await Promise.all([
        recipeApi.listCategories(),
        recipeApi.listIngredientCategories(),
        recipeApi.listIngredients({ page: 1, pageSize: 100 }),
        recipeApi.listUnits({ page: 1, pageSize: 100, source: "SYSTEM" }),
        recipeApi.getMyRecipe(recipeId.value)
      ]);
      categories.value = categoryList;
      ingredientCategories.value = ingredientCategoryList;
      applyEditRefs(ingredientResult.items, unitResult.items, recipe);
      categoriesLoaded.value = true;
      ingredientCategoriesLoaded.value = true;
      unitsLoaded.value = true;
      fillFromRecipe(recipe);
    } else if (draftSeed?.content) {
      const [categoryList, ingredientCategoryList, ingredientResult, unitResult] = await Promise.all([
        recipeApi.listCategories(),
        recipeApi.listIngredientCategories(),
        recipeApi.listIngredients({ page: 1, pageSize: 100 }),
        recipeApi.listUnits({ page: 1, pageSize: 100, source: "SYSTEM" })
      ]);
      categories.value = categoryList;
      ingredientCategories.value = ingredientCategoryList;
      applyEditRefs(ingredientResult.items, unitResult.items, {
        ingredientRefs: [],
        unitRefs: []
      });
      categoriesLoaded.value = true;
      ingredientCategoriesLoaded.value = true;
      unitsLoaded.value = true;
      fillForm(draftSeed.content);
      recipePreviewStore.consumeDraftSeed();
      usedDraftSeed = true;
	    } else {
	      categories.value = [];
	      inspirationCategories.value = [];
	      ingredientCategories.value = [];
      ingredients.value = [];
      units.value = [];
	      categoriesLoaded.value = false;
	      inspirationCategoriesLoaded.value = false;
	      ingredientCategoriesLoaded.value = false;
	      unitsLoaded.value = false;
	      form.inspirationCategoryId = null;
	      advancedForm.inspirationCategoryId = null;
      ingredientOptions.value = [];
      ingredientPage.value = 1;
      ingredientHasNext.value = false;
      resetRows();
    }

    syncRecipeEditCacheBaseline();
    if (!usedDraftSeed) {
      await maybeRestoreRecipeEditCache();
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "页面加载失败";
  } finally {
    recipeEditCacheSuspended = false;
    loading.value = false;
  }
}

function fillFromDraft(draft: RecipeDraftDetail) {
  draftVersion.value = draft.version;
  recipeId.value = draft.recipeId || recipeId.value;
  fillForm(draft.content);
}

function fillFromRecipe(recipe: MyRecipeDetail) {
  recipeVersion.value = recipe.version;
  const content: RecipeDraftContentInput = {
    name: recipe.content.name,
    story: recipe.content.story,
    categoryId: recipe.category.id,
    inspirationCategoryId: recipe.inspirationCategory?.id ?? null,
    sceneIds: recipe.scenes.map(item => item.id),
    coverUploadId: null,
    coverImageUrl: recipe.coverImageUrl || null,
    baseServings: recipe.content.baseServings,
    difficulty: recipe.content.difficulty,
    duration: recipe.content.duration,
    tips: recipe.content.tips,
    ingredients: recipe.content.ingredients.map(item => ({
      ingredientId: item.ingredientId,
      name: item.ingredientName,
      quantity: item.amount.kind === "EXACT" ? item.amount.quantity : "",
      unitId: item.amount.kind === "EXACT" ? item.amount.unitId : null,
      fuzzyText: item.amount.kind === "FUZZY" ? item.amount.text : null,
      categoryId: item.categoryId,
      defaultUnitId: item.amount.kind === "EXACT" ? item.amount.unitId : null,
      source: item.source
    })),
    steps: recipe.content.steps.map(item => ({
      slotKey: nextSlotKey(),
      text: item.text,
      uploadId: null,
      imageUrl: item.imageUrl ?? null
    }))
  };
  fillForm(content);
}

function fillForm(content: RecipeDraftContentInput) {
  const ingredientMap = new Map(ingredients.value.map(item => [item.id, item]));
  form.name = content.name;
  form.story = content.story || "";
  form.categoryId = content.categoryId;
  form.inspirationCategoryId = content.inspirationCategoryId ?? null;
  form.sceneIds = [...content.sceneIds];
  originVersionId.value = content.originVersionId ?? null;
  originCoverImageUrl.value = content.originCoverImageUrl || "";
  coverUploadId.value = content.coverUploadId ?? null;
  coverImageUrl.value = content.coverImageUrl || "";
  coverLocalImagePath.value = "";
  form.baseServingsText = content.baseServings ? String(content.baseServings) : "";
  form.difficulty = content.difficulty;
  form.duration = content.duration;
  form.tips = content.tips || "";
  ingredientRows.value = content.ingredients.length
    ? content.ingredients.map(item =>
        createIngredientRow({
          ingredientId: item.ingredientId || "",
          name: item.name || (item.ingredientId ? ingredientMap.get(item.ingredientId)?.name || "" : ""),
          quantity: item.quantity,
          unitId: item.unitId || "",
          fuzzyText: item.fuzzyText || "",
          categoryId: item.categoryId || "",
          defaultUnitId: item.defaultUnitId || (item.ingredientId ? ingredientMap.get(item.ingredientId)?.defaultUnit.id || "" : ""),
          source: item.source || (item.ingredientId ? ingredientMap.get(item.ingredientId)?.source || "" : "")
        })
      )
    : [];
  stepRows.value = content.steps.length
    ? content.steps.map(item =>
        createStepRow({
          slotKey: item.slotKey,
          text: item.text,
          uploadId: item.uploadId ?? null,
          imageUrl: item.imageUrl || ""
        })
      )
    : [createStepRow()];
}

function resetRows() {
  originVersionId.value = null;
  originCoverImageUrl.value = "";
  coverUploadId.value = null;
  coverImageUrl.value = "";
  coverLocalImagePath.value = "";
  ingredientRows.value = [];
  stepRows.value = [createStepRow()];
}

function getStepImageSrc(row: StepRow) {
  return row.localImagePath || row.imageUrl || "";
}

function closeSheet() {
  if (!sheetMode.value) return;
  if (sheetMode.value === "advanced") {
    resetAdvancedDraft();
  }
  if (sheetMode.value === "ingredient") {
    resetIngredientCreate();
  }
  sheetVisible.value = false;
}

function openSheet(mode: SheetMode) {
  if (sheetMode.value) {
    sheetMode.value = mode;
    sheetVisible.value = true;
    return;
  }
  sheetMode.value = mode;
  sheetVisible.value = false;
  void nextTick(() => {
    sheetVisible.value = true;
  });
}

function handleSheetAfterClose() {
  sheetMode.value = "";
  activeUnitRowId.value = "";
}

async function openIngredientSheet() {
  ingredientKeyword.value = "";
  ingredientLoadedKeyword.value = "";
  ingredientSourceFilter.value = "ALL";
  ingredientCategoryId.value = "";
  ingredientPage.value = 1;
  ingredientHasNext.value = false;
  ingredientOptions.value = [];
  ingredientVisibleCount.value = 0;
  ingredientSearchPending.value = false;
  pendingIngredientIds.value = [];
  resetIngredientCreate();
  try {
    await ensureIngredientCategoriesLoaded();
    const loaded = await reloadIngredientOptions();
    if (!loaded) return;
    openSheet("ingredient");
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "食材加载失败", icon: "none" });
  }
}

async function openAdvancedSheet() {
  try {
    await ensureAdvancedOptionsLoaded();
    fillAdvancedDraft();
    openSheet("advanced");
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分类加载失败", icon: "none" });
  }
}

function openPreviewSheet() {
  recipePreviewStore.setPreview({
    title: form.name.trim() || "未命名菜谱",
    categoryName: categories.value.find(item => item.id === form.categoryId)?.name || null,
    sceneNames: [],
    coverImageUrl: currentCoverImage.value || null,
    content: {
      story: form.story.trim() || null,
      baseServings: form.baseServingsText.trim() ? Number(form.baseServingsText.trim()) : null,
      difficulty: form.difficulty,
      duration: form.duration,
      tips: form.tips.trim() || null,
      ingredients: buildFilledIngredientRows().map(row => {
        if (row.fuzzyText) {
          return {
            ingredientId: row.ingredientId,
            ingredientName: row.name.trim(),
            source: row.source,
            categoryId: row.categoryId,
            amount: {
              kind: "FUZZY" as const,
              text: row.fuzzyText
            }
          };
        }
        const unit = units.value.find(item => item.id === row.unitId);
        return {
          ingredientId: row.ingredientId,
          ingredientName: row.name.trim(),
          source: row.source,
          categoryId: row.categoryId,
          amount: {
            kind: "EXACT" as const,
            quantity: row.quantity.trim(),
            unitId: row.unitId,
            unitName: unit?.name || "",
            unitType: unit?.type
          }
        };
      }),
      steps: stepRows.value
        .filter(item => item.text.trim() || getStepImageSrc(item))
        .map(item => ({
          text: item.text.trim(),
          imageUrl: getStepImageSrc(item) || null
        }))
    }
  });
  void uniPlatform.navigation.navigateTo("/pages_recipe/detail/index?mode=preview");
}

function togglePendingIngredient(ingredientId: ResourceId) {
  dismissSheetKeyboard();
  if (pendingIngredientIds.value.includes(ingredientId)) {
    pendingIngredientIds.value = pendingIngredientIds.value.filter(item => item !== ingredientId);
    return;
  }
  pendingIngredientIds.value = [...pendingIngredientIds.value, ingredientId];
}

function removePendingIngredient(ingredientId: ResourceId) {
  pendingIngredientIds.value = pendingIngredientIds.value.filter(item => item !== ingredientId);
}

function dismissSheetKeyboard() {
  void uniPlatform.feedback.hideKeyboard().catch(() => undefined);
}

function exitIngredientSearch() {
  dismissSheetKeyboard();
  ingredientKeyword.value = "";
}

function isIngredientRecommendationPending(item: IngredientSummary) {
  return item.recommendationStatus === "PENDING";
}

function canEditIngredient(item: IngredientSummary) {
  return item.source === "PERSONAL" && item.recommendationStatus !== "PENDING";
}

function canRecommendIngredient(item: IngredientSummary) {
  return item.source === "PERSONAL" && item.recommendationStatus === null;
}

function showIngredientItemActions(item: IngredientSummary) {
  return showIngredientPersonalActions.value && item.source === "PERSONAL";
}

function changeIngredientCategory(categoryId: ResourceId) {
  dismissSheetKeyboard();
  ingredientCategoryId.value = ingredientCategoryId.value === categoryId ? "" : categoryId;
  void reloadIngredientOptions();
}

function clearIngredientCategory() {
  dismissSheetKeyboard();
  if (ingredientSourceFilter.value === "ALL" && !ingredientCategoryId.value) return;
  ingredientSourceFilter.value = "ALL";
  ingredientCategoryId.value = "";
  void reloadIngredientOptions();
}

function changeIngredientSourceFilter(source: "ALL" | "PERSONAL") {
  if (ingredientSourceFilter.value === source) {
    if (source !== "PERSONAL") return;
    ingredientSourceFilter.value = "ALL";
    void reloadIngredientOptions();
    return;
  }
  ingredientSourceFilter.value = source;
  void reloadIngredientOptions();
}

function startIngredientCreate() {
  const name = ingredientSearchText.value;
  dismissSheetKeyboard();
  ingredientCreateDraft.id = "";
  ingredientCreateDraft.version = null;
  ingredientCreateDraft.name = name;
  ingredientCreateDraft.categoryId = ingredientCategoryId.value || "";
  ingredientCreateDraft.unitId = "";
  ingredientCreateSection.value = "";
  ingredientCreateVisible.value = true;
}

function startIngredientEdit(item: IngredientSummary) {
  if (!canEditIngredient(item)) return;
  dismissSheetKeyboard();
  ingredientCreateDraft.id = item.id;
  ingredientCreateDraft.version = item.version;
  ingredientCreateDraft.name = item.name;
  ingredientCreateDraft.categoryId = item.categoryId;
  ingredientCreateDraft.unitId = item.defaultUnit.id;
  ingredientCreateSection.value = "";
  ingredientCreateVisible.value = true;
}

function cancelIngredientCreate() {
  resetIngredientCreate();
}

async function toggleIngredientCreateSection(section: "category" | "unit") {
  if (ingredientCreateSection.value === section) {
    ingredientCreateSection.value = "";
    return;
  }
  if (section === "unit") {
    try {
      await ensureUnitsLoaded();
    } catch (error) {
      await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "单位加载失败", icon: "none" });
      return;
    }
  }
  ingredientCreateSection.value = section;
}

function selectIngredientCreateCategory(categoryId: ResourceId) {
  ingredientCreateDraft.categoryId = ingredientCreateDraft.categoryId === categoryId ? "" : categoryId;
}

function selectIngredientCreateUnit(unitId: ResourceId) {
  ingredientCreateDraft.unitId = ingredientCreateDraft.unitId === unitId ? "" : unitId;
}

async function confirmIngredientSelection() {
  if (ingredientSearchMode.value) {
    exitIngredientSearch();
    return;
  }
  const additions = buildIngredientAdditions(pendingIngredients.value);
  if (!additions.length) {
    await uniPlatform.feedback.toast({ title: "所选食材已在列表中", icon: "none" });
    return;
  }
  ingredientRows.value = [...ingredientRows.value, ...additions];
  closeSheet();
}

async function confirmIngredientEditor() {
  const name = ingredientCreateDraft.name.trim();
  if (ingredientCreateSubmitting.value) return;
  if (!name) {
    await uniPlatform.feedback.toast({ title: "请输入食材名", icon: "none" });
    return;
  }
  if (!ingredientCreateDraft.categoryId) {
    await uniPlatform.feedback.toast({ title: "请选择分类", icon: "none" });
    return;
  }
  if (!ingredientCreateDraft.unitId) {
    await uniPlatform.feedback.toast({ title: "请选择单位", icon: "none" });
    return;
  }
  ingredientCreateSubmitting.value = true;
  try {
    if (ingredientCreateDraft.id && ingredientCreateDraft.version !== null) {
      const current = ingredients.value.find(item => item.id === ingredientCreateDraft.id) || null;
      const updated = await recipeApi.updateIngredient(ingredientCreateDraft.id, {
        operationId: createOperationId(),
        expectedVersion: ingredientCreateDraft.version,
        name,
        categoryId: ingredientCreateDraft.categoryId,
        defaultUnitId: ingredientCreateDraft.unitId
      });
      applyIngredientUpdate(updated, current?.defaultUnit.id || "");
      ingredientCategoryId.value = updated.categoryId;
      ingredientKeyword.value = "";
      resetIngredientCreate();
      await reloadIngredientOptions();
      await uniPlatform.feedback.toast({ title: "个人食材已更新", icon: "success" });
      return;
    }

    const created = await recipeApi.createIngredient({
      operationId: createOperationId(),
      name,
      categoryId: ingredientCreateDraft.categoryId,
      defaultUnitId: ingredientCreateDraft.unitId
    });
    applyIngredientUpdate(created);
    ingredientCategoryId.value = created.categoryId;
    pendingIngredientIds.value = Array.from(new Set([...pendingIngredientIds.value, created.id]));
    ingredientKeyword.value = "";
    resetIngredientCreate();
    await reloadIngredientOptions();
  } catch (error) {
    await uniPlatform.feedback.toast({
      title: error instanceof Error ? error.message : ingredientCreateDraft.id ? "更新食材失败" : "创建食材失败",
      icon: "none"
    });
  } finally {
    ingredientCreateSubmitting.value = false;
  }
}

async function recommendIngredient(item: IngredientSummary) {
  if (!canRecommendIngredient(item)) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "推荐入系统库",
    content: "推荐后会进入后台审核。审核中不能再编辑这份个人食材，仍可继续用于当前菜谱，并可在“我的推荐”查看结果。",
    confirmText: "确认",
    cancelText: "取消"
  }).catch(() => false);
  if (!confirmed) return;
  try {
    await recipeApi.recommendIngredient(item.id, {
      operationId: createOperationId()
    });
    applyIngredientUpdate({
      ...item,
      recommendationStatus: "PENDING"
    });
    await uniPlatform.feedback.toast({ title: "已提交推荐", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "推荐失败", icon: "none" });
  }
}

function fillAdvancedDraft() {
  advancedForm.categoryId = form.categoryId;
  advancedForm.inspirationCategoryId = form.inspirationCategoryId;
  advancedForm.sceneIds = [...form.sceneIds];
  advancedForm.baseServingsText = form.baseServingsText;
  advancedForm.difficulty = form.difficulty;
  advancedForm.duration = form.duration;
  advancedForm.tips = form.tips;
  resetAdvancedAuxState();
}

function resetAdvancedDraft() {
  advancedForm.categoryId = form.categoryId;
  advancedForm.inspirationCategoryId = form.inspirationCategoryId;
  advancedForm.sceneIds = [...form.sceneIds];
  advancedForm.baseServingsText = form.baseServingsText;
  advancedForm.difficulty = form.difficulty;
  advancedForm.duration = form.duration;
  advancedForm.tips = form.tips;
  resetAdvancedAuxState();
}

function resetAdvancedAuxState() {
	showCategoryCreator.value = false;
	showCustomBaseServings.value = shouldShowCustomBaseServings(advancedForm.baseServingsText);
	categoryDraftName.value = "";
	categorySubmitting.value = false;
}

function normalizeBaseServingsText(value: string) {
  const digits = String(value || "")
    .replace(/\D+/gu, "")
    .slice(0, 3);
  if (!digits) return "";
  const normalized = String(Math.min(20, Number(digits)));
  return normalized === "0" ? "" : normalized;
}

function shouldShowCustomBaseServings(value: string) {
  const normalized = normalizeBaseServingsText(value);
  return Boolean(normalized) && !baseServingsOptions.includes(normalized);
}

function toggleCategoryCreator() {
  showCategoryCreator.value = !showCategoryCreator.value;
  if (!showCategoryCreator.value) {
    categoryDraftName.value = "";
  }
}

async function createCategoryTag() {
  const name = categoryDraftName.value.trim();
  if (!name || categorySubmitting.value) return;
  if (name.length > 4) {
    await uniPlatform.feedback.toast({ title: "分类最多4个字", icon: "none" });
    return;
  }
  categorySubmitting.value = true;
  try {
    const category = await recipeApi.createCategory({
      operationId: createOperationId(),
      name
    });
    categories.value = [...categories.value, category];
    advancedForm.categoryId = category.id;
    markRecipeHomeDirty(["my"]);
    categoryDraftName.value = "";
    showCategoryCreator.value = false;
    await uniPlatform.feedback.toast({ title: "分类已添加", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "添加分类失败", icon: "none" });
  } finally {
    categorySubmitting.value = false;
  }
}

function openCustomBaseServings() {
  dismissSheetKeyboard();
  if (showCustomBaseServings.value) {
    showCustomBaseServings.value = false;
    advancedForm.baseServingsText = "";
    return;
  }
  showCustomBaseServings.value = true;
  advancedForm.baseServingsText = normalizeBaseServingsText(advancedForm.baseServingsText);
}

function selectBaseServingsOption(value: string) {
  dismissSheetKeyboard();
  showCustomBaseServings.value = false;
  advancedForm.baseServingsText = value;
}

function handleBaseServingsInput(event: Event) {
  const detail = (event as { detail?: { value?: string } }).detail;
  advancedForm.baseServingsText = normalizeBaseServingsText(detail?.value || "");
}

function toggleAdvancedDifficulty(value: RecipeDifficulty) {
  dismissSheetKeyboard();
  advancedForm.difficulty = advancedForm.difficulty === value ? null : value;
}

function toggleAdvancedDuration(value: RecipeDuration) {
  dismissSheetKeyboard();
  advancedForm.duration = advancedForm.duration === value ? null : value;
}

function applyAdvancedForm() {
  advancedForm.baseServingsText = normalizeBaseServingsText(advancedForm.baseServingsText);
  form.categoryId = advancedForm.categoryId;
  form.inspirationCategoryId = advancedForm.inspirationCategoryId;
  form.sceneIds = [...advancedForm.sceneIds];
  form.baseServingsText = advancedForm.baseServingsText;
  form.difficulty = advancedForm.difficulty;
  form.duration = advancedForm.duration;
  form.tips = advancedForm.tips;
  closeSheet();
}

function removeIngredientRow(localId: string) {
  ingredientRows.value = ingredientRows.value.filter(item => item.localId !== localId);
}

function clearIngredientDragPressTimer() {
  if (!ingredientDragPressTimer) return;
  clearTimeout(ingredientDragPressTimer);
  ingredientDragPressTimer = null;
}

function handleIngredientDragTouchStart(localId: string, event: Event) {
  if (!showIngredientDragHandle.value || ingredientDragging.value) return;
  dismissSheetKeyboard();

  const touchY = readTouchY(event);
  if (touchY === null) return;

  clearIngredientDragPressTimer();
  ingredientDragPressId = localId;
  ingredientDragPressTouchY = touchY;
  ingredientDragPressTimer = setTimeout(() => {
    ingredientDragPressTimer = null;
    void activateIngredientDrag(ingredientDragPressId, ingredientDragPressTouchY);
  }, INGREDIENT_DRAG_PRESS_DELAY_MS);
}

async function activateIngredientDrag(localId: string, touchY: number) {
  if (!showIngredientDragHandle.value || ingredientDragging.value) return;

  const [stackRect, rowRect] = await Promise.all([
    uniPlatform.system.measure("#ingredient-stack"),
    uniPlatform.system.measure(`#ingredient-row-${localId}`)
  ]);
  if (!rowRect) return;

  ingredientDraggingId.value = localId;
  ingredientStackTop.value = stackRect?.top ?? rowRect.top;
  ingredientGhostLeft.value = rowRect.left;
  ingredientGhostWidth.value = rowRect.width;
  ingredientRowHeight.value = rowRect.height;
  ingredientDragStartTouchY.value = touchY;
  ingredientDragStartTop.value = rowRect.top;
  ingredientGhostTop.value = rowRect.top;
}

function handleIngredientDragTouchMove(event: Event) {
  const touchY = readTouchY(event);
  if (!ingredientDragging.value) {
    if (touchY !== null && ingredientDragPressId && Math.abs(touchY - ingredientDragPressTouchY) > INGREDIENT_DRAG_PRESS_MOVE_PX) {
      clearIngredientDragPressTimer();
      ingredientDragPressId = "";
    }
    return;
  }

  const rowSpan = getIngredientRowSpan();
  if (touchY === null || !rowSpan) return;

  const minTop = ingredientStackTop.value;
  const maxTop = minTop + Math.max(0, (ingredientRows.value.length - 1) * rowSpan);
  const nextTop = clampNumber(
    ingredientDragStartTop.value + (touchY - ingredientDragStartTouchY.value),
    minTop,
    maxTop
  );
  ingredientGhostTop.value = nextTop;

  const currentIndex = ingredientRows.value.findIndex(item => item.localId === ingredientDraggingId.value);
  if (currentIndex < 0) return;

  const centerY = nextTop - ingredientStackTop.value + ingredientRowHeight.value / 2;
  const targetIndex = clampNumber(Math.floor(centerY / rowSpan), 0, ingredientRows.value.length - 1);
  if (targetIndex === currentIndex) return;

  ingredientRows.value = moveIngredientRow(ingredientRows.value, currentIndex, targetIndex);
}

function finishIngredientDrag() {
  clearIngredientDragPressTimer();
  ingredientDragPressId = "";
  ingredientDragPressTouchY = 0;
  if (!ingredientDragging.value) return;
  ingredientDraggingId.value = "";
  ingredientStackTop.value = 0;
  ingredientGhostTop.value = 0;
  ingredientGhostLeft.value = 0;
  ingredientGhostWidth.value = 0;
  ingredientRowHeight.value = 0;
  ingredientDragStartTouchY.value = 0;
  ingredientDragStartTop.value = 0;
}

function addStepRow() {
  stepRows.value = [...stepRows.value, createStepRow()];
}

function removeStepRow(localId: string) {
  if (stepRows.value.length === 1) {
    stepRows.value = [createStepRow()];
    return;
  }
  stepRows.value = stepRows.value.filter(item => item.localId !== localId);
}

async function openUnitSheet(localId: string) {
  activeUnitRowId.value = localId;
  try {
    await ensureUnitsLoaded();
    openSheet("unit");
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "单位加载失败", icon: "none" });
  }
}

function selectUnitOption(unitId: ResourceId) {
  const unit = units.value.find(item => item.id === unitId);
  const row = activeUnitRow.value;
  if (!unit || !row) return;
  row.unitId = unit.id;
  row.fuzzyText = "";
  if (!row.defaultUnitId) {
    row.defaultUnitId = unit.id;
  }
  closeSheet();
}

function handleQuantityInput(localId: string) {
  const row = ingredientRows.value.find(item => item.localId === localId);
  if (!row) return;
  row.fuzzyText = "";
}

function getRowUnitText(row: IngredientRow) {
  if (row.fuzzyText) return row.fuzzyText;
  return units.value.find(item => item.id === row.unitId)?.name || "";
}

function getRecipeEditCacheUid() {
  return sessionStore.uid > 0 ? sessionStore.uid : null;
}

function getRecipeEditCacheItemKey() {
  if (draftId.value) return String(draftId.value);
  if (recipeId.value) return String(recipeId.value);
  return RECIPE_EDIT_CACHE_KEY_NEW;
}

function getRecipeEditSourceVersion() {
  return draftVersion.value ?? recipeVersion.value ?? null;
}

function buildRecipeEditCachePayload(): Omit<RecipeEditCacheEntry, "savedAt"> {
  return {
    sourceVersion: getRecipeEditSourceVersion(),
    form: {
      name: form.name,
	      story: form.story,
	      categoryId: form.categoryId,
	      inspirationCategoryId: form.inspirationCategoryId,
	      sceneIds: [...form.sceneIds],
      coverUploadId: coverUploadId.value,
      coverImageUrl: coverImageUrl.value,
      coverLocalImagePath: coverLocalImagePath.value,
      baseServingsText: form.baseServingsText,
      difficulty: form.difficulty,
      duration: form.duration,
      tips: form.tips
    },
    ingredientRows: ingredientRows.value.map(row => ({
      ingredientId: row.ingredientId,
      name: row.name,
      quantity: row.quantity,
      unitId: row.unitId,
      fuzzyText: row.fuzzyText,
      categoryId: row.categoryId,
      defaultUnitId: row.defaultUnitId,
      source: row.source
    })),
    stepRows: stepRows.value.map(row => ({
      slotKey: row.slotKey,
      text: row.text,
      uploadId: row.uploadId,
      imageUrl: row.imageUrl,
      localImagePath: row.localImagePath
    }))
  };
}

function stringifyRecipeEditCachePayload(payload: Omit<RecipeEditCacheEntry, "savedAt">) {
  return JSON.stringify(payload);
}

function buildRecipeEditCacheFingerprint() {
  return stringifyRecipeEditCachePayload(buildRecipeEditCachePayload());
}

function syncRecipeEditCacheBaseline() {
  recipeEditCacheBaseline = buildRecipeEditCacheFingerprint();
}

function clearRecipeEditCacheTimer() {
  if (!recipeEditCacheTimer) return;
  clearTimeout(recipeEditCacheTimer);
  recipeEditCacheTimer = null;
}

function writeRecipeEditCache() {
  if (recipeEditCacheSuspended || loading.value) return;

  const uid = getRecipeEditCacheUid();
  if (!uid) return;

  const cacheItemKey = getRecipeEditCacheItemKey();
  const payload = buildRecipeEditCachePayload();
  const fingerprint = stringifyRecipeEditCachePayload(payload);
  if (fingerprint === recipeEditCacheBaseline) {
    removeRecipeEditCacheItem(uid, cacheItemKey);
    return;
  }

  writeRecipeEditCacheItem<RecipeEditCacheEntry>(uid, cacheItemKey, {
    ...payload,
    savedAt: new Date().toISOString()
  });
}

function scheduleRecipeEditCachePersist() {
  if (recipeEditCacheSuspended || loading.value) return;
  clearRecipeEditCacheTimer();
  recipeEditCacheTimer = setTimeout(() => {
    writeRecipeEditCache();
    recipeEditCacheTimer = null;
  }, RECIPE_EDIT_CACHE_DEBOUNCE_MS);
}

function flushRecipeEditCache() {
  clearRecipeEditCacheTimer();
  writeRecipeEditCache();
}

function removeCurrentRecipeEditCache(itemKey: string = getRecipeEditCacheItemKey()) {
  const uid = getRecipeEditCacheUid();
  if (!uid) return;
  removeRecipeEditCacheItem(uid, itemKey);
}

function applyRecipeEditCacheEntry(entry: RecipeEditCacheEntry) {
  form.name = entry.form.name;
	  form.story = entry.form.story;
	  form.categoryId = entry.form.categoryId;
	  form.inspirationCategoryId = entry.form.inspirationCategoryId;
	  form.sceneIds = [...entry.form.sceneIds];
  coverUploadId.value = entry.form.coverUploadId;
  coverImageUrl.value = entry.form.coverImageUrl;
  coverLocalImagePath.value = entry.form.coverLocalImagePath;
  form.baseServingsText = entry.form.baseServingsText;
  form.difficulty = entry.form.difficulty;
  form.duration = entry.form.duration;
  form.tips = entry.form.tips;
  ingredientRows.value = entry.ingredientRows.map(row => createIngredientRow(row));
  stepRows.value = entry.stepRows.length ? entry.stepRows.map(row => createStepRow(row)) : [createStepRow()];
}

function formatRecipeEditCacheSavedAt(savedAt: string) {
  const time = Date.parse(savedAt);
  if (Number.isNaN(time)) return "";

  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

async function maybeRestoreRecipeEditCache() {
  const uid = getRecipeEditCacheUid();
  if (!uid) return;

  const cacheItemKey = getRecipeEditCacheItemKey();
  if (recipeId.value) {
    removeRecipeEditCacheItem(uid, cacheItemKey);
    return;
  }
  const entry = readRecipeEditCacheItem<RecipeEditCacheEntry>(uid, cacheItemKey);
  if (!entry) return;

  const savedAtText = formatRecipeEditCacheSavedAt(entry.savedAt);
  const currentVersion = getRecipeEditSourceVersion();
  const isSameVersion = entry.sourceVersion === currentVersion;
  const content = isSameVersion
    ? `${savedAtText ? `发现 ${savedAtText} 的` : "发现"}未保存内容，是否恢复？`
    : `${savedAtText ? `发现 ${savedAtText} 的` : "发现"}未保存内容，但当前服务端内容已变化，仍要恢复本地内容吗？`;

  const shouldRestore = await uniPlatform.feedback.confirm({
    title: "恢复上次内容",
    content,
    confirmText: "恢复",
    cancelText: "丢弃"
  }).catch(() => false);

  if (!shouldRestore) {
    removeRecipeEditCacheItem(uid, cacheItemKey);
    return;
  }

  applyRecipeEditCacheEntry(entry);
}

async function saveDraft() {
  if (submitting.value) return;
  if (!form.name.trim()) {
    await uniPlatform.feedback.toast({ title: "请填写菜谱标题", icon: "none" });
    return;
  }
  const cacheItemKey = getRecipeEditCacheItemKey();
  submitting.value = true;
  try {
    await syncDraftForSubmit();
    removeCurrentRecipeEditCache(cacheItemKey);
    removeCurrentRecipeEditCache();
    syncRecipeEditCacheBaseline();
    markRecipeManageDirty(["drafts"]);
    await uniPlatform.feedback.toast({ title: "草稿已保存", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function publishDraft() {
  if (submitting.value) return;
  const cacheItemKey = getRecipeEditCacheItemKey();
  if (!(await validatePublishForm())) return;
  submitting.value = true;
  try {
    await syncDraftForSubmit();
    const result = await recipeApi.publishDraft(draftId.value as ResourceId, {
      operationId: createOperationId(),
      expectedVersion: draftVersion.value as number
    });
    removeCurrentRecipeEditCache(cacheItemKey);
    removeCurrentRecipeEditCache();
    markRecipeHomeDirty(["my"]);
    markRecipeManageDirty(["recipes", "drafts"]);
    await uniPlatform.feedback.toast({ title: "已发布", icon: "success" });
    await maybeGenerateRecipeAssistantAfterPublish(result.recipe.id, Boolean(result.recipe.assistant?.steps.length));
    void uniPlatform.navigation.redirectTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(result.recipe.id))}&kind=my`);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "发布失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function maybeGenerateRecipeAssistantAfterPublish(targetRecipeId: ResourceId, hasAssistant: boolean) {
  if (hasAssistant || !canGenerateRecipeAssistant.value) return;
  const shouldGenerate = await uniPlatform.feedback.confirm({
    title: "生成做饭建议",
    content: "菜谱已发布，是否现在整理一份做饭建议？你也可以稍后再生成。",
    confirmText: "立即生成",
    cancelText: "稍后再说",
    maskClosable: false
  });
  if (!shouldGenerate) return;
  try {
    await recipeApi.generateMyRecipeAssistant(targetRecipeId, {
      operationId: createOperationId()
    });
    await uniPlatform.feedback.toast({ title: "做饭建议已生成", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "生成失败，稍后可再试", icon: "none" });
  }
}

function hasPendingLocalImages() {
  return Boolean(coverLocalImagePath.value || stepRows.value.some(item => item.localImagePath));
}

async function applyCropResult(result: ImageCropResult, target: CropTarget) {
  if (!result.croppedPath) return;
  if (target.kind === "cover") {
    const previousLocalPath = coverLocalImagePath.value;
    coverUploadId.value = null;
    coverImageUrl.value = "";
    if (previousLocalPath) {
      coverLocalImagePath.value = "";
      await nextTick();
    }
    coverLocalImagePath.value = result.croppedPath;
    if (previousLocalPath && previousLocalPath !== result.croppedPath) {
      releaseImageFile(previousLocalPath);
    }
    return;
  }

  const currentRow = stepRows.value.find(item => item.localId === target.localId);
  const previousLocalPath = currentRow?.localImagePath || "";
  if (
    patchStepRow(target.localId, {
      uploadId: null,
      imageUrl: "",
      localImagePath: previousLocalPath ? "" : result.croppedPath
    })
  ) {
    if (previousLocalPath) {
      await nextTick();
      patchStepRow(target.localId, {
        uploadId: null,
        imageUrl: "",
        localImagePath: result.croppedPath
      });
      if (previousLocalPath !== result.croppedPath) {
        releaseImageFile(previousLocalPath);
      }
    }
    return;
  }

  if (target.appendIfMissing) {
    stepRows.value = [
      ...stepRows.value,
      createStepRow({
        text: "",
        uploadId: null,
        imageUrl: "",
        localImagePath: result.croppedPath
      })
    ];
  }
}

async function selectCoverImage() {
  try {
    const [file] = await uniPlatform.media.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"]
    });
    if (!file?.path) return;
    queueCrop({
      sourcePath: file.path,
      policy: imageCropPresets.recipeCover,
      target: {
        kind: "cover"
      }
    });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "选择封面图失败", icon: "none" });
  }
}

function clearCoverImage() {
  releaseImageFile(coverLocalImagePath.value);
  coverUploadId.value = null;
  coverImageUrl.value = "";
  coverLocalImagePath.value = "";
}

async function selectStepImage(localId: string) {
  const row = stepRows.value.find(item => item.localId === localId);
  if (!row) return;
  try {
    const [file] = await uniPlatform.media.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"]
    });
    if (!file?.path) return;
    queueCrop({
      sourcePath: file.path,
      policy: imageCropPresets.recipeStep,
      target: {
        kind: "step",
        localId: row.localId,
        appendIfMissing: false
      }
    });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "选择步骤图失败", icon: "none" });
  }
}

function clearStepImage(localId: string) {
  const row = stepRows.value.find(item => item.localId === localId);
  releaseImageFile(row?.localImagePath || "");
  patchStepRow(localId, {
    uploadId: null,
    imageUrl: "",
    localImagePath: ""
  });
}

async function handleStepImages() {
  try {
    const files = await uniPlatform.media.chooseMedia({
      count: 9,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"]
    });
    if (!files.length) return;
    queueCrops(
      files
        .filter(file => file.path)
        .map(file => ({
          sourcePath: file.path,
          policy: imageCropPresets.recipeStep,
          target: {
            kind: "step" as const,
            localId: "",
            appendIfMissing: true
          }
        }))
    );
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "选择步骤图失败", icon: "none" });
  }
}

async function uploadPendingImages() {
  if (!draftId.value) return;

  if (coverLocalImagePath.value) {
    const localCoverPath = coverLocalImagePath.value;
    const result = await recipeApi.uploadRecipeImage({
      operationId: createOperationId(),
      draftId: draftId.value,
      scene: "RECIPE_COVER" satisfies UploadAssetScene,
      slotKey: "cover",
      filePath: localCoverPath
    });
    coverUploadId.value = result.upload.id;
    coverImageUrl.value = result.upload.imageUrl;
    coverLocalImagePath.value = "";
    releaseImageFile(localCoverPath);
  }

  for (const row of stepRows.value) {
    const localImagePath = row.localImagePath;
    if (!localImagePath) continue;
    const result = await recipeApi.uploadRecipeImage({
      operationId: createOperationId(),
      draftId: draftId.value,
      scene: "RECIPE_STEP" satisfies UploadAssetScene,
      slotKey: row.slotKey,
      filePath: localImagePath
    });
    patchStepRow(row.localId, {
      uploadId: result.upload.id,
      imageUrl: result.upload.imageUrl,
      localImagePath: ""
    });
    releaseImageFile(localImagePath);
  }
}

async function syncDraftForSubmit() {
  const hadDraft = Boolean(draftId.value && draftVersion.value !== null);
  if (!hadDraft) {
    const content = await buildDraftContent();
    const created = await recipeApi.createDraft({
      operationId: createOperationId(),
      recipeId: recipeId.value || null,
      content
    });
    draftId.value = created.id;
    draftVersion.value = created.version;
  }

  const shouldUpload = hasPendingLocalImages();
  if (shouldUpload) {
    await uploadPendingImages();
  }

  if (!hadDraft && !shouldUpload) {
    return;
  }

  const content = await buildSaveContent();
  const updated = await recipeApi.updateDraft(draftId.value as ResourceId, {
    operationId: createOperationId(),
    expectedVersion: draftVersion.value as number,
    content
  });
  draftVersion.value = updated.version;
}

async function openStepSort() {
  if (stepRows.value.length <= 1) return;
  dismissSheetKeyboard();
  if (stepSortTimer) {
    clearTimeout(stepSortTimer);
    stepSortTimer = null;
  }
  stepSortRows.value = stepRows.value.map(cloneStepRow);
  stepSortDraggingId.value = "";
  stepSortScrollTop.value = 0;
  stepSortVisible.value = true;
  stepSortOpen.value = false;
  await nextTick();
  stepSortOpen.value = true;
}

function cancelStepSort() {
  closeStepSort();
}

function confirmStepSort() {
  if (stepSortRows.value.length) {
    stepRows.value = stepSortRows.value.map(cloneStepRow);
  }
  closeStepSort();
}

function closeStepSort() {
  stepSortOpen.value = false;
  resetStepSortDrag();
  if (stepSortTimer) {
    clearTimeout(stepSortTimer);
  }
  stepSortTimer = setTimeout(() => {
    stepSortVisible.value = false;
    stepSortRows.value = [];
    stepSortScrollTop.value = 0;
    stepSortTimer = null;
  }, SHEET_ANIMATION_MS);
}

function resetStepSortDrag() {
  clearStepSortPressTimer();
  stepSortPressId = "";
  stepSortPressTouchY = 0;
  stepSortDraggingId.value = "";
  stepSortGhostTop.value = 0;
  stepSortStartTouchY.value = 0;
  stepSortStartCardTop.value = 0;
}

function clearStepSortPressTimer() {
  if (!stepSortPressTimer) return;
  clearTimeout(stepSortPressTimer);
  stepSortPressTimer = null;
}

function handleStepSortScroll(event: Event) {
  const detail = (event as Event & { detail?: { scrollTop?: number } }).detail;
  stepSortScrollTop.value = Number(detail?.scrollTop || 0);
}

function handleStepSortTouchStart(localId: string, event: Event) {
  if (stepSortDragging.value) return;
  const touchY = readTouchY(event);
  if (touchY === null) return;
  clearStepSortPressTimer();
  stepSortPressId = localId;
  stepSortPressTouchY = touchY;
  stepSortPressTimer = setTimeout(() => {
    stepSortPressTimer = null;
    void activateStepSortDrag(stepSortPressId, stepSortPressTouchY);
  }, STEP_SORT_PRESS_DELAY_MS);
}

async function activateStepSortDrag(localId: string, touchY: number) {
  if (!stepSortVisible.value) return;
  const index = stepSortRows.value.findIndex(item => item.localId === localId);
  if (index < 0) return;

  const [scrollRect, rowRect] = await Promise.all([
    uniPlatform.system.measure("#step-sort-scroll"),
    uniPlatform.system.measure(`#step-sort-card-${localId}`)
  ]);
  if (scrollRect) {
    stepSortListTop.value = scrollRect.top;
  }
  stepSortDraggingId.value = localId;
  stepSortCardLeft.value = rowRect?.left ?? stepSortCardLeft.value;
  stepSortCardWidth.value = rowRect?.width ?? stepSortCardWidth.value;
  stepSortCardHeight.value = rowRect?.height ?? stepSortCardHeight.value;
  const rowSpan = getStepSortRowSpan();
  if (!rowSpan) {
    resetStepSortDrag();
    return;
  }
  const fallbackTop = stepSortListTop.value - stepSortScrollTop.value + index * rowSpan;
  stepSortStartTouchY.value = touchY;
  stepSortStartCardTop.value = rowRect?.top ?? fallbackTop;
  stepSortGhostTop.value = rowRect?.top ?? fallbackTop;
}

function handleStepSortTouchMove(event: Event) {
  const touchY = readTouchY(event);
  if (!stepSortDragging.value) {
    if (touchY !== null && stepSortPressId && Math.abs(touchY - stepSortPressTouchY) > STEP_SORT_PRESS_MOVE_PX) {
      clearStepSortPressTimer();
      stepSortPressId = "";
    }
    return;
  }

  const rowSpan = getStepSortRowSpan();
  if (touchY === null || !rowSpan) return;

  const minTop = stepSortListTop.value - stepSortScrollTop.value;
  const maxTop = minTop + Math.max(0, (stepSortRows.value.length - 1) * rowSpan);
  const nextTop = clampNumber(
    stepSortStartCardTop.value + (touchY - stepSortStartTouchY.value),
    minTop,
    maxTop
  );
  stepSortGhostTop.value = nextTop;

  const currentIndex = stepSortRows.value.findIndex(item => item.localId === stepSortDraggingId.value);
  if (currentIndex < 0) return;

  const centerY = nextTop - stepSortListTop.value + stepSortScrollTop.value + stepSortCardHeight.value / 2;
  const targetIndex = clampNumber(Math.floor(centerY / rowSpan), 0, stepSortRows.value.length - 1);
  if (targetIndex === currentIndex) return;

  stepSortRows.value = moveStepRow(stepSortRows.value, currentIndex, targetIndex);
}

function finishStepSortDrag() {
  clearStepSortPressTimer();
  stepSortPressId = "";
  if (!stepSortDragging.value) return;
  resetStepSortDrag();
}

async function validatePublishForm() {
  if (!form.name.trim()) {
    await uniPlatform.feedback.toast({ title: "请填写菜谱标题", icon: "none" });
    return false;
  }
  if (!form.categoryId) {
    await uniPlatform.feedback.toast({ title: "请选择分类", icon: "none" });
    return false;
  }
  if (!form.baseServingsText.trim()) {
    await uniPlatform.feedback.toast({ title: "请选择人数", icon: "none" });
    return false;
  }
  if (Number(form.baseServingsText) < 1 || Number(form.baseServingsText) > 20) {
    await uniPlatform.feedback.toast({ title: "人数需在 1-20 之间", icon: "none" });
    return false;
  }
  if (!form.difficulty) {
    await uniPlatform.feedback.toast({ title: "请选择难度", icon: "none" });
    return false;
  }
  if (!form.duration) {
    await uniPlatform.feedback.toast({ title: "请选择时长", icon: "none" });
    return false;
  }
  if (!buildFilledIngredientRows().length) {
    await uniPlatform.feedback.toast({ title: "请至少添加一个食材", icon: "none" });
    return false;
  }
  if (!stepRows.value.some(item => item.text.trim() || getStepImageSrc(item))) {
    await uniPlatform.feedback.toast({ title: "请至少填写一个步骤", icon: "none" });
    return false;
  }
  return true;
}

async function buildDraftContent(): Promise<RecipeDraftContentInput> {
  const rows = buildFilledIngredientRows();
  await buildIngredients();
  return {
    name: form.name.trim(),
    story: form.story.trim() || null,
    categoryId: form.categoryId || null,
    inspirationCategoryId: form.inspirationCategoryId || null,
    sceneIds: [...form.sceneIds],
    originVersionId: originVersionId.value,
    originCoverImageUrl: originCoverImageUrl.value || null,
    coverUploadId: coverUploadId.value,
    coverImageUrl: coverImageUrl.value || null,
    baseServings: form.baseServingsText ? Number(form.baseServingsText) : null,
    difficulty: form.difficulty,
    duration: form.duration,
    tips: form.tips.trim() || null,
    ingredients: rows.map(row => ({
      ingredientId: row.ingredientId || null,
      name: row.name.trim(),
      quantity: row.quantity.trim(),
      unitId: row.unitId || null,
      fuzzyText: row.fuzzyText || null,
      categoryId: row.categoryId || null,
      defaultUnitId: row.defaultUnitId || null,
      source: row.source || null
    })),
    steps: buildStepItems()
  };
}

async function buildSaveContent(): Promise<RecipeDraftContentInput> {
  return {
    name: form.name.trim(),
    story: form.story.trim() || null,
    categoryId: form.categoryId || null,
    inspirationCategoryId: form.inspirationCategoryId || null,
    sceneIds: [...form.sceneIds],
    originVersionId: originVersionId.value,
    originCoverImageUrl: originCoverImageUrl.value || null,
    coverUploadId: coverUploadId.value,
    coverImageUrl: coverImageUrl.value || null,
    baseServings: form.baseServingsText ? Number(form.baseServingsText) : null,
    difficulty: form.difficulty,
    duration: form.duration,
    tips: form.tips.trim() || null,
    ingredients: await buildSaveIngredients(),
    steps: buildStepItems()
  };
}

function buildStepItems() {
  return stepRows.value
    .filter(item => item.text.trim() || getStepImageSrc(item))
    .map(item => ({
      slotKey: item.slotKey,
      text: item.text.trim(),
      uploadId: item.uploadId || null,
      imageUrl: item.imageUrl || null
    }));
}

async function buildSaveIngredients(): Promise<RecipeDraftIngredientInput[]> {
  const rows = buildFilledIngredientRows();
  const result: RecipeDraftIngredientInput[] = [];

  for (const row of rows) {
    result.push({
      ingredientId: row.ingredientId || null,
      name: row.name.trim(),
      quantity: row.quantity.trim(),
      unitId: row.unitId || null,
      fuzzyText: row.fuzzyText || null,
      categoryId: row.categoryId || null,
      defaultUnitId: row.defaultUnitId || null,
      source: row.source || null
    });
  }

  return result;
}

async function buildIngredients(): Promise<RecipeIngredientInput[]> {
  const createdMap = new Map<string, IngredientSummary>();
  const rows = buildFilledIngredientRows();
  const result: RecipeIngredientInput[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const ingredientId = await ensureIngredientRow(row, index, createdMap);
    if (row.fuzzyText) {
      result.push({
        ingredientId,
        amount: {
          kind: "FUZZY",
          text: row.fuzzyText
        }
      });
      continue;
    }

    const quantity = row.quantity.trim();
    if (!quantity) {
      throw new Error(`请填写第 ${index + 1} 个食材的数量`);
    }
    if (!row.unitId) {
      throw new Error(`请选择第 ${index + 1} 个食材的单位`);
    }
    result.push({
      ingredientId,
      amount: {
        kind: "EXACT",
        quantity,
        unitId: row.unitId
      }
    });
  }

  return result;
}

async function ensureIngredientRow(
  row: IngredientRow,
  index: number,
  createdMap: Map<string, IngredientSummary>
): Promise<ResourceId> {
  const name = row.name.trim();
  if (!name) {
    throw new Error(`请填写第 ${index + 1} 个食材名称`);
  }

  const matched = await findIngredientByName(name, row.ingredientId);
  if (matched) {
    row.ingredientId = matched.id;
    row.categoryId = matched.categoryId;
    row.defaultUnitId = matched.defaultUnit.id;
    row.source = matched.source;
    return matched.id;
  }

  if (!row.categoryId) {
    throw new Error(`请重新选择第 ${index + 1} 个食材`);
  }
  const defaultUnitId = row.unitId || row.defaultUnitId;
  if (!defaultUnitId) {
    throw new Error(`请选择第 ${index + 1} 个食材的单位`);
  }

  const cacheKey = `${normalizeText(name)}:${row.categoryId}:${defaultUnitId}`;
  let created = createdMap.get(cacheKey);
  if (!created) {
    created = await recipeApi.createIngredient({
      operationId: createOperationId(),
      name,
      categoryId: row.categoryId,
      defaultUnitId
    });
    createdMap.set(cacheKey, created);
  }
  applyIngredientUpdate(created);

  row.ingredientId = created.id;
  row.categoryId = created.categoryId;
  row.defaultUnitId = created.defaultUnit.id;
  row.source = created.source;
  return created.id;
}

function buildFilledIngredientRows() {
  return ingredientRows.value.filter(item => {
    return Boolean(item.name.trim() || item.quantity.trim() || item.unitId || item.fuzzyText);
  });
}

function buildIngredientAdditions(list: IngredientSummary[]) {
  const existingIds = new Set(ingredientRows.value.map(item => item.ingredientId).filter(Boolean));
  return list
    .filter(item => !existingIds.has(item.id))
    .map(item =>
      createIngredientRow({
        ingredientId: item.id,
        name: item.name,
        quantity: "",
        unitId: item.defaultUnit.id,
        fuzzyText: "",
        categoryId: item.categoryId,
        defaultUnitId: item.defaultUnit.id,
        source: item.source
      })
    );
}

function applyIngredientUpdate(updated: IngredientSummary, previousDefaultUnitId: OptionalResourceId = "") {
  mergeIngredients([updated]);
  if (matchesCurrentIngredientFilter(updated)) {
    ingredientOptions.value = [updated, ...ingredientOptions.value.filter(item => item.id !== updated.id)];
  } else {
    ingredientOptions.value = ingredientOptions.value.filter(item => item.id !== updated.id);
  }
  ingredientRows.value.forEach(row => {
    if (row.ingredientId !== updated.id) return;
    row.name = updated.name;
    row.categoryId = updated.categoryId;
    row.source = updated.source;
    row.defaultUnitId = updated.defaultUnit.id;
    if (previousDefaultUnitId && row.unitId === previousDefaultUnitId) {
      row.unitId = updated.defaultUnit.id;
    }
  });
}

function createIngredientRow(partial: Partial<Omit<IngredientRow, "localId">> = {}): IngredientRow {
  return {
    localId: nextLocalId("ingredient"),
    ingredientId: partial.ingredientId || "",
    name: partial.name || "",
    quantity: partial.quantity || "",
    unitId: partial.unitId || "",
    fuzzyText: partial.fuzzyText || "",
    categoryId: partial.categoryId || "",
    defaultUnitId: partial.defaultUnitId || "",
    source: partial.source || ""
  };
}

function matchesCurrentIngredientFilter(item: IngredientSummary) {
  if (!ingredientSearchMode.value) {
    if (ingredientSourceFilter.value === "PERSONAL" && item.source !== "PERSONAL") return false;
    if (ingredientCategoryId.value && item.categoryId !== ingredientCategoryId.value) return false;
  }
  const keyword = normalizeText(ingredientSearchText.value);
  if (keyword && !normalizeText(item.name).includes(keyword)) return false;
  return true;
}

async function findIngredientByName(name: string, currentId: OptionalResourceId) {
  const searchKey = normalizeText(name);
  if (!searchKey) return null;
  const current = ingredients.value.find(item => item.id === currentId && normalizeText(item.name) === searchKey);
  if (current) return current;
  const personal = ingredients.value.find(item => item.source === "PERSONAL" && normalizeText(item.name) === searchKey);
  if (personal) return personal;
  const local = ingredients.value.find(item => normalizeText(item.name) === searchKey);
  if (local) return local;

  const result = await recipeApi.listIngredients({
    page: 1,
    pageSize: 50,
    keyword: name,
    source: "ALL"
  });
  mergeIngredients(result.items);
  return result.items.find(item => normalizeText(item.name) === searchKey) || null;
}

function resetIngredientCreate() {
  ingredientCreateVisible.value = false;
  ingredientCreateSubmitting.value = false;
  ingredientCreateSection.value = "";
  ingredientCreateDraft.id = "";
  ingredientCreateDraft.version = null;
  ingredientCreateDraft.name = "";
  ingredientCreateDraft.categoryId = "";
  ingredientCreateDraft.unitId = "";
}

function createStepRow(partial: Partial<Omit<StepRow, "localId">> = {}): StepRow {
  return {
    localId: nextLocalId("step"),
    slotKey: partial.slotKey || nextSlotKey(),
    text: partial.text || "",
    uploadId: partial.uploadId ?? null,
    imageUrl: partial.imageUrl || "",
    localImagePath: partial.localImagePath || ""
  };
}

function cloneStepRow(row: StepRow): StepRow {
  return {
    localId: row.localId,
    slotKey: row.slotKey,
    text: row.text,
    uploadId: row.uploadId,
    imageUrl: row.imageUrl,
    localImagePath: row.localImagePath
  };
}

function patchStepRow(localId: string, patch: Partial<Omit<StepRow, "localId">>) {
  const index = stepRows.value.findIndex(item => item.localId === localId);
  if (index < 0) return false;
  const next = [...stepRows.value];
  next[index] = {
    ...next[index],
    ...patch
  };
  stepRows.value = next;
  return true;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function readInputValue(event: Event) {
  const payload = event as Event & { detail?: { value?: string } };
  return payload.detail?.value ?? "";
}

function readTouchY(event: Event) {
  const payload = event as Event & {
    touches?: Array<{ pageY?: number; clientY?: number }>;
    changedTouches?: Array<{ pageY?: number; clientY?: number }>;
  };
  const touch = payload.touches?.[0] || payload.changedTouches?.[0];
  if (!touch) return null;
  return touch.pageY ?? touch.clientY ?? null;
}

function moveStepRow(rows: StepRow[], fromIndex: number, toIndex: number) {
  const nextRows = [...rows];
  const [current] = nextRows.splice(fromIndex, 1);
  if (!current) return rows;
  nextRows.splice(toIndex, 0, current);
  return nextRows;
}

function moveIngredientRow(rows: IngredientRow[], fromIndex: number, toIndex: number) {
  const nextRows = [...rows];
  const [current] = nextRows.splice(fromIndex, 1);
  if (!current) return rows;
  nextRows.splice(toIndex, 0, current);
  return nextRows;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getIngredientRowSpan() {
  if (!ingredientRowHeight.value) return 0;
  return ingredientRowHeight.value + rpxToPx(INGREDIENT_DRAG_GAP_RPX);
}

function getStepSortRowSpan() {
  if (!stepSortCardHeight.value) return 0;
  return stepSortCardHeight.value + rpxToPx(STEP_SORT_GAP_RPX);
}

function rpxToPx(value: number) {
  const width = systemInfo.value.windowWidth || 375;
  return width * value / 750;
}

function formatStepIndex(index: number) {
  return String(index + 1).padStart(2, "0");
}

function getStepSortText(text: string) {
  const content = text.trim();
  return content || "未填写步骤说明";
}

function nextLocalId(prefix: string) {
  rowSeed += 1;
  return `${prefix}-${rowSeed}`;
}

function nextSlotKey() {
  return nextLocalId("slot");
}
</script>

<style scoped lang="scss">
.edit-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--entry-board-bg);
}

.edit-scroll {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.edit-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  background: var(--color-page);
  pointer-events: none;
  transition: opacity 160ms ease;
}

.edit-nav-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.edit-nav-action {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.edit-nav-action--disabled {
  opacity: 0.42;
}

.panel__tools {
  display: flex;
  align-items: center;
  gap: 40rpx;
  flex-shrink: 0;
}

.hero {
  padding: 0;
}

.hero__cover {
  position: relative;
  overflow: hidden;
  border-radius: 0;
  box-shadow: none;
}

.content {
  padding: 28rpx var(--space-page) calc(148rpx + env(safe-area-inset-bottom));
}

.title-block__field {
  position: relative;
}

.title-block__field--story {
  margin-top: 26rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid rgba(95, 79, 63, 0.12);
}

.title-block__input,
.story-block__input {
  width: 100%;
  background: transparent;
  box-sizing: border-box;
}

.title-block__input {
  padding: 0;
  min-height: 96rpx;
  color: var(--color-text);
  font-size: 60rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.18;
  overflow: hidden;
}

:deep(.title-block__placeholder) {
  color: var(--color-text-tertiary);
  font-size: 60rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.18;
}

.input-count {
  position: absolute;
  right: 0;
  bottom: -10rpx;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.2;
  pointer-events: none;
}

.story-block__input {
  padding: 0;
  min-height: 120rpx;
  color: var(--color-text-secondary);
  font-size: 32rpx;
  line-height: 1.7;
  overflow: hidden;
}

:deep(.story-block__placeholder) {
  color: var(--color-text-tertiary);
  font-size: 32rpx;
  line-height: 1.7;
}

.panel,
.advanced-row {
  margin-top: 30rpx;
  padding: 30rpx 0 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.panel__head,
.ingredient-card__head,
.step-card__head,
.editor-grid,
.mode-row,
.chip-row,
.bottom-bar,
.bottom-bar__side,
.sheet-option,
.advanced-row {
  display: flex;
}

.panel__head,
.ingredient-card__head,
.step-card__head,
.advanced-row {
  justify-content: space-between;
}

.panel__head {
  align-items: center;
}

.panel__head--ingredient {
  align-items: flex-start;
}

.panel__head--center {
  align-items: center;
}

.ingredient-card__head,
.step-card__head,
.advanced-row {
  align-items: center;
}

.panel__meta {
  flex: 1;
  min-width: 0;
}

.panel__meta--inline {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.advanced-row__head {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.advanced-row__main {
  flex: 1;
  min-width: 0;
}

.advanced-row__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.panel__count {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.2;
}

.panel__title,
.panel__desc,
.sheet-section__title,
.sheet-section__hint,
.advanced-row__title,
.advanced-row__desc,
.editor-field__label,
.group-badge,
.ingredient-card__title,
.step-card__title {
  display: block;
}

.panel__title,
.advanced-row__title {
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.advanced-row__count {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.2;
}

.panel__desc,
.advanced-row__desc,
.sheet-section__hint {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.panel__pill,
.ghost-action,
.chip,
.mode-pill,
.bar-button {
  border-radius: var(--radius-pill);
}

.panel__pill,
.ghost-action {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-height: 78rpx;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.panel__pill--ghost {
  background: transparent;
  color: var(--color-primary);
}

.ingredient-empty {
  margin-top: 26rpx;
  padding: 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  cursor: pointer;
  text-align: center;
}

.ingredient-empty__text {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.6;
}

.ingredient-stack,
.step-stack {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.ingredient-stack--compact {
  gap: 16rpx;
  margin-top: 28rpx;
}

.ingredient-line {
  display: flex;
  align-items: center;
  gap: 14rpx;
  transition: transform 180ms ease;
}

.ingredient-line--placeholder {
  opacity: 0;
}

.ingredient-line__field {
  display: flex;
  align-items: center;
  min-height: 80rpx;
  padding: 0 22rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 28rpx;
  box-sizing: border-box;
}

.ingredient-line__drag {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1;
}

.ingredient-line__drag--ghost {
  color: var(--color-primary);
}

.ingredient-line__field--name {
  flex: 1.5;
}

.ingredient-line__field--quantity {
  width: 156rpx;
  text-align: center;
}

.ingredient-line__field--unit {
  min-width: 124rpx;
  justify-content: center;
}

.ingredient-line__placeholder {
  color: var(--color-text-tertiary);
}

:deep(.ingredient-line__input-placeholder) {
  color: var(--color-text-tertiary);
}

.ingredient-line__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  color: var(--color-text-secondary);
  font-size: 20rpx;
  line-height: 1;
}

.ingredient-drag-layer {
  position: fixed;
  inset: 0;
  z-index: 1150;
}

.ingredient-line--ghost {
  position: fixed;
  gap: 14rpx;
  padding: 0;
  box-shadow: 0 20rpx 54rpx rgba(95, 79, 63, 0.18);
}

.ingredient-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  width: 100%;
  min-height: 84rpx;
  margin-top: 20rpx;
  border: 1rpx dashed var(--entry-accent);
  border-radius: var(--radius-xs);
  color: var(--entry-accent);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.ingredient-add--secondary {
  width: 100%;
}

.ingredient-add__icon {
  font-size: 26rpx;
  line-height: 1;
  color: var(--entry-accent);
}

.ingredient-card,
.step-card {
  padding: 26rpx 0;
  border-bottom: 1rpx solid rgba(95, 79, 63, 0.1);
  border-radius: 0;
  background: transparent;
}

.ingredient-card__title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ingredient-card__title,
.step-card__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-bold);
}

.group-badge {
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--entry-accent);
  font-size: 22rpx;
  font-weight: var(--font-weight-semibold);
}

.ingredient-card__remove,
.step-card__remove {
  color: var(--color-danger-text);
  font-size: 24rpx;
}

.picker {
  width: 100%;
  margin-top: 18rpx;
}

.picker__value,
.editor-input,
.sheet-textarea,
.step-card__textarea {
  width: 100%;
  padding: 10rpx 14rpx;
  height: 64rpx;
  border: 1rpx solid rgba(109, 92, 72, 0.1);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 28rpx;
}

.picker__value--placeholder {
  color: var(--color-text-tertiary);
}

.picker__value--readonly {
  pointer-events: none;
}

.mode-row,
.chip-row {
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 18rpx;
}

.mode-pill,
.chip {
  padding: 10rpx 20rpx;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.mode-pill--active,
.chip--active {
  background: var(--color-primary-soft);
  color: var(--entry-accent);
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 12rpx;
}

.sheet-section__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.sheet-section__tag {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.2;
}

.sheet-section__action {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.sheet-creator {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
}

.sheet-creator__input {
  flex: 1;
  min-width: 0;
  height: 82rpx;
  padding: 0 24rpx;
  border: 1rpx solid rgba(109, 92, 72, 0.1);
  border-radius: var(--radius-xs);
  background: rgba(255, 255, 255, 0.82);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 28rpx;
}

.sheet-search {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 0 var(--space-page);
  margin-top: 18rpx;
}

.sheet-search__bar {
  flex: 1;
  min-width: 0;
}

.editor-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.editor-field__action {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.editor-field__action--active {
  color: var(--entry-accent);
}

.servings-chip-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.servings-chip-row .chip {
  justify-content: center;
  padding-right: 0;
  padding-left: 0;
  text-align: center;
}

.servings-custom {
  margin-top: 18rpx;
}

.ingredient-picker__hint {
  display: block;
  margin-top: 18rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
  padding: 0 var(--space-page);
}

.ingredient-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  padding: 0 var(--space-page);
  margin-top: 18rpx;
}

.ingredient-filter__right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14rpx;
  margin-left: auto;
}

.ingredient-filter__chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-width: 160rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1;
}

.ingredient-filter__chip--active {
  background: var(--color-primary-soft);
  color: var(--entry-accent);
}

.ingredient-filter__icon {
  color: currentColor;
  font-size: 24rpx;
  line-height: 1;
}

.ingredient-filter__action {
  padding: 18rpx 20rpx;
  color: var(--color-primary);
  font-size: 24rpx;
  line-height: 1;
}

.ingredient-filter__action--hidden {
  visibility: hidden;
  pointer-events: none;
}

.ingredient-stage {
  margin-top: 20rpx;
}

.ingredient-stage__pane {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 var(--space-page);
  box-sizing: border-box;
}

.ingredient-picker {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.ingredient-picker__side {
  width: 160rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.ingredient-category {
  padding: 18rpx 20rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1;
}

.ingredient-category--active {
  border-color: transparent;
  background: var(--color-primary-soft);
  color: var(--entry-accent);
}

.ingredient-picker__main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ingredient-picker__scroll,
.ingredient-search__scroll {
  height: 100%;
}

.ingredient-search {
  display: flex;
  flex-direction: column;
  height: 320px;
  min-height: 0;
}

.ingredient-search__scroll {
  flex: 1;
  min-height: 0;
}

.ingredient-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.ingredient-grid--search {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ingredient-grid--create {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.ingredient-grid--unit {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.ingredient-unit-groups {
  display: grid;
  gap: 20rpx;
}

.ingredient-unit-group {
  display: grid;
  gap: 12rpx;
}

.ingredient-unit-group__title {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.ingredient-grid--create .ingredient-choice {
  background: var(--color-surface);
}

.ingredient-grid--create .ingredient-choice--active {
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
}

.ingredient-search__count {
  display: block;
  margin-bottom: 18rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.ingredient-search__footer {
  display: block;
  padding: 20rpx 0 8rpx;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.4;
  text-align: center;
}

.ingredient-choice {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
  padding: 18rpx 0;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
}

.ingredient-choice--active {
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
}

.ingredient-choice__head {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.ingredient-choice__name {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  word-break: break-all;
}

.ingredient-choice__badge {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--entry-accent);
  font-size: 20rpx;
  line-height: 1.2;
}

.ingredient-choice__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.ingredient-choice__action {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.ingredient-choice__action--primary {
  color: var(--color-primary);
}

.ingredient-choice__status {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.4;
}

.ingredient-picker__empty-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.5;
}

.ingredient-picker__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  height: 100%;
  text-align: center;
}

.ingredient-picker__empty--create {
  min-height: 620rpx;
}

.ingredient-picker__create {
  min-width: 220rpx;
  height: 60rpx;
  line-height: 60rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
}

.ingredient-picker__footer {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
}

.ingredient-selected {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.ingredient-selected__track {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  min-width: 100%;
}

.ingredient-selected__chip {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 10rpx;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 22rpx;
}

.ingredient-selected__name {
  line-height: 1;
}

.ingredient-selected__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22rpx;
  height: 22rpx;
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: 18rpx;
  line-height: 22rpx;
}

.ingredient-create {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  min-height: 620rpx;
}

.ingredient-create__summary {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.ingredient-create__card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-xs);
  background: rgba(255, 255, 255, 0.82);
}

.ingredient-create__card--action {
  cursor: pointer;
}

.ingredient-create__card--field {
  justify-content: flex-start;
}

.ingredient-create__card--active {
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
}

.ingredient-create__input {
  width: 100%;
  height: 100%;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

:deep(.ingredient-create__input-placeholder) {
  color: var(--color-text-tertiary);
}

.ingredient-create__value {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ingredient-create__value--fixed {
  word-break: break-all;
}

.ingredient-create__value--placeholder {
  color: var(--color-text-tertiary);
}

.ingredient-create__group {
  margin-top: 6rpx;
}

.ingredient-create__group-title {
  display: block;
  margin-bottom: 16rpx;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.ingredient-create__footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 22rpx;
}

.ingredient-create__footer .sheet-cancel,
.ingredient-create__footer .sheet-confirm {
  flex: 1 1 0;
  width: auto;
}

.sheet-cancel,
.sheet-confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 156rpx;
  height: 76rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-confirm {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.sheet-cancel {
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text-secondary);
}

.sheet-creator__button,
.sheet-apply {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 156rpx;
  height: 76rpx;
  margin-top: 20rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-creator__button {
  flex: 0 0 auto;
  min-width: 140rpx;
  margin-top: 0;
}

.sheet-creator__button[disabled],
.sheet-apply[disabled],
.sheet-cancel[disabled],
.sheet-confirm[disabled] {
  // opacity: 0.8;
}

.editor-grid {
  gap: 18rpx;
  margin-top: 18rpx;
}

.editor-field {
  flex: 1;
}

.editor-field__label,
.sheet-section__title {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.editor-field__label {
  margin-bottom: 12rpx;
}

.step-card__image {
  margin-top: 18rpx;
}

.step-card__field {
  position: relative;
}

.step-card__textarea,
.sheet-textarea {
  min-height: 136rpx;
  margin-top: 20rpx;
}

.step-card__count {
  right: 10rpx;
  bottom: 10rpx;
}

.panel__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 24rpx;
}

.step-sort {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.step-sort__mask {
  position: absolute;
  inset: 0;
  background: var(--login-popup-backdrop-bg);
  -webkit-backdrop-filter: blur(10rpx) saturate(145%);
  backdrop-filter: blur(10rpx) saturate(145%);
  opacity: 0;
  transition: opacity 220ms ease;
}

.step-sort__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-page) 100%);
  box-shadow: 0 -12rpx 60rpx rgba(59, 40, 21, 0.12);
  opacity: 0.98;
  transform: translateY(calc(100% + env(safe-area-inset-bottom)));
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease;
  will-change: transform, opacity;
}

.step-sort--open .step-sort__mask {
  opacity: 1;
}

.step-sort--open .step-sort__panel {
  opacity: 1;
  transform: translateY(0);
}

.step-sort__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 34rpx var(--space-page) 12rpx;
}

.step-sort__title-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.step-sort__title {
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.step-sort__count {
  color: var(--color-text-secondary);
  font-size: 28rpx;
  line-height: 1.2;
}

.step-sort__close {
  color: var(--color-text-secondary);
  font-size: 42rpx;
  line-height: 1;
}

.step-sort__desc {
  display: block;
  padding: 0 var(--space-page) 18rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.4;
}

.step-sort__scroll {
  flex: 1;
  min-height: 0;
}

.step-sort__list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 0 var(--space-page) 32rpx;
}

.step-sort-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
  border-radius: var(--radius-xs);
  border: 1rpx solid rgba(109, 92, 72, 0.08);
  background: var(--color-surface);
  box-shadow: 0 12rpx 40rpx rgba(95, 79, 63, 0.08);
  box-sizing: border-box;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.step-sort-card--placeholder {
  opacity: 0;
}

.step-sort-card--ghost {
  border-color: var(--color-primary);
  box-shadow: 0 20rpx 54rpx rgba(95, 79, 63, 0.18);
}

.step-sort-card__index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50rpx;
  height: 50rpx;
  flex: 0 0 50rpx;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 22rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.step-sort-card__thumb {
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  flex: 0 0 100rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.step-sort-card__thumb-image {
  display: block;
  width: 100%;
  height: 100%;
}

.step-sort-card__thumb-text {
  width: 72rpx;
  color: var(--color-text-tertiary);
  font-size: 20rpx;
  line-height: 1.4;
  text-align: center;
}

.step-sort-card__copy {
  flex: 1;
  min-width: 0;
}

.step-sort-card__text {
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.6;
  word-break: break-word;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.step-sort__ghost {
  position: fixed;
  z-index: 2;
  pointer-events: none;
}

.step-sort-list-move {
  transition: transform 180ms ease;
}

.step-sort__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 22rpx var(--space-page) calc(22rpx + env(safe-area-inset-bottom));
}

.step-sort__confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 96rpx;
  padding: 0 34rpx;
  border: 0;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-heavy);
}

.bottom-bar__publish {
  width: 100%;
}

.ghost-action {
  flex: 1;
  min-height: 84rpx;
}

.ghost-action--primary {
  color: var(--color-primary);
}

.advanced-row__arrow {
  color: var(--color-text-tertiary);
  font-size: 34rpx;
  transform: rotate(180deg);
}

.sheet__title-tag {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 22rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.sheet-option {
  flex-direction: column;
  gap: 8rpx;
  margin-top: 18rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: var(--color-surface);
}

.sheet-option__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
}

.sheet-option__desc {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet-section {
  padding: 0 var(--space-page);
  margin-top: 26rpx;
}

.sheet-section--danger {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.danger-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  border-radius: var(--radius-xs);
  background: var(--color-danger-soft);
  color: var(--color-danger-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1100;
  gap: 20rpx;
  padding: 18rpx var(--space-page) calc(18rpx + env(safe-area-inset-bottom));
  background: var(--color-tabbar-bg);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(18rpx);
  transition: transform 180ms ease, opacity 180ms ease;
}

.bottom-bar--hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(calc(100% + env(safe-area-inset-bottom)));
}

.bottom-bar__side {
  display: flex;
  flex: 1;
  gap: 16rpx;
}

.bar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 88rpx;
  min-height: 88rpx;
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
}

.bar-button--ghost {
  background: var(--color-surface);
  color: var(--color-text);
}

.bar-button--light {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.bar-button--primary {
  flex: 1.08;
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.notice {
  color: var(--color-text-secondary);
}

.notice--state {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56rpx var(--space-page) calc(72rpx + env(safe-area-inset-bottom));
  text-align: center;
}

.notice__art {
  width: 420rpx;
  height: 300rpx;
}

.notice__title,
.notice__desc,
.notice__action {
  display: block;
}

.notice__title {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 36rpx;
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.notice__desc {
  max-width: 520rpx;
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-loose);
}

.notice__action {
  margin-top: 18rpx;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
}

.notice--error .notice__desc {
  color: var(--color-text-tertiary);
}
</style>
