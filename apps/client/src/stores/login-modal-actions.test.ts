import assert from "node:assert/strict";
import { createLoginActionRegistry } from "./login-modal-actions";

const registry = createLoginActionRegistry();

const firstAction = () => "first";
const secondAction = () => "second";

registry.set("first-source", firstAction);
registry.set("second-source", secondAction);

const firstResult = registry.take("first-source");

assert.equal(firstResult, firstAction);
assert.equal(registry.take("first-source"), null);

const secondResult = registry.take("second-source");

assert.equal(secondResult, secondAction);
assert.equal(registry.take("second-source"), null);
assert.equal(registry.set(null, firstAction), null);

const firstAnonymous = () => "anonymous-first";
const secondAnonymous = () => "anonymous-second";

const firstAnonymousKey = registry.register(firstAnonymous);
const secondAnonymousKey = registry.register(secondAnonymous);

assert.notEqual(firstAnonymousKey, secondAnonymousKey);
assert.ok(firstAnonymousKey);
assert.ok(secondAnonymousKey);
assert.equal(registry.take(firstAnonymousKey), firstAnonymous);
assert.equal(registry.take(firstAnonymousKey), null);
assert.equal(registry.take(secondAnonymousKey), secondAnonymous);
assert.equal(registry.take(secondAnonymousKey), null);

const directKey = registry.register(firstAction);

assert.equal(registry.set(directKey, secondAction), directKey);
assert.equal(registry.take(directKey), secondAction);

console.log("login modal actions tests passed");
