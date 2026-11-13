import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { compare, semanticParts, type Part, type CaseId } from '../src/oracle';

export type Frame = {type:string; id?:string; body?:string; done?:boolean; seq?:number; [key:string]:unknown};
export type Snapshot = {messages:{id:string;role:string;parts:Part[]}[];events:{seq:number;kind:string;data:Record<string,unknown>}[];invocations:unknown[];active:boolean};
export type Schedule = {caseId:CaseId;seed:number;variant:number};
export async function until<T>(read:()=>Promise<T>, predicate:(value:T)=>boolean, label:string, timeout=8000):Promise<T> {
  const end=Date.now()+timeout;
  while(Date.now()<end) {
    const value=await read();
    if(predicate(value)) return value;
    await delay(15);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export async function runCase(base:string,schedule:Schedule) {
  const name=`${schedule.caseId}-${schedule.seed}-${randomUUID().slice(0,8)}`;
  const endpoint=`${base}/agents/chat/${name}`;
  const frames:Frame[]=[];
  const sockets:WebSocket[]=[];
  const acked=new Set<string>();
  const connect=async()=> {
    const socket=new WebSocket(endpoint.replace('http','ws'));
    sockets.push(socket);
    socket.on('message',data=>{
      const frame=JSON.parse(data.toString()) as Frame;
      frames.push(frame);
      if(frame.type==='cf_agent_stream_resuming' && frame.id && !acked.has(`${sockets.length}:${frame.id}`)) {
        acked.add(`${sockets.length}:${frame.id}`);
        socket.send(JSON.stringify({type:'cf_agent_stream_resume_ack',id:frame.id}));
      }
    });
    await once(socket,'open');
    return socket;
  };
  const snapshot=async()=>{
    const r=await fetch(`${endpoint}/snapshot`);
    if(!r.ok) throw new Error(`snapshot HTTP ${r.status}: ${await r.text()}`);
    return r.json() as Promise<Snapshot>;
  };
  const control=async(action:string,extra:Record<string,unknown>={})=>{
    const r=await fetch(`${endpoint}/control`,{method:'POST',body:JSON.stringify({action,...extra})});
    if(!r.ok) throw new Error(`control ${action}: ${r.status} ${await r.text()}`);
  };
  const waitChunk=async(type:string,count=1)=>until(async()=>frames,fs=>fs.filter(f=>chunk(f)?.type===type).length>=count,type);
  const tool=schedule.caseId.includes('tool') || schedule.caseId.includes('cancel');
  let socket:WebSocket|undefined;
  try {
    socket=await connect();
    socket.send(JSON.stringify({type:'cf_agent_use_chat_request',id:'request-1',init:{method:'POST',body:JSON.stringify({messages:[{id:'user-1',role:'user',parts:[{type:'text',text:`Synthetic location ${schedule.seed}`}]}],tool})}}));
    await waitChunk(tool?'tool-input-available':'text-delta');
    await until(snapshot,s=>s.invocations.length===1,'initial invocation');
    const steer=async(id='steer-1')=>{
      const count=frames.filter(f=>chunk(f)?.type==='steering-message').length;
      await control('steer',{id,text:`Use Paris, Texas (${schedule.seed}).`});
      await waitChunk('steering-message',count+1);
    };
    const sendTool=async()=>{
      await control('mark',{event:'tool-result',toolCallId:'lookup-1'});
      socket!.send(JSON.stringify({type:'cf_agent_tool_result',toolCallId:'lookup-1',toolName:'lookup',output:{city:'Paris, Texas'},autoContinue:true}));
      await until(async()=>frames,fs=>fs.some(f=>f.type==='cf_agent_message_updated' && JSON.stringify(f.message).includes('output-available')),'tool result acknowledged');
    };
    const cancel=async()=>{
      await control('mark',{event:'cancel',requestId:'request-1'});
      socket!.send(JSON.stringify({type:'cf_agent_chat_request_cancel',id:'request-1'}));
      await until(snapshot,s=>s.events.some(e=>e.kind==='cancel-observed'),'SDK abort signal');
    };
    const c=schedule.caseId;
    if(schedule.variant===1) await control('delta');
    if(c.startsWith('steer') || c.includes('steer')) {
      if(c==='steer-between-text') await control('delta');
      await steer();
      if(c==='steer-replay'||c==='reconnect-replay-steer') await steer();
      if(c==='steer-two') await steer('steer-2');
    }
    if(c.startsWith('reconnect')) {
      await control('mark',{event:'disconnect'});
      const closed=once(socket,'close');
      socket.terminate();
      await closed;
      socket=await connect();
      await control('mark',{event:'reconnect'});
      await until(async()=>frames,fs=>fs.some(f=>f.replayComplete===true),'resume replay completed');
    }
    // Seeds interleave text before steering or after reconnection; case-specific
    // tool/cancel order remains a hard causal constraint.
    if(schedule.variant===2) await control('delta');
    if(c==='tool-before-cancel') {await sendTool();await cancel();}
    if(c==='tool-after-cancel'||c==='cancel-before-tool') {
      await cancel();
      if(c==='cancel-before-tool') await until(snapshot,s=>!s.active,'cancel settled');
      await sendTool();
    }
    if(c==='tool-no-cancel'||c==='reconnect-tool') await sendTool();
    if((await snapshot()).active) await control('finish');
    await until(snapshot,s=>!s.active && s.messages.some(m=>m.role==='assistant'),'turn finalized');
    // Auto-continuation is SDK-debounced by 50 ms; observe a bounded quiet window,
    // not an assertion that no invocation can ever happen in the future.
    await delay(180);
    const final=await snapshot();
    await control('mark',{event:'reload'});
    const reloadResponse=await fetch(`${endpoint}/get-messages`);
    if(!reloadResponse.ok) throw new Error(`reload HTTP ${reloadResponse.status}`);
    const reloaded=await reloadResponse.json() as Snapshot['messages'];
    const live=wireParts(frames);
    // Tool output is an explicit client event, independently present in the input schedule.
    if(tool) for(const p of live) if(p.toolCallId==='lookup-1') p.output={city:'Paris, Texas'};
    const persisted=semanticParts(reloaded.filter(m=>m.role==='assistant').flatMap(m=>m.parts));
    const cancelIndex=final.events.find(e=>e.kind==='cancel-observed')?.seq;
    const postCancelInvocations=cancelIndex===undefined?0:final.events.filter(e=>e.kind==='invocation'&&e.seq>cancelIndex).length;
    const ids=persisted.filter(p=>p.type==='steering-message').map(p=>p.id);
    const unexpectedPostCancelInvocations=c==='tool-before-cancel'?postCancelInvocations:0;
    return {name,...schedule,frames,snapshot:await snapshot(),live,persisted,divergence:compare(live,persisted),postCancelInvocations,unexpectedPostCancelInvocations,duplicatePersistedChunks:ids.length-new Set(ids).size};
  } finally {
    for(const s of sockets) if(s.readyState!==WebSocket.CLOSED) s.terminate();
  }
}

export function chunk(frame:Frame):Part|undefined {
  if(frame.type!=='cf_agent_use_chat_response'||!frame.body||frame.done) return;
  try {return JSON.parse(frame.body) as Part;} catch {return;}
}
export function wireParts(frames:Frame[]):Part[] {
  const result:Part[]=[];
  const seenSeq=new Set<string>();
  const texts=new Map<string,Part>();
  const steering=new Set<unknown>();
  let request='';
  for(const frame of frames) {
    const c=chunk(frame);if(!c) continue;
    if(frame.seq!==undefined) {const key=`${frame.id}:${frame.seq}`;if(seenSeq.has(key))continue;seenSeq.add(key);}
    if(frame.id!==request) {request=frame.id??'';texts.clear();}
    if(c.type==='text-start'&&!texts.has(String(c.id))) {const p={type:'text',text:''};texts.set(String(c.id),p);result.push(p);}
    if(c.type==='text-delta') {const p=texts.get(String(c.id));if(p)p.text=String(p.text)+String(c.delta);}
    if(c.type==='steering-message'&&!steering.has(c.id)){steering.add(c.id);result.push(c);}
    if(c.type==='tool-input-available')result.push({type:`tool-${c.toolName}`,toolCallId:c.toolCallId,input:c.input});
  }
  return semanticParts(result);
}
