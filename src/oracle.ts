export type Part = Record<string, unknown> & { type: string };
export type Divergence = { index: number; live: Part | null; persisted: Part | null };

export function semanticParts(parts: Part[]): Part[] {
  return parts.filter(p => p.type !== 'step-start').map(p => {
    if (p.type === 'text') return { type: p.type, text: p.text };
    if (p.type === 'steering-message') return { type: p.type, id: p.id, parts: p.parts };
    if (p.type.startsWith('tool-')) return { type: p.type, toolCallId:p.toolCallId, input:p.input, ...(p.output !== undefined ? {output:p.output} : {}) };
    return p;
  });
}

export function compare(live: Part[], persisted: Part[]): Divergence | null {
  for (let index=0; index<Math.max(live.length,persisted.length); index++) {
    if (JSON.stringify(live[index]) !== JSON.stringify(persisted[index])) return {index,live:live[index]??null,persisted:persisted[index]??null};
  }
  return null;
}

export const cases = [
  'steer-once','steer-replay','steer-between-text','steer-two',
  'tool-before-cancel','tool-after-cancel','cancel-before-tool','tool-no-cancel',
  'reconnect-text','reconnect-steer','reconnect-replay-steer','reconnect-tool'
] as const;
export type CaseId = typeof cases[number];
export function schedules(seed: number, count: number) {
  if (!Number.isInteger(count) || count < 0) throw new Error('count must be a nonnegative integer');
  let state = seed >>> 0;
  return Array.from({length:count}, (_,index) => {
    state = (Math.imul(1664525,state)+1013904223)>>>0;
    return {seed:state,caseId:cases[index%cases.length],variant:state%3};
  });
}
