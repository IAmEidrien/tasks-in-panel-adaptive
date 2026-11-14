import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {ambiguousIcons,candidateWidths,suppressedApplications,revealValue}=await import(
 `data:text/javascript,${encodeURIComponent(readFileSync(new URL('../displayPolicy.js',import.meta.url),'utf8'))}`);
test('ambiguity uses rendered identity, not application grouping',()=>{
 const entries=[{id:'firefox1',icon:'firefox'},{id:'firefox2',icon:'firefox'},
  {id:'firefox3',icon:'firefox'},{id:'clock',icon:'clock'},
  {id:'appA',icon:'fallback'},{id:'appB',icon:'fallback'}];
 assert.deepEqual([...ambiguousIcons(entries)],['firefox1','firefox2','firefox3','appA','appB']);
 assert.equal(ambiguousIcons([{id:'representative',icon:'firefox'}]).size,0);
});
test('counterfactual widths share space fairly, clamp at natural widths and retain usable minima',()=>{
 const e=[{minimum:44,natural:80},{minimum:44,natural:800},{minimum:44,natural:44}];
 assert.deepEqual(candidateWidths(e,300),[80,176,44]);
 assert.deepEqual(candidateWidths(e,80),[44,44,44]);
 assert.deepEqual(candidateWidths(e,1000),[80,800,44]);
 assert.deepEqual(candidateWidths([...e].reverse(),300),[44,176,80]);
});
test('suppression is application-wide, independent across shared icons and has a restore margin',()=>{
 const e=[{app:'A',title:true,required:70},{app:'A',title:true,required:60},
  {app:'B',title:true,required:45},{app:'C',title:false,required:500}];
 const readable=(m,w)=>w>=m.required;
 assert.deepEqual([...suppressedApplications(e,[69,80,50,44],new Set(),readable,2)],['A']);
 assert.deepEqual([...suppressedApplications(e,[71,80,50,44],new Set(['A']),readable,2)],['A']);
 assert.equal(suppressedApplications(e,[72,80,50,44],new Set(['A']),readable,2).size,0);
 // Repeated evaluation never uses the freed icon-only space as its input.
 const widths=[69,80,50,44];let previous=new Set();
 for(let n=0;n<20;n++){previous=suppressedApplications(e,widths,previous,readable,2);assert.deepEqual([...previous],['A']);}
});
test('focus reveal moves only the required distance and clamps after shrinking',()=>{
 assert.equal(revealValue(100,200,140,80,800),100);
 assert.equal(revealValue(100,200,80,80,800),80);
 assert.equal(revealValue(100,200,260,80,800),140);
 assert.equal(revealValue(100,200,50,400,800),100);
 assert.equal(revealValue(0,200,250,400,800),250);
 assert.equal(revealValue(500,200,100,80,250),50);
});

test('a complete short title can restore at its natural width without spare pixels',()=>{
 const entry={app:'short',title:true,fullNatural:50,required:50};
 assert.equal(suppressedApplications([entry],[50],new Set(['short']),(m,w)=>w>=m.required,2).size,0);
});
