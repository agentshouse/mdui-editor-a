import { connectHouseBridge } from '@agentshouse/app-bridge';
export type Runtime = Awaited<ReturnType<typeof connectHouseBridge>['runtime']>;
export async function connect() { const bridge = connectHouseBridge(); bridge.setTab({title:'Document editor'}); return {bridge, runtime:await bridge.runtime}; }
