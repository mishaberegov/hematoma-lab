import test from 'node:test';
import assert from 'node:assert/strict';
import {inputGeneration} from '../dist/input-generation.mjs';

test('a newer input invalidates an unfinished directory traversal',async()=>{
 const gate=inputGeneration();
 const older=gate.begin();
 let resolve;
 const traversal=new Promise(r=>resolve=r);
 const delayed=traversal.then(()=>gate.current(older));
 const newer=gate.begin();
 resolve();
 assert.equal(await delayed,false);
 assert.equal(gate.current(newer),true);
});
