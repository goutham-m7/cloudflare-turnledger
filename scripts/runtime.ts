import { unstable_dev } from 'wrangler';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundleCandidate } from './upstream-fix';
export type Runtime = { url:string; persistPath:string; stop:()=>Promise<void> };
export async function startRuntime(existingPath?:string, candidate=false): Promise<Runtime> {
  const persistPath=existingPath??await mkdtemp(join(tmpdir(),'turnledger-state-'));
  const script=candidate?await bundleCandidate(persistPath):'src/worker.ts';
  const worker=await unstable_dev(script,{
    config:'wrangler.jsonc',local:true,ip:'127.0.0.1',port:0,inspect:false,
    bundle:true,
    persist:true,persistTo:persistPath,logLevel:'error',
    experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}
  });
  return {url:`http://127.0.0.1:${worker.port}`,persistPath,stop:worker.stop};
}
