import assert from "node:assert/strict";
import test from "node:test";
import { searchConversations, filterConversations, responseObservations, parseTemplate } from "../src/lib/support.ts";

const rows = [
  { id: "a", name: "Alex Kumar", phone: "919876543210", assignee_name: "Sam", last_message: "Where is my order?", is_closed: false },
  { id: "b", name: null, phone: null, assignee_name: null, last_message: null, is_closed: true },
];
const conversation = (frt_seconds, overrides = {}) => ({ customer_id: "a", gen: 0, started_at: "2026-10-01 01:00:00+00", frt_seconds, resolution_seconds: null, closed_at: null, closed_without_reply: false, ...overrides });

test("Search handles case, whitespace, formatted phones, and null fields", () => {
  assert.equal(searchConversations(rows, "  ALEX ").length, 1);
  assert.equal(searchConversations(rows, "+91 98765 43210")[0].id, "a");
  assert.equal(searchConversations(rows, "missing").length, 0);
  assert.equal(searchConversations(rows, " ").length, 2);
});
test("Status filters compose with search and distinguish waiting from open", () => {
  const waiting = new Set(["a"]);
  assert.equal(filterConversations(rows, "waiting", waiting)[0].id, "a");
  assert.equal(filterConversations(rows, "closed", waiting)[0].id, "b");
  assert.equal(filterConversations(searchConversations(rows, "Alex"), "closed", waiting).length, 0);
  assert.equal(filterConversations(rows, "waiting", new Set()).length, 0);
  assert.equal(filterConversations(rows, "open", new Set()).length, 1);
});
test("Slow-response observation uses the whole sample and a 15-minute floor", () => {
  const result = responseObservations([conversation(31), conversation(207), conversation(13688)]);
  assert.equal(result.replied.length, 3);
  assert.equal(result.threshold, 900);
  assert.equal(result.slow.length, 1);
  assert.equal(result.slow[0].frt_seconds, 13688);
});
test("Relative threshold supports even samples and excludes the boundary", () => {
  const result = responseObservations([conversation(600), conversation(1200), conversation(1800), conversation(7200)]);
  assert.equal(result.threshold, 4500);
  assert.equal(result.slow.length, 1);
  assert.equal(responseObservations([conversation(10), conversation(20), conversation(900)]).slow.length, 0);
});
test("Empty, single, and missing samples do not imply slow responses", () => {
  assert.equal(responseObservations([]).slow.length, 0);
  assert.equal(responseObservations([conversation(100000)]).slow.length, 0);
  assert.equal(responseObservations([conversation(null), conversation(NaN)]).replied.length, 0);
});
test("Resolution samples exclude closures without a human reply", () => {
  const result = responseObservations([
    conversation(31, { closed_at: "2026-10-01 02:00:00+00", resolution_seconds: 60 }),
    conversation(null, { closed_at: "2026-10-01 03:00:00+00", closed_without_reply: true }),
  ]);
  assert.equal(result.closed, 2);
  assert.equal(result.missed.length, 1);
  assert.equal(result.resolved.length, 1);
});
test("Template parser preserves multiline body, footer and labelled buttons", () => {
  assert.deepEqual(parseTemplate("Header: Rate your support\nBody: How was it?\nTell us more.\nFooter: Thank you\nButtons: [1] Good, [2] Needs work"), {
    header: "Rate your support", body: "How was it?\nTell us more.", footer: "Thank you", buttons: ["Good", "Needs work"],
  });
});
test("Template parser preserves commas in labels and ignores ordinary text", () => {
  assert.deepEqual(parseTemplate("Body: Test\r\nButtons: [1] Yes, please, [2] No").buttons, ["Yes, please", "No"]);
  assert.equal(parseTemplate("Hello there"), null);
  assert.equal(parseTemplate(null), null);
});
