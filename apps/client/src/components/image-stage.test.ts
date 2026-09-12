import assert from "node:assert/strict";
import { imageStage } from "./image-stage";

assert.equal(imageStage("", ""), "empty");
assert.equal(imageStage("https://cdn.example.com/cover-a.jpg", ""), "loading");
assert.equal(imageStage("https://cdn.example.com/cover-a.jpg", "https://cdn.example.com/cover-a.jpg"), "loaded");
assert.equal(imageStage("https://cdn.example.com/cover-b.jpg", "https://cdn.example.com/cover-a.jpg"), "loading");

console.log("image stage tests passed");
