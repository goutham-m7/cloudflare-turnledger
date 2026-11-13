# Pinned public sources

## Steering preservation comparison

`steering-case.js.txt` is the JavaScript transcription (type assertion removed, formatting condensed) of the `steering-message` switch case by **Marcel Marais**, not an original TurnLedger fix.

Source: https://github.com/marcelmarais/agents/blob/405819ce0caff982c7ce7de09db80c0907b8044e/packages/agents/src/chat/message-builder.ts

Context: https://github.com/cloudflare/agents/issues/2878

License: MIT, copyright Cloudflare (see CLOUDFLARE-LICENSE). Applied only during the candidate bundle build, never to node_modules. Baseline npm `agents@0.33.0` bundled message-builder SHA-256: `ef29967b7e56e664cc39d4dcf47bec4f081a04f97608f759ee0bd201d1df552a`. Hash mismatch fails closed. This is an unmerged public proposal, not a released Cloudflare fix. It does not include PR #2881's cancellation changes.

## Replaylab

`replaylab-0.1.0-py3-none-any.whl` is Goutham Madineni's personal MIT-licensed replaylab, source revision `45cb064407515881ccd5196f2fe056aa974ea8d5`. Its wheel SHA-256 is `f52e495cd219b141f4ac83dbb7e4c35c4d2b07b0fd025bf3859b7246b708d96d`. License: REPLAYLAB-LICENSE. No employer source, prompts or data. The adapter uses its synchronous engine/store only, with Python's standard library; its optional HTTP providers and web UI are not imported. Replaylab replay replays recorded observations, not workerd execution; a fresh SDK run always uses the Node driver.
