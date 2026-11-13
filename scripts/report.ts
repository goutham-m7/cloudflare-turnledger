type MetricRun = {
  divergence: unknown;
  postCancelInvocations: number;
  unexpectedPostCancelInvocations: number;
  duplicatePersistedChunks: number;
};
export function summarize(runs: MetricRun[]) {
  return {
    schedules: runs.length,
    transcriptDivergences: runs.filter((r) => r.divergence !== null).length,
    postCancelInvocations: runs.reduce(
      (n, r) => n + r.postCancelInvocations,
      0,
    ),
    unexpectedPostCancelInvocations: runs.reduce(
      (n, r) => n + r.unexpectedPostCancelInvocations,
      0,
    ),
    duplicatePersistedChunks: runs.reduce(
      (n, r) => n + r.duplicatePersistedChunks,
      0,
    ),
  };
}

/** Synthetic report data is still untrusted HTML input. Render values with textContent only. */
export function renderReport(report: unknown): string {
  const json = JSON.stringify(report).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TurnLedger · Lifecycle evidence</title>
<style>
:root{--ink:#172b46;--muted:#506174;--line:#cbd5e1;--paper:#f4f7fb;--orange:#a34612;--blue:#195eb6;--missing:#fff0e8}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 system-ui,sans-serif}header{padding:30px 5vw 22px;background:white;border-top:6px solid #f48120;border-bottom:1px solid var(--line)}h1{font:600 38px/1.1 'Avenir Next',system-ui;margin:10px 0}p{max-width:850px;color:var(--muted)}.eyebrow{font:12px monospace;letter-spacing:.12em;color:var(--orange)}main{padding:25px 5vw}summary{cursor:pointer}pre,code{font:13px/1.65 'SFMono-Regular',Consolas,monospace}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.metrics{display:flex;flex-wrap:wrap;gap:20px;border-bottom:1px solid var(--line);padding-bottom:20px}.metrics div{min-width:190px}.metrics strong{display:block;font-size:25px;color:var(--blue)}label{display:block;font-weight:600;margin:20px 0 7px}select,button{font:inherit;color:var(--ink);background:white;border:1px solid #7c8da3;padding:8px 12px;border-radius:4px}button{cursor:pointer;margin-left:10px}input[type=range]{width:100%;accent-color:var(--orange)}:focus-visible{outline:3px solid var(--blue);outline-offset:3px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pane{background:white;border:1px solid var(--line);border-radius:6px;overflow:hidden}.pane h2{font-size:14px;margin:0;padding:12px 16px;background:#e7eef8}.row{padding:15px 16px;border-top:1px solid var(--line);min-height:75px}.row.changed{background:var(--missing);border-left:4px solid var(--orange)}.status{padding:12px 16px;background:#e7eef8;margin:20px 0}.status.fail{background:var(--missing)}.subtitle{font-size:12px;color:var(--muted)}details{margin-top:18px}.empty{color:var(--muted);font-style:italic}a{color:var(--blue)}@media(max-width:650px){.columns{grid-template-columns:1fr}h1{font-size:30px}button{margin:8px 0}.metrics div{min-width:140px}}
select{max-width:100%}
</style>
<header><div class="eyebrow">CLOUDFLARE AGENTS / LOCAL WORKERD / SQLITE</div><h1>Does the conversation survive reload?</h1><p>Wire observations on the left. The SDK’s reloaded transcript on the right. Same schedule, same cursor. The candidate uses Marcel Marais’s public steering fix; cancellation remains unpatched.</p></header>
<main><section class="metrics" id="metrics" aria-label="Conformance metrics"></section>
<label for="run">Schedule and version</label><select id="run"></select><button id="jump">Jump to first divergence</button>
<div id="status" class="status" role="status"></div>
<label for="cursor">Transcript cursor <output id="position"></output></label><input id="cursor" type="range" min="0" value="0" aria-label="Transcript cursor">
<div class="columns"><section class="pane"><h2>Live · observed semantic parts</h2><div id="live"></div></section><section class="pane"><h2>Reloaded · SDK persisted parts</h2><div id="stored"></div></section></div>
<details><summary>Event and model-invocation ledger</summary><pre id="ledger"></pre></details>
<details><summary>What these results do not prove</summary><p>These are constrained, seeded event interleavings, not exhaustive distributed schedules. The 180 ms post-finalization observation window bounds model-invocation counts. New tool results after stop are allowed to invoke the model. No real LLM or hosted failover is exercised. Replaylab replays archived observations, not Worker execution.</p></details>
<p class="subtitle">Sources: <a href="https://github.com/cloudflare/agents/issues/2878">steering #2878</a> · <a href="https://github.com/cloudflare/agents/pull/2881">cancellation #2881</a> · candidate attribution in vendor/NOTICE.md. Local synthetic data only.</p>
</main><script id="data" type="application/json">${json}</script><script>
const report=JSON.parse(document.getElementById('data').textContent);
const select=document.getElementById('run'),cursor=document.getElementById('cursor');
for(const [index,r] of report.runs.entries()){const o=document.createElement('option');o.value=index;o.textContent=r.version+' / '+r.caseId+' / seed '+r.seed;select.append(o);}
const metric=document.getElementById('metrics');
for(const [label,value] of [['Baseline transcript divergences',report.baseline.transcriptDivergences+'/'+report.baseline.schedules],['With upstream steering fix',report.candidate.transcriptDivergences+'/'+report.candidate.schedules],['Queued post-stop invocations',report.baseline.unexpectedPostCancelInvocations],['Duplicate persisted steering',report.baseline.duplicatePersistedChunks]]){const d=document.createElement('div'),n=document.createElement('strong');n.textContent=value;d.append(n,document.createTextNode(label));metric.append(d);}
function draw(){const r=report.runs[Number(select.value)];if(!r)return;const n=Number(cursor.value);document.getElementById('position').textContent=n+' / '+cursor.max;for(const [id,parts] of [['live',r.live],['stored',r.persisted]]){const target=document.getElementById(id);target.replaceChildren();for(let i=0;i<n;i++){const row=document.createElement('div');row.className='row'+(r.divergence&&i===r.divergence.index?' changed':'');const pre=document.createElement('pre');pre.textContent=parts[i]?JSON.stringify(parts[i],null,2):'No persisted part at this position';row.append(pre);target.append(row);}}
const status=document.getElementById('status');status.className='status'+(r.divergence?' fail':'');status.textContent=(r.divergence?'First divergence at part '+r.divergence.index:'No transcript divergence')+' · post-cancel model entries '+r.postCancelInvocations+' · queued-before-stop '+r.unexpectedPostCancelInvocations;document.getElementById('ledger').textContent=JSON.stringify(r.snapshot.events,null,2);}
function choose(){const r=report.runs[Number(select.value)];if(!r)return;cursor.max=Math.max(r.live.length,r.persisted.length);cursor.value=r.divergence?r.divergence.index+1:cursor.max;draw();}
select.addEventListener('change',choose);cursor.addEventListener('input',draw);document.getElementById('jump').addEventListener('click',choose);choose();
</script></html>`;
}
