import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { schedules } from '../src/oracle';
import { runCase } from './replay';
import { startRuntime } from './runtime';
import { renderReport, summarize } from './report';

const args=process.argv.slice(2);
const samples=Number(args[0]??100);
const seed=Number(args[1]??42);
if(args.length>2||!Number.isInteger(samples)||samples<12||samples>10000||!Number.isInteger(seed)||seed<0||seed>0xffffffff) {
  throw new Error('usage: npm run demo -- [schedules:12..10000] [seed:0..4294967295]');
}
await mkdir('artifacts',{recursive:true});
const started=performance.now();
const runs=[];
const metrics=[];
for(const candidate of [false,true]) {
  let runtime=await startRuntime(undefined,candidate);
  const version=candidate?'0.33.0 + Marcel Marais steering fix':'0.33.0 baseline';
  const current=[];
  try {
    for(const schedule of schedules(seed,samples)) {
      const run=await runCase(runtime.url,schedule);
      const steering=schedule.caseId.includes('steer');
      if(candidate && run.divergence) throw new Error(`Candidate divergence: ${schedule.caseId} ${JSON.stringify(run.divergence)}`);
      if(!candidate && Boolean(run.divergence)!==steering) throw new Error(`Unexpected baseline transcript: ${schedule.caseId}`);
      if(run.duplicatePersistedChunks) throw new Error(`Duplicate persisted steering: ${schedule.caseId}`);
      current.push({...run,version});
    }
    const first=current[0];
    const endpoint=`/agents/chat/${first.name}/snapshot`;
    const before=await fetch(runtime.url+endpoint).then(r=>r.text());
    const path=runtime.persistPath;
    await runtime.stop();
    runtime=await startRuntime(path,candidate);
    const after=await fetch(runtime.url+endpoint).then(r=>r.text());
    if(before!==after) throw new Error(`Disk restart changed ${version} evidence`);
    const summary=summarize(current);
    metrics.push({...summary,diskRestartVerified:true});
    runs.push(...current);
    console.log(`${candidate?'upstream steering fix':'baseline'}: ${summary.transcriptDivergences}/${samples} transcript divergences; ${summary.postCancelInvocations} post-cancel model entries (${summary.unexpectedPostCancelInvocations} queued before stop); ${summary.duplicatePersistedChunks} duplicate persisted steering chunks`);
    if(!candidate && first.divergence) console.log(`first divergence: ${first.caseId}, seed ${first.seed}, part ${first.divergence.index}: live ${JSON.stringify(first.divergence.live)}; persisted ${JSON.stringify(first.divergence.persisted)}`);
  } finally {await runtime.stop();}
}
const report={schemaVersion:1,seed,agents:'0.33.0',aiChat:'0.12.2',model:'deterministic UI-message boundary',observationWindowMs:180,baseline:metrics[0],candidate:metrics[1],durationMs:Math.round(performance.now()-started),runs};
await writeFile('artifacts/report.json',JSON.stringify(report,null,2)+'\n');
await writeFile('artifacts/report.html',renderReport(report));
const replay=spawnSync('python3',['scripts/replaylab_adapter.py','artifacts/report.json','artifacts/replaylab.sqlite'],{encoding:'utf8'});
if(replay.status!==0) throw new Error(`replaylab adapter failed: ${replay.stderr}${replay.stdout}`);
const archive=JSON.parse(replay.stdout) as {observations:number;effectsDuringReplay:number};
console.log(`replaylab: ${archive.observations} observations replayed; ${archive.effectsDuringReplay} effects during replay`);
console.log(`disk restart: both versions preserved exact messages and ledger`);
console.log(`duration: ${report.durationMs} ms; ${samples} seeded schedules × 2 versions; 12 cases`);
console.log('report: artifacts/report.html (synchronized transcripts); raw: artifacts/report.json');
console.log('Known baseline findings are expected, not a claim that the SDK passed conformance.');
