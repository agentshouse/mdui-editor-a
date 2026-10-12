import {describe,it,expect,vi} from 'vitest';
import {connectHouseBridge} from '@agentshouse/app-bridge';
import {createHouseBridgeTestHost} from '@agentshouse/app-bridge/test-host';
import {ArticleNavigation,articleAddress,readArticleAddress} from '../src/house/navigation';
describe('Editor House addresses',()=>{
 it('round trips separate Room/article identity including encoded filenames',()=>{
  const target={room:'r_19.z',path:'articles/Привет #1.md'};
  expect(readArticleAddress(articleAddress(target))).toEqual({target,ready:true,error:null});
  expect(readArticleAddress(null).ready).toBe(false);
  expect(readArticleAddress('/articles').target).toBeNull();
  for(const input of ['//evil.test','https://evil.test','/articles?room=r','/articles?path=a.md','/articles?room=r&path=../private','/articles?room=r&path=a.md&path=b.md','/articles?room=r&path=a.md&text=secret','/articles?room=r&path=%2Fprivate','/articles?room=r&path=a.md#save','/articles?room=r&path=a.md\n'])expect(readArticleAddress(input).error).toBeTruthy();
 });
 it('uses the official bridge for cold article, Back/Forward and explicit replace after deletion, without echo',async()=>{
  const target={room:'r',path:'articles/b.md'};
  const host=createHouseBridgeTestHost({address:articleAddress(target)}),nav=new ArticleNavigation(connectHouseBridge(host));const off=nav.subscribe(vi.fn());
  await vi.waitFor(()=>expect(nav.snapshot().target).toEqual(target));expect(host.navigations).toHaveLength(0);
  nav.navigate({room:'r',path:'articles/c.md'});await vi.waitFor(()=>expect(nav.snapshot().target?.path).toBe('articles/c.md'));
  host.open(articleAddress(target));await vi.waitFor(()=>expect(nav.snapshot().target).toEqual(target));expect(host.navigations).toHaveLength(1);
  nav.navigate(null,true);await vi.waitFor(()=>expect(nav.snapshot().target).toBeNull());expect(host.navigations[1]).toEqual({mode:'replace',address:'/articles'});off();
 });
});
