import { expect, it } from "vitest";
import { wireParts, chunk, type Frame } from "../scripts/replay";
const frame = (body: unknown, seq: number): Frame => ({
  type: "cf_agent_use_chat_response",
  id: "turn-1",
  body: JSON.stringify(body),
  seq,
  done: false,
});
it("deduplicates replayed text deltas by turn and sequence", () => {
  const start = frame({ type: "text-start", id: "t" }, 0);
  const delta = frame({ type: "text-delta", id: "t", delta: "once" }, 1);
  expect(
    wireParts([
      start,
      delta,
      { ...start, replay: true },
      { ...delta, replay: true },
    ]),
  ).toEqual([{ type: "text", text: "once" }]);
});
it("deduplicates steering by semantic id even at a new sequence", () => {
  const steering = {
    type: "steering-message",
    id: "s",
    parts: [{ type: "text", text: "Texas" }],
  };
  expect(wireParts([frame(steering, 2), frame(steering, 3)])).toEqual([
    steering,
  ]);
});
it("retains distinct steering messages in arrival order", () => {
  const a = { type: "steering-message", id: "a", parts: [] },
    b = { ...a, id: "b" };
  expect(wireParts([frame(a, 0), frame(b, 1)])).toEqual([a, b]);
});
it("does not parse non-chunk protocol frames as model output", () => {
  expect(chunk({ type: "cf_agent_chat_messages", body: "{}" })).toBeUndefined();
  expect(
    chunk({ type: "cf_agent_use_chat_response", body: "not JSON" }),
  ).toBeUndefined();
  expect(chunk({ ...frame({}, 0), done: true })).toBeUndefined();
});
