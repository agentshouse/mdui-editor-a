import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const env = new JSDOM('');globalThis.window=env.window;globalThis.document=env.window.document;
const {sanitizeArticle}=await import('../src/utils/sanitization.js');
const revision='7deba503d5a5f5ea239aafaa630b705311453e81';
const records=[];
for(const [file,id,url] of [['docs.html','dokieli-documentation','https://dokie.li/docs'],['index.html','dokieli-overview','https://dokie.li/']]){
 const dom=new JSDOM(fs.readFileSync(`tests/support/upstream/${file}`,'utf8'));
 const article=dom.window.document.querySelector('main > article');if(!article)throw new Error('Donor article missing');
 for(const a of article.querySelectorAll('a[href]'))if(!a.getAttribute('href').startsWith('#'))a.href=new URL(a.getAttribute('href'),url).href;
 for(const img of article.querySelectorAll('img[src]')){const path=img.getAttribute('src');if(path.startsWith('media/'))img.src=`./${path}`;}
 const html=sanitizeArticle(article.innerHTML);const title=article.querySelector('h1').textContent.trim();
 const fields={type:'document_article',title,html,archived:false,source_url:url,source_revision:revision,author:'Sarven Capadisli and dokieli contributors',license:'CC BY 4.0',license_url:'https://creativecommons.org/licenses/by/4.0/'};
 const content=`---\n${Object.entries(fields).map(([key,value])=>`${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\nLicensed donor article adapted for offline House editing. Active scripts, remote embeds and remote image loads are excluded; source links and attribution are retained.\n`;
 records.push({id,title,path:`articles/${id}.md`,content});
 fs.writeFileSync(`tests/support/samples/${id}.html`,html);
}
fs.writeFileSync('tests/support/samples/articles.json',JSON.stringify(records,null,2)+'\n');
console.log(`Prepared ${records.length} licensed donor articles`);
