import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startRuntime, type Runtime } from '../scripts/runtime';
import { runCase } from '../scripts/replay';
import { cases } from '../src/oracle';

let runtime: Runtime;
beforeAll(async()=>{runtime=await startRuntime();},60000);
afterAll(async()=>{await runtime?.stop();},30000);
describe('real Agents SDK / SQLite / WebSocket',()=>{
  it.each(cases)('%s records wire, persistence and invocation evidence',async(caseId)=>{
    const result=await runCase(runtime.url, {caseId,seed:42,variant:0});
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.snapshot.invocations.length).toBeGreaterThan(0);
    expect(result.snapshot.messages.some(m=>m.role==='user')).toBe(true);
    expect(result.duplicatePersistedChunks).toBe(0);
    if (caseId.startsWith('steer') || caseId.includes('steer')) {
      expect(result.divergence?.live?.type).toBe('steering-message');
    } else expect(result.divergence).toBeNull();
  },15000);
  it('reloads messages from SQLite after the runtime is stopped',async()=>{
    const result=await runCase(runtime.url,{caseId:'reconnect-text',seed:902,variant:1});
    const before=await fetch(`${runtime.url}/agents/chat/${result.name}/snapshot`).then(r=>r.json());
    const dir=runtime.persistPath;
    await runtime.stop();
    runtime=await startRuntime(dir);
    const after=await fetch(`${runtime.url}/agents/chat/${result.name}/snapshot`).then(r=>r.json());
    expect(after).toEqual(before);
  },60000);
});
