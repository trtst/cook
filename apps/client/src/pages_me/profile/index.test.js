const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "../..");
const mePage = fs.readFileSync(path.join(root, "pages/me/index.vue"), "utf8");
const profilePage = fs.readFileSync(path.join(root, "pages_me/profile/index.vue"), "utf8");
const fieldPage = fs.readFileSync(path.join(root, "pages_me/profile-field/index.vue"), "utf8");
const userApiSource = fs.readFileSync(path.join(root, "apis/user.ts"), "utf8");
const userStoreSource = fs.readFileSync(path.join(root, "stores/user.ts"), "utf8");
const calendarSource = fs.readFileSync(path.join(root, "components/MealMonthCalendar.vue"), "utf8");
const pagesJson = fs.readFileSync(path.join(root, "pages.json"), "utf8");
const fontSource = fs.readFileSync(path.join(root, "assets/fonts/font.scss"), "utf8");

function expectIncludes(source, fragment) {
  assert.ok(source.includes(fragment), `Expected source to include: ${fragment}`);
}

function expectNotIncludes(source, fragment) {
  assert.ok(!source.includes(fragment), `Expected source not to include: ${fragment}`);
}

expectIncludes(pagesJson, '"path": "profile/index"');
expectIncludes(pagesJson, '"path": "profile-field/index"');

expectIncludes(mePage, 'navigateTo("/pages_me/profile/index")');
expectNotIncludes(mePage, 'profileEditorOpen');
expectNotIncludes(mePage, 'profile-modal');

expectIncludes(fontSource, '.icon-profile-camera::before');
expectIncludes(fontSource, 'content: "\\e6cf";');
expectIncludes(fontSource, '.icon-calendar-switch::before');
expectIncludes(fontSource, 'content: "\\e6a8";');

expectIncludes(profilePage, 'class="profile-edit__avatar"');
expectIncludes(profilePage, 'cookfont icon-profile-camera');
expectIncludes(profilePage, 'imageCropPresets.profileAvatar');
expectIncludes(profilePage, 'useImageCropFlow');
expectIncludes(profilePage, 'uploadCurrentAvatar');
expectIncludes(profilePage, 'const nextAvatar = await userApi.uploadCurrentAvatar');
expectIncludes(profilePage, 'userStore.patchProfile({ avatarUrl: nextAvatar.avatarUrl }');
expectIncludes(profilePage, '../utils/image-crop');
expectIncludes(profilePage, '../composables/useImageCropFlow');
expectNotIncludes(profilePage, '@/utils/image-crop');
expectNotIncludes(profilePage, '@/pages_recipe/utils/image-crop');
expectNotIncludes(profilePage, '@/pages_recipe/composables/useImageCropFlow');
expectNotIncludes(profilePage, '../../pages_recipe/utils/image-crop');
expectNotIncludes(profilePage, '../../pages_recipe/composables/useImageCropFlow');
expectIncludes(profilePage, '名字');
expectIncludes(profilePage, '炊火号');
expectIncludes(profilePage, '简介');
expectIncludes(profilePage, '性别');
expectIncludes(profilePage, '生日');
expectIncludes(profilePage, 'cookNoLocked');
expectIncludes(profilePage, '炊火号是账号的唯一凭证，只能修改一次。');
expectIncludes(profilePage, 'uniPlatform.feedback.toast');
expectNotIncludes(profilePage, 'profile-edit__save');
expectNotIncludes(profilePage, 'void refreshProfile();');

expectIncludes(fieldPage, "nickname");
expectIncludes(fieldPage, "cookNo");
expectIncludes(fieldPage, "bio");
expectIncludes(fieldPage, "gender");
expectIncludes(fieldPage, "birthDate");
expectIncludes(fieldPage, ':enable-view-switch="true"');
expectIncludes(fieldPage, '未满14岁需实名认证');
expectIncludes(fieldPage, '您填写的年龄未满15岁，需在监护人的指导下完成实名认证。');
expectIncludes(fieldPage, '重新选择');
expectIncludes(fieldPage, '<= 14');
expectIncludes(fieldPage, ':max-date="todayText()"');
expectIncludes(fieldPage, 'nextDate > todayText()');
expectIncludes(fieldPage, 'maxlength="80"');
expectIncludes(fieldPage, ':maxlength="fieldType === \'nickname\' ? 24 : 20"');
expectIncludes(fieldPage, 'placeholder="写几句介绍自己"');
expectIncludes(fieldPage, '炊火号为 6-20 位，仅支持字母、数字和下划线。只能设置一次，请谨慎修改。');
expectIncludes(fieldPage, '确认设置炊火号');
expectIncludes(fieldPage, '炊火号只能设置一次，确认后不可再次修改。');
expectIncludes(fieldPage, 'confirmCookNoChange');
expectIncludes(fieldPage, '/^[A-Za-z0-9_]{6,20}$/');
expectIncludes(fieldPage, 'await userApi.updateCurrent(body);');
expectIncludes(fieldPage, 'userStore.patchProfile');
expectNotIncludes(fieldPage, 'const nextProfile = await userApi.updateCurrent(body);');
expectIncludes(fieldPage, 'class="profile-field__confirm"');
expectNotIncludes(fieldPage, 'navbar-right');
expectNotIncludes(fieldPage, '介绍一下你和餐桌的关系');
expectNotIncludes(fieldPage, 'profile-field__rule');

expectIncludes(calendarSource, 'enableViewSwitch?: boolean');
expectIncludes(calendarSource, 'enableViewSwitch: false');
expectIncludes(calendarSource, 'icon-calendar-switch');
expectIncludes(calendarSource, 'viewMode');
expectIncludes(calendarSource, 'month-calendar__arrow--prev');
expectIncludes(calendarSource, 'month-calendar__arrow--next');
expectIncludes(calendarSource, '.month-calendar--switchable .month-calendar__arrow--prev');
expectIncludes(calendarSource, '.month-calendar--switchable .month-calendar__arrow--next');
expectNotIncludes(calendarSource, '.month-calendar--switchable .month-calendar__actions');
expectIncludes(calendarSource, 'month-calendar__picker-grid--month');
expectIncludes(calendarSource, 'month-calendar__picker-grid--year');

expectIncludes(userApiSource, 'put<null>(`${cfg.domain}/api/users/me/profile`, body)');
expectIncludes(userApiSource, 'data: { avatarUrl: string | null }');
expectNotIncludes(userApiSource, 'return put<MeResponse>(`${cfg.domain}/api/users/me`, body);');
expectIncludes(userStoreSource, 'patchProfile');
