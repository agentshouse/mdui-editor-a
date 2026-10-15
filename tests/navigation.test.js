import {describe,it,expect,vi} from 'vitest';
import {houseBridge} from '@agentshouse/app-bridge';
import {createHouseBridgeTestHost} from '@agentshouse/app-bridge/test-host';
import {ArticleNavigation,articleAddress,readArticleAddress} from '../src/house/navigation';
describe('Editor House addresses',()=>{
 it('round trips the Site handle and document path without the markdown suffix in the address',()=>{
  const target={handle:'lively-ember-6ajm',path:'articles/Привет #1.md'};
  expect(readArticleAddress(articleAddress(target))).toEqual({target,ready:true,error:null});
  expect(readArticleAddress('/articles/lively-ember-6ajm/articles/alpha')).toEqual({target:{handle:'lively-ember-6ajm',path:'articles/alpha.md'},ready:true,error:null});
  expect(readArticleAddress(null).ready).toBe(false);
  expect(readArticleAddress('/').target).toBeNull();
  expect(readArticleAddress('/articles').target).toBeNull();
  for(const input of ['//evil.test','https://evil.test','/articles?room=r&path=a.md','/articles/r','/articles/r/../private','/articles/r/a.md','/articles/r/a.md?text=secret','/articles/r/%2Fprivate','/articles/r/a.md#save','/articles/r/a.md\n'])expect(readArticleAddress(input).error).toBeTruthy();
 });
 it('uses the official bridge for cold article, Back/Forward and explicit replace after deletion, without echo',async()=>{
  const target={handle:'r',path:'articles/b.md'};
  const host=createHouseBridgeTestHost({address:articleAddress(target)}),nav=new ArticleNavigation(houseBridge());const off=nav.subscribe(vi.fn());
  await vi.waitFor(()=>expect(nav.snapshot().target).toEqual(target));expect(host.navigations).toHaveLength(0);
  nav.navigate({handle:'r',path:'articles/c.md'});await vi.waitFor(()=>expect(nav.snapshot().target?.path).toBe('articles/c.md'));
  host.open(articleAddress(target));await vi.waitFor(()=>expect(nav.snapshot().target).toEqual(target));expect(host.navigations).toHaveLength(1);
  nav.navigate(null,true);await vi.waitFor(()=>expect(nav.snapshot().target).toBeNull());expect(host.navigations[1]).toEqual({mode:'replace',address:'/articles'});off();
 });
});
