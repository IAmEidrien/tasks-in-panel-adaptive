import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {visibleWindows,needsTitles,backgroundStyle}=await import(`data:text/javascript,${encodeURIComponent(readFileSync(new URL('../policy.js',import.meta.url),'utf8'))}`);
const win=(app,monitor=0,workspace=0)=>({app,get_monitor:()=>monitor,located_on_workspace:w=>w===workspace,get_transient_for:()=>null});
const key=w=>w.app;
test('filters determine dynamic presentation and group candidates before selection',()=>{
 const a=win('a'),b=win('b'),otherMonitor=win('a',1),otherWorkspace=win('a',0,1);
 const options={workspaceOnly:true,monitorOnly:true};
 const all=[a,b,otherMonitor,otherWorkspace];
 const shown=visibleWindows(all,options,0,0,b,key);
 assert.deepEqual(shown,[a,b]);assert.equal(needsTitles(shown,key),false);
 const a2=win('a');const shared=[a,b,a2];
 assert.equal(needsTitles(shared,key),true);
 assert.deepEqual(visibleWindows(shared,{...options,group:true},0,0,a,key),[a,b]);
 assert.deepEqual(visibleWindows(shared,{...options,group:true},0,0,a2,key),[a2,b]);
});
test('focused-only includes the parent of a focused transient dialog',()=>{
 const a=win('a'),b=win('b');const dialog={get_transient_for:()=>a};
 assert.deepEqual(visibleWindows([a,b],{focusedOnly:true},0,0,dialog,key),[a]);
});
test('hidden windows never force titles and custom CSS is confined to a single declaration',()=>{
 const a=win('a'),b=win('a');b.skip_taskbar=true;
 const shown=visibleWindows([a,b],{},0,0,null,key);assert.equal(needsTitles(shown,key),false);
 assert.equal(backgroundStyle(true,'red; font-size: 300px','theme'),'');
 assert.equal(backgroundStyle(true,'rgba(1,2,3,0.5)','bold'),'background-color: rgba(1,2,3,0.5);font-weight: bold;');
 assert.equal(backgroundStyle(false,'#ffffff','theme'),'');
});
