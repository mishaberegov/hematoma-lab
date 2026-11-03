import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const url=new URL('../dist/adaptive-worker.mjs',import.meta.url),worker=existsSync(url)?readFileSync(url,'utf8'):'';
test('adaptive computation runs off main thread with cancel and generation gate',()=>{
 assert.match(app,/new Worker\('\.\/adaptive-worker\.mjs/);
 assert.match(app,/adaptiveWorker\.terminate\(\)/);
 assert.match(app,/generation!==adaptiveGeneration/);
 assert.match(worker,/graphCutFill\(/);
});
