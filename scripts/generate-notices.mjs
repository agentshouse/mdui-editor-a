import fs from 'node:fs';
import crypto from 'node:crypto';
const root='public/licenses';fs.mkdirSync(root,{recursive:true});
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const inventory=[];
const supplemental=JSON.parse(fs.readFileSync(`${root}/upstream-notices.json`,'utf8'));
for(const entry of Object.values(supplemental)){if(crypto.createHash('sha256').update(fs.readFileSync(`${root}/${entry.notice}`)).digest('hex')!==entry.sha256)throw new Error(`Changed upstream notice ${entry.notice}`);}
for(const [key,value] of Object.entries(lock.packages)){
 if(!key || !fs.existsSync(`${key}/package.json`))continue;
 const pkg=JSON.parse(fs.readFileSync(`${key}/package.json`,'utf8'));const licenseFiles=fs.readdirSync(key).filter(name=>/^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(name)&&fs.statSync(`${key}/${name}`).isFile());
 const upstreamNotice=supplemental[`${pkg.name}@${pkg.version}`];if(!value.dev&&!licenseFiles.length&&!upstreamNotice)throw new Error(`Missing production notice: ${pkg.name}@${pkg.version}`);
 inventory.push({supplementalNotice:upstreamNotice?.notice,name:pkg.name,version:pkg.version,license:pkg.license||'UNSPECIFIED',source:typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url||'',developmentOnly:!!value.dev,noticeFiles:licenseFiles});
 for(const file of licenseFiles)fs.copyFileSync(`${key}/${file}`,`${root}/${pkg.name.replaceAll('/','_').replaceAll('@','')}-${pkg.version}-${file.replaceAll('/','_')}.txt`);
}
inventory.sort((a,b)=>a.name.localeCompare(b.name));
const content=JSON.stringify(inventory,null,2)+'\n';
if(process.argv.includes('--check')&&fs.readFileSync(`${root}/dependency-inventory.json`,'utf8')!==content)throw new Error('License inventory is stale');
fs.writeFileSync(`${root}/dependency-inventory.json`,content);fs.copyFileSync('LICENSE',`${root}/dokieli-Apache-2.0.txt`);
console.log(`Inventoried ${inventory.length} installed packages, exact versions and notices`);
