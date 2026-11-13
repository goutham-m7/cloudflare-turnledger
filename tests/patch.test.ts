import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applySteeringFix } from "../scripts/upstream-fix";
it("applies only the pinned upstream steering case", () => {
  const source = readFileSync(
    "node_modules/agents/dist/message-builder-DAl9AhHH.js",
    "utf8",
  );
  const patched = applySteeringFix(source);
  expect(patched).toContain('case "steering-message"');
  expect(patched.length).toBeGreaterThan(source.length);
  expect(() => applySteeringFix(source + "\n")).toThrow("SDK hash mismatch");
  expect(() => applySteeringFix(patched)).toThrow("SDK hash mismatch");
});
