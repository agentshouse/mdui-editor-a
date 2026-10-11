import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
fs.rmSync('.build/public',{recursive:true,force:true});
fs.cpSync('public','.build/public',{recursive:true});
execFileSync(process.execPath,['scripts/generate-notices.mjs'],{stdio:'inherit'});
for(const file of ['app.json','schema.yaml'])fs.copyFileSync(file,`.build/public/${file}`);
