import { describe, expect, it } from "vitest";
import { compare, semanticParts, schedules } from "../src/oracle";

describe("independent transcript oracle", () => {
  it("identifies the exact first missing steering part", () => {
    const live = [
      { type: "text", text: "Hello" },
      {
        type: "steering-message",
        id: "s1",
        parts: [{ type: "text", text: "Paris, Texas" }],
      },
    ];
    expect(compare(live, live.slice(0, 1))).toEqual({
      index: 1,
      live: live[1],
      persisted: null,
    });
  });
  it("accepts an identical transcript", () =>
    expect(
      compare([{ type: "text", text: "a" }], [{ type: "text", text: "a" }]),
    ).toBeNull());
  it("reports a changed text delta", () =>
    expect(
      compare([{ type: "text", text: "a" }], [{ type: "text", text: "b" }])
        ?.index,
    ).toBe(0));
  it("ignores protocol metadata, not steering", () =>
    expect(
      semanticParts([
        { type: "step-start" },
        { type: "text", text: "ok", providerMetadata: {} },
        { type: "steering-message", id: "s", parts: [] },
      ]),
    ).toEqual([
      { type: "text", text: "ok" },
      { type: "steering-message", id: "s", parts: [] },
    ]));
  it("generates exactly 100 reproducible schedules covering twelve cases", () => {
    const a = schedules(42, 100);
    expect(a).toEqual(schedules(42, 100));
    expect(a).toHaveLength(100);
    expect(new Set(a.map((s) => s.caseId)).size).toBe(12);
    expect(schedules(43, 100)).not.toEqual(a);
  });
});
