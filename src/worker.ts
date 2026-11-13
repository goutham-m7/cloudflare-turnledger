import { AIChatAgent, type OnChatMessageOptions } from '@cloudflare/ai-chat';
import { routeAgentRequest } from 'agents';
import type { GenerateTextOnFinishCallback, ToolSet } from 'ai';

interface Env { Chat: DurableObjectNamespace<LedgerChat> }

/** Only the model is scripted. SDK owns message reconstruction, stream replay and SQLite. */
export class LedgerChat extends AIChatAgent<Env> {
  private controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  private hasTool = false;
  private sequence = 0;

  private record(kind: string, data: unknown) {
    this.sql`CREATE TABLE IF NOT EXISTS turnledger_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, data TEXT NOT NULL)`;
    this.sql`INSERT INTO turnledger_events (kind,data) VALUES (${kind}, ${JSON.stringify(data)})`;
  }
  private emit(chunk: Record<string, unknown>) {
    if (!this.controller) throw new Error('no active deterministic stream');
    this.record('model-chunk',chunk);
    this.controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
  }
  override async onChatMessage(_finish: GenerateTextOnFinishCallback<ToolSet>, options?: OnChatMessageOptions): Promise<Response> {
    this.record('invocation',{requestId:options?.requestId,continuation:options?.continuation??false});
    if (options?.continuation) {
      return new Response('data: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    }
    this.hasTool = Boolean(options?.body?.tool);
    const number = ++this.sequence;
    const stream=new ReadableStream<Uint8Array>({
      start: controller=>{this.controller=controller;},
      cancel: ()=>{this.controller=undefined;this.record('model-stream-cancelled',{});}
    });
    options?.abortSignal?.addEventListener('abort',()=>{this.record('cancel-observed',{requestId:options.requestId});},{once:true});
    this.emit({type:'start',messageId:`assistant-${number}`});
    this.emit({type:'start-step'});
    this.emit({type:'text-start',id:`text-${number}`});
    this.emit({type:'text-delta',id:`text-${number}`,delta:'Finding a place. '});
    if (this.hasTool) {
      this.emit({type:'tool-input-start',toolCallId:'lookup-1',toolName:'lookup'});
      this.emit({type:'tool-input-available',toolCallId:'lookup-1',toolName:'lookup',input:{city:'Paris'}});
    }
    return new Response(stream,{headers:{'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}});
  }
  private finish() {
    this.emit({type:'text-end',id:`text-${this.sequence}`});
    this.emit({type:'finish-step'});
    this.emit({type:'finish',finishReason:this.hasTool?'tool-calls':'stop'});
    this.controller?.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
    this.controller?.close();
    this.controller=undefined;
  }
  override async onRequest(request: Request): Promise<Response> {
    const path=new URL(request.url).pathname.split('/').pop();
    if (path==='snapshot' && request.method==='GET') {
      this.sql`CREATE TABLE IF NOT EXISTS turnledger_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, data TEXT NOT NULL)`;
      const events=this.sql<{seq:number;kind:string;data:string}>`SELECT seq,kind,data FROM turnledger_events ORDER BY seq`.map(e=>({...e,data:JSON.parse(e.data)}));
      return Response.json({messages:this.messages,events,invocations:events.filter(e=>e.kind==='invocation'),active:Boolean(this.controller)});
    }
    if (path==='control' && request.method==='POST') {
      let command: {action?:unknown;id?:unknown;text?:unknown};
      try {command=await request.json();} catch {return Response.json({error:'invalid JSON'},{status:400});}
      if (!['steer','delta','finish','mark'].includes(String(command.action))) return Response.json({error:'unknown action'},{status:400});
      if (command.action!=='mark' && !this.controller) return Response.json({error:'no active stream'},{status:409});
      if (command.action==='steer' && (typeof command.id!=='string'||typeof command.text!=='string')) return Response.json({error:'steer requires id and text'},{status:400});
      this.record('control',command);
      if (command.action==='steer') this.emit({type:'steering-message',id:command.id,parts:[{type:'text',text:command.text}]});
      if (command.action==='delta') this.emit({type:'text-delta',id:`text-${this.sequence}`,delta:'Use the verified location. '});
      if (command.action==='finish') this.finish();
      return Response.json({ok:true});
    }
    return Response.json({error:'not found'},{status:404});
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname==='/health') return new Response('ok');
    return await routeAgentRequest(request,env) ?? new Response('Not found',{status:404});
  }
};
