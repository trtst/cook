import assert from "node:assert/strict";
import { markdownToRichText } from "./markdown-rich-text";

const markdown = [
  "# 页面主标题",
  "",
  "# 正文一级标题应降级",
  "## 二级标题",
  "#### 深层标题应收敛",
  "",
  "这是一段 **加粗** 和 *斜体退回文本*。",
  "",
  "> 引用内容",
  "",
  "1. 有序项",
  "- 无序项",
  "",
  "![厨房图](/static/uploads/site-content-images/demo.webp)",
  "[站内链接](/guides/demo) [安全链接](https://example.com/path) [不安全链接](http://example.com)"
].join("\n");

const result = markdownToRichText(markdown);

assert.equal(result.title, "页面主标题");
assert.ok(result.html.includes("<h2>正文一级标题应降级</h2>"), "Expected body h1 markdown to render as h2");
assert.ok(result.html.includes("<h2>二级标题</h2>"), "Expected h2 markdown to remain h2");
assert.ok(result.html.includes("<h3>深层标题应收敛</h3>"), "Expected h4+ markdown to render as h3");
assert.ok(result.html.includes("<strong>加粗</strong>"), "Expected bold markdown to render as strong");
assert.ok(!result.html.includes("<h1>"), "Expected markdown output to exclude h1");
assert.ok(!result.html.includes("<em>"), "Expected markdown output to exclude em");
assert.ok(!result.html.includes("<i>"), "Expected markdown output to exclude i");
assert.ok(result.html.includes("<blockquote><p>引用内容</p></blockquote>"), "Expected blockquote output");
assert.ok(result.html.includes("<ol>"), "Expected ordered list output");
assert.ok(result.html.includes("<ul>"), "Expected unordered list output");
assert.ok(result.html.includes('<img src="/static/uploads/site-content-images/demo.webp" alt="厨房图">'), "Expected safe image output");
assert.ok(result.html.includes('<a href="/guides/demo"'), "Expected site link output");
assert.ok(result.html.includes('<a href="https://example.com/path"'), "Expected https link output");
assert.ok(!result.html.includes('href="http://example.com"'), "Expected unsafe link to degrade to text");
