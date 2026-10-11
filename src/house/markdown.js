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

import { micromark as marked } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import { gfmTagfilterHtml } from 'micromark-extension-gfm-tagfilter';
import TurndownService from 'turndown';
import { gfm as turndownGfm } from 'turndown-plugin-gfm';
import Config from '../config.js';
function createHTML(title,main){return '<main>'+main+'</main>';}
export function parseMarkdown(data, options) {
  options = options || {};
  // console.log(data)
  var extensions = {
    extensions: [gfm()],
    allowDangerousHtml: true,
    htmlExtensions: [gfmHtml(), gfmTagfilterHtml()]
  };
  var html = marked(data, extensions);
  // console.log(parsed)
  if (options.createDocument) {
    html = createHTML('', '<article>' + html + '</article>');
  }
  // console.log(html);
  return html;
}

function hasSemanticAttrs(node) {
  return Config.DOMProcessing.rdfaAttributes
          .filter(attr => !["href", "src"]
          .includes(attr))
          .some(a => node.hasAttribute?.(a));
}

export function htmlToMarkdown(node) {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '*',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    hr: '---',
    linkStyle: 'inlined'
  });

  // Strip ProseMirror's <p> inside <li> so Turndown produces tight lists
  td.addRule('paragraphInListItem', {
    filter(node) {
      return node.nodeName.toLowerCase() === 'p' && node.parentNode?.nodeName?.toLowerCase() === 'li';
    },
    replacement(content) {
      return content;
    },
  });

  td.keep(['svg', 'math', 'ruby']);

  const alwaysPreserved = [
    'abbr', 'bdi', 'cite', 'data', 'del', 'details', 'dfn', 'ins', 'kbd', 'mark',
    'meta', 'q', 'samp', 'span', 'sub', 'summary', 'sup', 'time', 'u', 'var',
    'dl', 'dt', 'dd',
  ];
  const semanticOnly = ['a', 'ul', 'ol'];
  const blockTags = ['ul', 'ol', 'dl', 'dt', 'dd', 'details', 'summary'];

  td.addRule('preservedElements', {
    filter(el) {
      const tag = el.nodeName.toLowerCase();
      if (alwaysPreserved.includes(tag)) return true;
      if (semanticOnly.includes(tag)) {
        return hasSemanticAttrs(el);
      }
      return false;
    },
    replacement(content, node) {
      if (hasSemanticAttrs(node)) return node.outerHTML;
      const tag = node.nodeName.toLowerCase();
      const attrs = Array.from(node.attributes).map(a => ` ${a.name}="${a.value}"`).join('');
      const s = blockTags.includes(tag) ? '\n' : '';
      return `<${tag}${attrs}>${s}${content}${s}</${tag}>`;
    },
  });

  td.use([turndownGfm]);

  const html = node.innerHTML;

  return td.turndown(html);
}

