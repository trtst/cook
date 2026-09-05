import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "MaterialImagesPage.vue"), "utf8");

assert.match(source, /<section class="material-page-actions">[\s\S]*@click="openUploadDialog"[\s\S]*上传图片/);
assert.equal(source.match(/@click="openUploadDialog"/g)?.length, 1);
assert.doesNotMatch(source, /class="table-panel material-upload"/);
assert.doesNotMatch(source, /<el-table-column label="图片地址"/);
assert.match(source, /<el-dialog[\s\S]*v-model="uploadDialogOpen"[\s\S]*title="上传图片素材"/);
assert.match(source, /<input[\s\S]*class="material-file-input"[\s\S]*type="file"/);
assert.match(source, /\.material-file-input\s*\{[\s\S]*display:\s*none;/);
assert.match(source, /class="material-dialog-preview"/);
assert.match(source, /<el-input[\s\S]*v-model="note"[\s\S]*placeholder="填写备注/);
assert.match(source, /@click="uploadImage"[\s\S]*上传素材/);
assert.match(source, /function copyableImageUrl\(imageUrl: string\)/);
assert.match(source, /url\.hostname === "127\.0\.0\.1" \|\| url\.hostname === "localhost"/);
assert.match(source, /adminAppConfig\.assetPublicBaseUrl\.trim\(\)\.replace/);
assert.match(source, /navigator\.clipboard\.writeText\(copyableImageUrl\(item\.imageUrl\)\)/);
