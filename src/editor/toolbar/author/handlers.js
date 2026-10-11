/*!
Copyright 2012-2026 Sarven Capadisli <https://csarven.ca/>
Copyright 2023-2026 Virginia Balseiro <https://virginiabalseiro.com/>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


import {restoreSelection} from '../../../house/annotation.js';
import {generateAttributeId} from '../../../util.js';
export function createRDFaMarkObject(r) {
  //Generic
  let about = r['about'];
  let resource = r['resource'];
  let typeOf = r['typeof'];
  let rel = r['rel'];
  let property = r['property'];
  let href = r['href'];
  let content = r['content'];
  let lang = r['lang'];
  let datatype = r['datatype'];

  let id = generateAttributeId();

  about = about || '#' + id;

  //TODO: Figure out how to use user's preferred vocabulary. Huh?
  property = property || 'rdfs:label';

  let xmlLang = lang;
  datatype = lang ? undefined : datatype;

  let element = ('datatype' in r && r.datatype == 'xsd:dateTime') ? 'time' : ((href == '') ? 'span' : 'a');

  let attrs = { id, about, resource, 'typeof': typeOf, rel, property, href, content, lang, 'xml:lang': xmlLang, datatype };

  return { element, attrs }
}


import {schema} from '../../schema/base.js';
import {getFormValues} from '../../../utils/html.js';
import {toggleBlockquote} from '../../utils/dom.js';
export function formHandlerLanguage(e) {
  e.preventDefault();
  e.stopPropagation();

  const formValues = getFormValues(e.target);
  const lang = formValues['set-lang'];
  const attrs = { lang, 'xml:lang': lang };

  const { state, dispatch } = this.editorView;
  const { from, to } = state.selection;

  const content = state.doc.slice(from, to).content;

  dispatch(state.tr.addMark(from, to, schema.marks.span.create({ originalAttributes: attrs })));

  this.clearToolbarForm(e.target);
  this.clearToolbarButton('lang');
}


export function formHandlerA(e) {
  e.preventDefault();
  e.stopPropagation();

  const formValues = getFormValues(e.target);
  const href = formValues['a-href'];
  const title = formValues['a-title'];

  const attrs = title ? { href, title } : { href };

  this.updateMarkWithAttributes(schema, 'a', attrs)(this.editorView.state, this.editorView.dispatch);

  this.clearToolbarForm(e.target);
  this.clearToolbarButton('a');
}

export function formHandlerBlockquote(e) {
  e.preventDefault();
  e.stopPropagation();

  const formValues = getFormValues(e.target);
  const cite = formValues['blockquote-cite'];

  const attrs = { originalAttributes: { cite } };

  toggleBlockquote(schema, attrs)(this.editorView.state, this.editorView.dispatch);

  this.clearToolbarForm(e.target);
  this.clearToolbarButton('blockquote');
}

export function formHandlerQ(e) {
  e.preventDefault();
  e.stopPropagation();

  const formValues = getFormValues(e.target);
  const cite = formValues['q-cite'];

  const attrs = { cite };

  this.updateMarkWithAttributes(schema, 'q', attrs)(this.editorView.state, this.editorView.dispatch);

  this.clearToolbarForm(e.target);
  this.clearToolbarButton('q');
}

// UPDATE this with what's in social/handlers.js; consider moving to one location and refer to processActions particular to each subclass
export function formHandlerSemantics(e, action) {
  e.preventDefault();
  e.stopPropagation();
  const data = {};

  restoreSelection(this.selection);
  // TODO: use prosemirror selection
  // const selection = window.getSelection();

  // const range = selection.getRangeAt(0);
  // const selectedParentElement = getSelectedParentElement(range);
  // console.log(e.target)

  const formValues = getFormValues(e.target);
  // console.log(formValues);

  //TODO: Copied from social/handlers.js getFormActionData
  Object.entries(formValues).forEach(([key, value]) => {
    if (key.startsWith(`${action}-`)) {
      data[key.substring(action.length + 1)] = value;
    }
  });

  let { element, attrs } = createRDFaMarkObject(data);

  attrs = Object.fromEntries(
    Object.entries(attrs).filter(([_, value]) => value)
  );
  // console.log(element, attrs)

  this.updateMarkWithAttributes(schema, element, attrs)(this.editorView.state, this.editorView.dispatch);

  this.clearToolbarForm(e.target);
  this.clearToolbarButton('semantics');
}

// Local composition branch of the donor annotation actions. No actor or author is fabricated.
import {parseMarkdown} from '../../../house/markdown.js';
import {renderFootnote} from '../../utils/reference-render.js';
import {fragmentFromString} from '../../../utils/html.js';
import {htmlEncode,sanitizeArticle} from '../../../utils/sanitization.js';
function insertLocalFootnote(toolbar,e,kind) {
 e.preventDefault();e.stopPropagation();if(!toolbar.editorView.editable)return;
 const values=getFormValues(e.target),url=values['citation-url']||'',content=values[`${kind}-content`]||'';
 if(url&&!/^https?:\/\//i.test(url))return;
 if(!url&&!content.trim())return;
 const id=generateAttributeId(),refId=`ref-${id}`;
 let count=0;toolbar.editorView.state.doc.descendants(node=>{if(node.attrs.originalAttributes?.class?.split(' ').includes('ref'))count++;});
 const label=String(count+1),selected=toolbar.getSelectionAsHTML();
 const ref=`<span class="ref" id="${refId}"><mark>${selected}</mark><sup><a href="#${id}" rel="oa:hasAnnotation">${label}</a></sup></span>`;
 const note=renderFootnote({id,refId,refLabel:label,motivatedBy:values['citation-reason']||'http://www.w3.org/ns/oa#commenting',citationURL:htmlEncode(url,{mode:'attribute'}),body:[{value:sanitizeArticle(parseMarkdown(content))}]});
 const noteFragment=fragmentFromString(sanitizeArticle(`<aside class="note">${note}</aside>`));
 const body=noteFragment.querySelector('[property="rdf:value"]'),language=values[`${kind}-language`],license=values[`${kind}-license`];
 if(language){body.setAttribute('lang',language);body.setAttribute('xml:lang',language);}
 if(license&&/^https?:\/\//.test(license)){const link=document.createElement('a');link.setAttribute('rel','schema:license');link.href=license;link.textContent=license;body.append(link);}
 const tags=(values[`${kind}-tagging`]||'').split(',').map(tag=>tag.trim()).filter(Boolean);for(const tag of tags){const span=document.createElement('span');span.setAttribute('property','schema:keywords');span.textContent=tag;body.append(span);}
 toolbar.replaceSelectionWithInlineFragment(fragmentFromString(sanitizeArticle(ref)));
 toolbar.insertFragmentInNode(noteFragment);
 toolbar.clearToolbarForm(e.target);toolbar.clearToolbarButton(kind);
}
export function formHandlerAnnotate(e){insertLocalFootnote(this,e,'note');}
export function formHandlerCitation(e){insertLocalFootnote(this,e,'citation');}
export function formHandlerRequirement(e){
 e.preventDefault();e.stopPropagation();if(!this.editorView.editable||e.target.querySelector('.editor-form-submit')?.disabled)return;
 const preview=e.target.querySelector('#requirement-preview-samp');if(!preview?.textContent.trim())return;
 this.replaceSelectionWithInlineFragment(fragmentFromString(sanitizeArticle(preview.innerHTML)));
 this.clearToolbarForm(e.target);this.clearToolbarButton('requirement');
}

// House adaptation: local raster files are embedded in the guarded article HTML, never uploaded to an external service.
export async function formHandlerImg(e) {
 e.preventDefault();e.stopPropagation();const form=e.target;form.querySelector('.house-image-error')?.remove();
 try {
  const values=getFormValues(form),file=form.querySelector('[name="img-file"]').files?.[0];let src=values['img-src'];
  if(file){if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)||file.size>1_000_000)throw new Error('Choose a PNG, JPEG, GIF or WebP file smaller than 1 MB.');src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the image.'));reader.readAsDataURL(file);});}
  if(!/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src||'')&&!['./media/images/logo.png','./media/images/dokieli-192.png','./media/images/dokieli-512.png'].includes(src))throw new Error('Remote image URLs are disabled. Choose a local image file.');
  if(!this.editorView.dom.isConnected||!this.editorView.editable)return;
  this.insertImage({src,alt:values['img-alt']||'',title:values['img-figcaption']||''})(this.editorView.state,this.editorView.dispatch);form.querySelector('.img-preview').replaceChildren();this.clearToolbarForm(form);this.clearToolbarButton('img');
 }catch(error){const node=document.createElement('p');node.className='house-image-error';node.setAttribute('role','alert');node.textContent=error.message;form.append(node);}
}
