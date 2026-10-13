import { checkCurrentStarter } from './check-current-starter.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {verify, validate} from '@agentshouse/mdmodel';
const library={};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){assert(!entry.isSymbolicLink());const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else library[path.relative('starter',file)]=fs.readFileSync(file,'utf8');}}
walk('starter');
checkCurrentStarter(library);
const model=verify(fs.readFileSync('schema.yaml','utf8'));assert.equal(model.verdict,'accept');
assert.deepEqual(validate(library,{binaryTargets:[]},model.model),{verdict:'accept'});
console.log(`Validated ${Object.keys(library).length} current starter documents against the union schema.`);
