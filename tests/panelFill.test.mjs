import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const text = readFileSync(new URL('../panelFill.js', import.meta.url), 'utf8');
const {fillRegion} = vm.runInNewContext(`(() => {${text.replace(/^import .*;\n/gm, '').replace(/export /g, '')}; return {fillRegion};})()`,
    {GObject: {registerClass: c => c}, Clutter: {Constraint: class {}}});
test('fill respects center, opposite widgets, RTL and empty center', () => {
    const check = (args, expected) => assert.deepEqual(Array.from(fillRegion(...args)), expected);
    check([1000, 100, 0, 200, 'left', false], [0, 800]);
    check([1000, 100, 100, 200, 'left', false], [0, 450]);
    check([1000, 100, 0, 200, 'right', false], [100, 1000]);
    check([1000, 100, 0, 200, 'left', true], [200, 1000]);
    check([1000, 100, 0, 200, 'center', false], [200, 800]);
    check([100, 0, 0, 200, 'left', false], [0, 0]);
});
