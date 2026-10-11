import DOMPurify from 'dompurify';
const attributes = ['about','content','datatype','inlist','prefix','property','rel','resource','rev','typeof','vocab','xml:lang'];
export function htmlEncode(value,_options={}) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
export function sanitizeArticle(value) {
 const html = DOMPurify.sanitize(String(value), { ADD_ATTR: attributes, ADD_URI_SAFE_ATTR: attributes, FORBID_TAGS: ['script','style','link','meta','base','iframe','object','embed','audio','video','source','track'], FORBID_ATTR: ['srcset','poster','background','ping','action','formaction','autofocus','form','inert'] });
 const node = document.createElement('template'); node.innerHTML = html;
 for (const el of node.content.querySelectorAll('*')) {
   for (const attr of [...el.attributes]) {
     if (attr.name.startsWith('on') || attr.name.startsWith('data-house') || attr.name === 'contenteditable' || (['fill','stroke','filter','mask','clip-path','cursor','marker-start','marker-mid','marker-end'].includes(attr.name) && /url\s*\(/i.test(attr.value) && !/^url\(#[a-zA-Z0-9_-]+\)$/.test(attr.value.trim()))) el.removeAttribute(attr.name);
   }
   if (/^(house-|new-|article-|edit-|save-|export-|archive-|reload-|menu-toggle|room-select|show-archived|cancel-new|source-view|source-edit|source-article|theme-toggle|add-slide|prev-slide|next-slide|document-menu|document-do|document-tools|document-theme|menu-actions|menu-tools|menu-settings|menu-group-|do-theme-|document-slashmenu|document-table|document-editor|editor-)/.test(el.id)) el.removeAttribute('id');
   if (el.hasAttribute('style')) { const align = el.style.textAlign; el.removeAttribute('style'); if (['left','center','right'].includes(align)) el.style.textAlign = align; }
   if (el.hasAttribute('src')) { const src = el.getAttribute('src'); if (!['./media/images/logo.png','./media/images/dokieli-192.png','./media/images/dokieli-512.png','media/images/logo.png','media/images/dokieli-192.png','media/images/dokieli-512.png'].includes(src) && !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src || '')) el.removeAttribute('src'); }
   for (const name of ['href','xlink:href']) if (el.hasAttribute(name)) { const href = el.getAttribute(name); if (el.localName !== 'a' || !/^(https?:\/\/|mailto:|#)/i.test(href || '')) el.removeAttribute(name); }
   if(el.localName==='input'&&!['text','email','url','tel','number','date','datetime-local','time','checkbox','radio','range','hidden'].includes(el.getAttribute('type')||'text'))el.setAttribute('type','text');
   if(el.localName==='img')el.setAttribute('loading','lazy');
   if(el.localName==='button')el.setAttribute('type','button');
   if(el.localName==='form')el.setAttribute('data-house-local-form','true');
   if (el.localName === 'a' && /^(https?:|mailto:)/i.test(el.getAttribute('href') || '')) { el.setAttribute('rel', [...new Set([...(el.getAttribute('rel') || '').split(/\s+/).filter(Boolean),'noopener','noreferrer'])].join(' ')); el.setAttribute('target','_blank'); }
 }
 return node.innerHTML;
}
export function domSanitize(html) {
 const template=document.createElement('template');template.innerHTML=DOMPurify.sanitize(html,{ADD_ATTR:attributes,ADD_URI_SAFE_ATTR:attributes,FORBID_TAGS:['script','style','link','meta','base','iframe','object','embed','audio','video','source','track'],FORBID_ATTR:['srcset','poster','background','ping','action','formaction']});
 for(const node of template.content.querySelectorAll('*'))for(const attr of [...node.attributes]) {
  if(['style','fill','stroke','filter','mask','clip-path','cursor','marker-start','marker-mid','marker-end'].includes(attr.name)&&/url\s*\(/i.test(attr.value)&&!/^url\(#[a-zA-Z0-9_-]+\)$/.test(attr.value.trim()))node.removeAttribute(attr.name);
  if(['href','xlink:href'].includes(attr.name)&&node.localName!=='a'&&!attr.value.startsWith('#'))node.removeAttribute(attr.name);
  if(attr.name==='src'&&!/^(?:data:image\/(?:png|jpeg|gif|webp);base64,|blob:|(?:\.\/)?media\/images\/)/.test(attr.value))node.removeAttribute(attr.name);
 }
 return template.innerHTML;
}
export function sanitizeInsertAdjacentHTML(node, position, html) { node.insertAdjacentHTML(position, domSanitize(html)); }
