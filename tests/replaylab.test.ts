import { expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
it("archives and replays real observation-shaped records without executing their boundaries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "turnledger-archive-test-"));
  const path = join(dir, "report.json");
  await writeFile(
    path,
    JSON.stringify({
      runs: [
        {
          caseId: "steer-once",
          seed: 42,
          live: [{ type: "text", text: "x" }],
          persisted: [],
          divergence: { index: 0 },
          postCancelInvocations: 0,
          duplicatePersistedChunks: 0,
        },
      ],
    }),
  );
  const result = spawnSync(
    "python3",
    ["scripts/replaylab_adapter.py", path, join(dir, "trace.sqlite")],
    { encoding: "utf8" },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    observations: 1,
    effectsDuringReplay: 0,
  });
});
