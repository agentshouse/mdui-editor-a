import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/generate-notices.mjs'],{stdio:'inherit'});
for(const file of ['app.json','schema.yaml'])fs.copyFileSync(file,`public/${file}`);
