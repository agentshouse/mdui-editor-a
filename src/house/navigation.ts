import type { HouseBridge } from '@agentshouse/app-bridge';
export type ArticleTarget = { room: string; path: string };
export type NavigationBridge = Pick<HouseBridge,'address'|'onAddress'|'push'|'replace'>;
export type ArticleRoute = { target: ArticleTarget | null; ready: boolean; error: string | null };
const safeRoom = (value: string) => /^[a-zA-Z0-9_.-]{1,256}$/.test(value);
const safePath = (value: string) => value.length > 0 && value.length <= 512 && !value.includes('\\') && ![...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127) && value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');
export function articleAddress(target: ArticleTarget | null): string {
  if (!target) return '/articles';
  if (!safeRoom(target.room)||!safePath(target.path)) throw new Error('Invalid article address.');
  const query = new URLSearchParams({room:target.room,path:target.path});
  const address=`/articles?${query}`;
  if(address.length>1000)throw new Error('This article link is too long.');
  return address;
}
export function readArticleAddress(address: string | null): ArticleRoute {
  if(address===null)return {target:null,ready:false,error:null};
  try {
    if(address.length>1000||[...address].some(c=>c.charCodeAt(0)<=32||c.charCodeAt(0)===127)||!/^\/(?:articles)?(?:\?|$)/.test(address))throw new Error();
    const [pathname,query='']=address.split('?');
    if(address.includes('#')||!['/','/articles'].includes(pathname)||address.split('?').length>2)throw new Error();
    const searchParams=new URLSearchParams(query);
    const keys=[...searchParams.keys()];
    if(keys.some(key=>!['room','path'].includes(key))||new Set(keys).size!==keys.length)throw new Error();
    if(!keys.length)return {target:null,ready:true,error:null};
    const room=searchParams.get('room'),path=searchParams.get('path');
    if(!room||!path||!safeRoom(room)||!safePath(path))throw new Error();
    return {target:{room,path},ready:true,error:null};
  } catch { return {target:null,ready:true,error:'This article link is invalid. Choose an article from the library.'}; }
}

/** House owns history. Serial requests coalesce rapid clicks, while host events
 * never echo a navigation or write Room data. Stale failures cannot replace a
 * later host selection. No runtime/data loading is needed to retain a deep link. */
export class ArticleNavigation {
  private state: ArticleRoute;
  private listeners = new Set<() => void>();
  private close?: () => void;
  private sequence = 0;
  private active: { address: string; sequence: number; replace: boolean } | null = null;
  private queued: { address: string; sequence: number; replace: boolean } | null = null;
  constructor(private bridge: NavigationBridge) { this.state = readArticleAddress(bridge.address()); }
  snapshot = () => this.state;
  private update(next: ArticleRoute) {
    if (JSON.stringify(next.target) === JSON.stringify(this.state.target) && next.ready === this.state.ready && next.error === this.state.error) return;
    this.state = next;
    this.listeners.forEach(listener => listener());
  }
  private receive = (address: string) => {
    if (this.active && address !== this.active.address) {
      this.sequence++;
      this.queued = null;
    }
    this.update(readArticleAddress(address));
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.close) {
      this.close = this.bridge.onAddress(this.receive);
      const current = this.bridge.address();
      if (current !== null) this.receive(current);
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.close?.();
        this.close = undefined;
        this.active = null;
        this.sequence++;
        this.queued = null;
      }
    };
  };
  navigate(target: ArticleTarget | null, replace = false) {
    let address: string;
    try { address = articleAddress(target); }
    catch { this.update({ ...this.state, error: "Invalid article address." }); return; }
    if (!this.active && this.state.ready && JSON.stringify(this.state.target) === JSON.stringify(target) && !this.state.error) return;
    this.queued = { address, sequence: ++this.sequence, replace };
    this.drain();
  }
  private drain() {
    if (this.active || !this.queued || !this.listeners.size) return;
    const request = this.queued;
    this.queued = null;
    this.active = request;
    void this.bridge[request.replace ? "replace" : "push"](request.address).then(address => {
      if (request.sequence === this.sequence && this.listeners.size) this.update(readArticleAddress(address));
    }).catch(error => {
      if (request.sequence === this.sequence && this.listeners.size) {
        this.update({ ...this.state, error: error instanceof Error ? error.message : "House refused navigation." });
      }
    }).finally(() => {
      if (this.active === request) {
        this.active = null;
        this.drain();
      }
    });
  }
}
