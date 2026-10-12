import { houseBridge } from '@agentshouse/app-bridge';
export type Runtime = Awaited<ReturnType<typeof houseBridge>['runtime']>;
export async function connect() { const bridge = houseBridge(); bridge.setTab({title:'Document editor'}); return {bridge, runtime:await bridge.runtime}; }
