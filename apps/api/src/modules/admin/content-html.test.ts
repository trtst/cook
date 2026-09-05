import assert from "node:assert/strict";
import { sanitizeContentHtml } from "./content-html";

const html = [
  "<h1>一级标题</h1>",
  "<h2>二级标题</h2>",
  "<h3>三级标题</h3>",
  "<p><b>加粗</b><strong>强调</strong><u>下划线</u><em>斜体</em><i>斜体</i><s>删除线</s></p>",
  '<a href="/guides/demo" target="_blank">站内</a>',
  '<a href="https://example.com" target="_blank">外链</a>',
  '<a href="http://example.com">不安全</a>',
  '<img src="/static/uploads/site-content-images/demo.webp" alt="图">',
  '<img src="https://example.com/demo.webp" alt="远程图">'
].join("");

const result = sanitizeContentHtml(html);

assert.ok(!result.includes("<h1>"), "Expected h1 to be removed");
assert.ok(result.includes("一级标题"), "Expected h1 text to remain");
assert.ok(result.includes("<h2>二级标题</h2>"), "Expected h2 to remain");
assert.ok(result.includes("<h3>三级标题</h3>"), "Expected h3 to remain");
assert.ok(result.includes("<b>加粗</b>"), "Expected b to remain for frontend render mapping");
assert.ok(result.includes("<strong>强调</strong>"), "Expected strong to remain");
assert.ok(result.includes("<u>下划线</u>"), "Expected u to remain");
assert.ok(!result.includes("<em>"), "Expected em to be removed");
assert.ok(!result.includes("<i>"), "Expected i to be removed");
assert.ok(!result.includes("<s>"), "Expected s to be removed");
assert.ok(result.includes('href="/guides/demo"'), "Expected site link to remain");
assert.ok(result.includes('href="https://example.com/"'), "Expected https link to remain");
assert.ok(!result.includes('href="http://example.com"'), "Expected unsafe link href to be removed");
assert.ok(result.includes('src="/static/uploads/site-content-images/demo.webp"'), "Expected site image to remain");
assert.ok(!result.includes('src="https://example.com/demo.webp"'), "Expected remote image to be removed");
