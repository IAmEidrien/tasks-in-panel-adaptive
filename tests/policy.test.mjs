import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {visibleWindows,backgroundStyle}=await import(`data:text/javascript,${encodeURIComponent(readFileSync(new URL('../policy.js',import.meta.url),'utf8'))}`);
const win=(app,monitor=0,workspace=0)=>({app,get_monitor:()=>monitor,located_on_workspace:w=>w===workspace,get_transient_for:()=>null});
const key=w=>w.app;
test('filters determine visible and grouped candidates before title eligibility',()=>{
 const a=win('a'),b=win('b'),otherMonitor=win('a',1),otherWorkspace=win('a',0,1);
 const options={workspaceOnly:true,monitorOnly:true};
 const all=[a,b,otherMonitor,otherWorkspace];
 const shown=visibleWindows(all,options,0,0,b,key);
 assert.deepEqual(shown,[a,b]);
 const a2=win('a');const shared=[a,b,a2];
 assert.deepEqual(visibleWindows(shared,{...options,group:true},0,0,a,key),[a,b]);
 assert.deepEqual(visibleWindows(shared,{...options,group:true},0,0,a2,key),[a2,b]);
});
test('focused-only includes the parent of a focused transient dialog',()=>{
 const a=win('a'),b=win('b');const dialog={get_transient_for:()=>a};
 assert.deepEqual(visibleWindows([a,b],{focusedOnly:true},0,0,dialog,key),[a]);
});
test('hidden windows are excluded and custom CSS is confined to a single declaration',()=>{
 const a=win('a'),b=win('a');b.skip_taskbar=true;
 const shown=visibleWindows([a,b],{},0,0,null,key);assert.deepEqual(shown,[a]);
 assert.equal(backgroundStyle(true,'red; font-size: 300px','theme'),'');
 assert.equal(backgroundStyle(true,'rgba(1,2,3,0.5)','bold'),'background-color: rgba(1,2,3,0.5);font-weight: bold;');
 assert.equal(backgroundStyle(false,'#ffffff','theme'),'');
});

const {readOverviewOrder,orderedWindows}=await import(`data:text/javascript,${encodeURIComponent(readFileSync(new URL('../overviewOrder.js',import.meta.url),'utf8'))}`);
test('overview order reads actual rows, deduplicates sticky windows and tolerates absent layouts',()=>{
 const a={},b={},c={};
 const workspace=(index,monitor,rows)=>({metaWorkspace:{index:()=>index},_monitorIndex:monitor,_container:{layout_manager:{_layout:{rows:rows.map(windows=>({windows:windows.map(metaWindow=>({metaWindow}))}))}}}});
 const overview={_overview:{controls:{_workspacesDisplay:{_workspacesViews:[{_workspaces:[workspace(1,0,[[c]]),workspace(0,0,[[b,a]])]},{_workspace:workspace(0,1,[[a]])}]}}}};
 assert.deepEqual(readOverviewOrder(overview),[b,a,c]);
 assert.deepEqual(readOverviewOrder(null),[]);
 assert.deepEqual(readOverviewOrder({get _overview(){throw Error('unavailable');}}),[]);
 assert.deepEqual(readOverviewOrder({_overview:{controls:{}}}),[]);
});
test('overview snapshots remain stable while new windows append by creation sequence',()=>{
 const a={get_stable_sequence:()=>1},b={get_stable_sequence:()=>2},c={get_stable_sequence:()=>3};
 assert.deepEqual(orderedWindows([c,a,b],new Map()),[a,b,c]);
 assert.deepEqual(orderedWindows([a,c,b],new Map([[b,0],[a,1]])),[b,a,c]);
});
