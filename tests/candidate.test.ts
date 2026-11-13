import { expect, it } from "vitest";
import { startRuntime } from "../scripts/runtime";
import { runCase } from "../scripts/replay";
it("Marcel Marais upstream fix preserves replayed steering in actual SQLite", async () => {
  const runtime = await startRuntime(undefined, true);
  try {
    for (const caseId of [
      "steer-once",
      "steer-replay",
      "reconnect-replay-steer",
    ] as const) {
      const result = await runCase(runtime.url, {
        caseId,
        seed: 42,
        variant: 1,
      });
      expect(result.divergence).toBeNull();
      expect(
        result.persisted.filter((p) => p.type === "steering-message"),
      ).toHaveLength(1);
      expect(result.duplicatePersistedChunks).toBe(0);
    }
  } finally {
    await runtime.stop();
  }
}, 60000);
