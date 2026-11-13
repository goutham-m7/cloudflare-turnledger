import { expect, it } from "vitest";
import { summarize, renderReport } from "../scripts/report";
it("reports failures separately from post-stop new actions", () => {
  expect(
    summarize([
      {
        divergence: { index: 1 },
        postCancelInvocations: 1,
        unexpectedPostCancelInvocations: 1,
        duplicatePersistedChunks: 0,
      },
      {
        divergence: null,
        postCancelInvocations: 1,
        unexpectedPostCancelInvocations: 0,
        duplicatePersistedChunks: 2,
      },
    ]),
  ).toEqual({
    schedules: 2,
    transcriptDivergences: 1,
    postCancelInvocations: 2,
    unexpectedPostCancelInvocations: 1,
    duplicatePersistedChunks: 2,
  });
});
it("embeds observations without allowing script markup injection", () => {
  const html = renderReport({
    runs: [],
    baseline: {},
    candidate: {},
    note: "</script><script>throw 1</script>",
  });
  expect(html).not.toContain("</script><script>throw");
  expect(html).toContain("Transcript cursor");
  expect(html).toContain("aria-label");
});
