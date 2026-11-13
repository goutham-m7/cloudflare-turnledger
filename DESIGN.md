# TurnLedger design

## Problem and scope

Cloudflare Agents issue [#2878](https://github.com/cloudflare/agents/issues/2878) reports steering chunks missing after reload. [PR #2881](https://github.com/cloudflare/agents/pull/2881) changes cancellation of queued continuations. This project is an independent conformance harness, not either author's fix. All conversations are synthetic.

Run an actual AIChatAgent in Wrangler's local Workers runtime. Replace only the model boundary with deterministic UI-message streaming. Observe wire chunks, SDK-persisted messages, and a durable invocation ledger. Exercise twelve ordered cases across steering/reload, cancellation/tool results, and reconnect/replay; repeat over 100 seeded schedules. Never claim cancellation suppresses a new tool result submitted after stop: PR #2881 explicitly permits that continuation.

## Chosen architecture

Node replay driver -> HTTP/WebSocket -> AIChatAgent -> deterministic model stream. AIChatAgent owns SQLite message and stream persistence. A separate SQLite ledger records model entries and injected event sequence. Read persisted state through a diagnostic endpoint; close clients and restart local runtime against the same disk state to prove persistence. Artifacts contain live/persisted transcripts and first divergence. A static HTML report provides a synchronized event cursor without a production UI stack.

## Alternatives and hardest decisions

1. **Use the SDK's stream consumer, not an imitation.** A custom database would make results about our implementation rather than Agents. Rejected: in-memory fake or handwritten persistence adapter. Cost: tests must boot workerd and follow its wire protocol.
2. **Deterministic model boundary, real transport/storage.** Exact chunks and barriers make event order reproducible without API keys or timing-based sleeps. Rejected: paid model calls and probabilistic answers. This tests lifecycle contracts, not model quality.
3. **Compare semantic parts with independent observations.** Live wire, stored transcript, and invocation ledger have different shapes. Canonicalize only semantic content; retain raw evidence for debugging. Rejected: comparing SDK internals to themselves, or using a passing average to hide failures.

## Interfaces, failure and security

Local-only endpoints expose synthetic data and event controls. Reject invalid commands rather than silently accepting them. Bind the dev server to loopback. No authentication or deployment configuration: this is not an Internet-facing service. Failed expectations return a nonzero CLI exit code; observed known-upstream divergences are reported distinctly from harness failures. Retain stream IDs for replay deduplication.

## Acceptance criteria and evidence contract

| ID   | Criterion                                            | Proof                           | Assertion                                                                  |
| ---- | ---------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| EC-1 | Steering remains observable across stream and reload | Integration + captured artifact | First missing chunk identified, or equality on a fixed SDK                 |
| EC-2 | Cancellation/tool order is measured                  | Integration                     | Ledger counts invocations after stop separately from post-stop new actions |
| EC-3 | Reconnect/replayed chunks are measured               | Integration                     | Duplicate persisted semantic parts counted                                 |
| EC-4 | Persistence survives runtime restart                 | Integration                     | Same conversation from the same local disk state                           |
| EC-5 | Twelve cases and 100 seeded schedules run offline    | CLI capture                     | Counts, divergences, duplicates, duration, version in report               |

## Test strategy

Vitest tests pure transcript comparison and seeded ordering. Integration tests run a real Wrangler local worker, issue protocol actions, and inspect persisted state. Only the model is deterministic; no database, SDK lifecycle, HTTP, or WebSocket mock. Do not test Cloudflare hosted failover, billing, or model intelligence.

## At 100× scale

Shard isolated agent names across bounded runtime pools; stream JSONL artifacts rather than keeping all traces in memory. Preserve seeds and version lockfiles. Keep short, failing traces and aggregate successful metrics. Avoid increasing concurrent local workerd instances without memory measurements.

## Rollout and limitations

Local-only first. Pin npm dependencies and record upstream issue references. No upstream code modifications by default. Compare public fixed versions only when installable and compatible; attribute each source and never present a harness control as an upstream fix. No Gateway recreation, security proxy, hosted deployment, or real LLM.

## Implementation decisions and observed boundaries

- Baseline: `agents@0.33.0`, `@cloudflare/ai-chat@0.12.2`, `ai@7.0.18`. This pinned AI SDK predates the steering extension; the model fixture emits that public extension directly. It tests the SDK stream consumer, not `experimental_steering` generation.
- Candidate: a hash-guarded esbuild hook transcribes only Marcel Marais's publicly proposed steering case at revision `405819ce0caff982c7ce7de09db80c0907b8044e`. The original author retains credit. No dependency files are mutated and no cancellation patch is included.
- Use Wrangler bundling for both runtimes. The prebundled candidate still passes through Wrangler: `unstable_dev` with `bundle: false` did not signal readiness in this environment. Its single CommonJS built-in dependency needs `createRequire` with a virtual absolute module path because workerd does not supply `import.meta.url`. This path opens no file and contains no host-specific directory.
- Resume uses the SDK's on-connect notification and one ACK, followed by the explicit `replayComplete` barrier. Do not issue a second resume request after ACK: it can re-park the connection after the client already deduplicated that request's ACK.
- The independent semantic reducer deduplicates transport `(requestId, seq)` and steering IDs. It reads tool outputs from the injected client action, never from persisted state. Reload uses the SDK's built-in `get-messages` endpoint. Separate tests and both demo arms stop/start the entire runtime against the same disk directory.
- Twelve case templates plus seeded text placement are constrained schedules, not arbitrary concurrent permutations. Seeded case inputs and text interleavings reproduce; fresh agent names isolate repetitions. The 180 ms observation window bounds cancellation measurements rather than proving absence forever.
- Replaylab is a vendored personal MIT release. Its synchronous engine records completed SDK observations as leaf boundaries and forbids execution during observation replay. It does not pretend to snapshot or resume live JavaScript. This is a Cloudflare adapter, not a second generic replay engine.
- The report cursor is a semantic-part cursor over live and final reloaded transcripts. Raw event and invocation order remains inspectable in the ledger. All embedded values render as text; serialized JSON escapes `<` to prevent closing the data script.

## Independent contracts intentionally retained

The test suite asserts known failures on the pinned baseline and preservation on the credited steering candidate. A new upstream version fixing the baseline should fail those known-behaviour assertions until the pin and expected contract are deliberately updated. New tool results after Stop remain allowed; only results already queued when Stop arrived count as unwanted continuations. Duplicate chunk counts are specifically duplicate persisted steering IDs; text duplication is separately a transcript divergence.
