# Observed evidence

Fresh local clone of source commit `14963c9` into `/tmp`; `npm ci && npm run check && npm run demo` exited 0. Full captured stdout/stderr: [clean-clone.txt](clean-clone.txt). Local only; no remote push or hosted CI run.

- 30 passing Vitest tests across seven files, including real Wrangler/workerd transport, SDK SQLite and runtime restart.
- 100 seeded schedules × two versions, seed 42; twelve case templates. [summary.json](summary.json) contains the measured aggregates; [traces.json](traces.json) retains raw frames and ledgers from the first twelve schedules of each arm.
- Baseline: 52 transcript divergences, 24 post-cancel model entries, including 8 from results queued before stop; 0 duplicate persisted steering IDs.
- Credited upstream steering candidate: 0 transcript divergences; cancellation counts unchanged. It is not the #2881 cancellation fix.
- Both arms preserved exact messages and event ledgers after full runtime stop/start with the same local storage path.
- 200 replaylab observations replayed from immutable traces with boundary execution forbidden; zero boundary effects during replay.
- Fresh-clone paired demo runtime: 53,555 ms. This is one local wall-clock measurement, not a performance benchmark or confidence interval.

| Contract                        | Actual proof                                                                                                                          | Outcome                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| EC-1 steering vs reload         | `runtime.test.ts`: four steering variants; `candidate.test.ts`: three upstream-fixed variants; raw traces; baseline/fixed screenshots | Baseline loss correctly identified at part 1; candidate preserved it                                 |
| EC-2 stop/tool ordering         | `runtime.test.ts`: exact invocation counts for all twelve cases; persisted invocation and abort sequence numbers in traces            | Queued-before-stop entries separated from permitted new post-stop actions                            |
| EC-3 reconnect/replayed chunks  | Four reconnect cases wait for real `replayComplete`; `wire.test.ts` independently tests sequence and steering-ID deduplication        | No duplicate persisted steering IDs; text/tool comparisons equal except known baseline steering loss |
| EC-4 on-disk persistence        | `runtime.test.ts`: stop/start equality; both paired demo arms repeat equality                                                         | Exact persisted messages and ledgers retained                                                        |
| EC-5 offline matrix and metrics | Full fresh-clone demo log; summary JSON; replaylab trace checks                                                                       | Twelve cases, 100 schedules per arm, real storage and no model key                                   |

## Browser observations

Isolated Chromium rendered the report. Switching from baseline schedule 0 to candidate schedule 100 changed “First divergence at part 1” to “No transcript divergence” and showed the preserved steering part. Keyboard Home on the slider produced `0 / 2`; the jump button restored `2 / 2`. Browser error collection returned no entries. At 390 px viewport width, document scroll width was 390 px and the transcript grid used one 351 px column.

Screenshots [baseline.webp](baseline.webp), [upstream-fix.webp](upstream-fix.webp), and [mobile.webp](mobile.webp) were captured from the preceding local 53,797 ms run with the same pins and metrics, not the clean-clone run. They are unmodified browser captures.

The documented manual `npm run dev -- --port 8942` command was also started; `GET /health` returned `ok`, then the server was stopped. Wrangler telemetry is explicitly disabled in `wrangler.jsonc`.

## Reproducibility notes

`npm ci` emits an optional peer-dependency warning: the Agents build-time `@rolldown/plugin-babel` peer wants Vite 8 while Vitest 3 resolves Vite 7. The lockfile installation and all runtime tests succeeded without `--force` or `--legacy-peer-deps`. This fixture does not invoke that optional browser build plugin. The warning is preserved in the log rather than hidden.

Only the model boundary is scripted. Synthetic client tool responses are explicit injected actions. Persistence, SDK reconstruction, resume transport and model-entry accounting are not mocked. Reload/restart verification follows completed turns; this does not establish mid-turn crash recovery or hosted Cloudflare durability.
