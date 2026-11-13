import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { join } from "node:path";
const expected =
  "ef29967b7e56e664cc39d4dcf47bec4f081a04f97608f759ee0bd201d1df552a";
export function applySteeringFix(source: string): string {
  if (createHash("sha256").update(source).digest("hex") !== expected)
    throw new Error("SDK hash mismatch: refusing upstream patch");
  const needle = '\t\tdefault:\n\t\t\tif (chunk.type.startsWith("data-"))';
  if (!source.includes(needle))
    throw new Error("Pinned switch boundary missing");
  return source.replace(
    needle,
    readFileSync("vendor/steering-case.js.txt", "utf8") + needle,
  );
}
export async function bundleCandidate(directory: string): Promise<string> {
  const outfile = join(directory, "candidate.mjs");
  let applied = 0;
  await build({
    entryPoints: ["src/worker.ts"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    mainFields: ["module", "main"],
    conditions: ["workerd", "worker", "browser"],
    banner: {
      js: 'import { createRequire } from \"node:module\"; const require = createRequire(\"/turnledger/candidate.mjs\");',
    },
    external: ["cloudflare:*", "node:*"],
    target: "es2022",
    logLevel: "silent",
    plugins: [
      {
        name: "credited-upstream-steering-fix",
        setup(b) {
          b.onLoad({ filter: /message-builder-DAl9AhHH\.js$/ }, (args) => {
            applied++;
            return {
              contents: applySteeringFix(readFileSync(args.path, "utf8")),
              loader: "js",
            };
          });
        },
      },
    ],
  });
  if (applied !== 1)
    throw new Error(`Expected one upstream patch target, got ${applied}`);
  return outfile;
}
