import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verify, validate} from '@agentshouse/mdmodel';
const expected=JSON.parse(fs.readFileSync('tests/support/starter-provenance.json','utf8'));
const library={};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){assert(!entry.isSymbolicLink());const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else library[path.relative('starter',file)]=fs.readFileSync(file,'utf8');}}
walk('starter');
assert.deepEqual(Object.keys(library).sort(),expected.map(row=>row.path).sort());
for(const row of expected)assert.equal(createHash('sha256').update(library[row.path]).digest('hex'),row.sha256,`Changed original starter ${row.path}`);
const model=verify(fs.readFileSync('schema.yaml','utf8'));assert.equal(model.verdict,'accept');
assert.deepEqual(validate(library,{binaryTargets:[]},model.model),{verdict:'accept'});
console.log(`Validated ${expected.length} unchanged licensed starter documents against the union schema.`);
