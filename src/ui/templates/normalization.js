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

export function normalizeDocumentTypeMarkup(node) {
  node.querySelectorAll('#document-type select[data-select="document-type"]').forEach(select => {
    const doc = select.ownerDocument;
    const dd = select.closest('dd');
    const chosen = [...select.querySelectorAll('option')]
      .find(option => option.hasAttribute('selected') && option.getAttribute('value'));

    if (!chosen) { (dd || select).remove(); return; }

    const a = doc.createElement('a');
    a.setAttribute('href', chosen.getAttribute('value'));
    a.setAttribute('rel', 'rdf:type');
    a.textContent = chosen.textContent.trim();
    if (dd) dd.replaceChildren(a);
    else select.replaceWith(a);
  });

  //Drops duplicate types, keeping the first of each.
  node.querySelectorAll('#document-type').forEach(dl => {
    const seen = new Set();
    dl.querySelectorAll('dd').forEach(dd => {
      const href = dd.querySelector('a[rel~="rdf:type"]')?.getAttribute('href');
      if (href && seen.has(href)) dd.remove();
      else if (href) seen.add(href);
    });
  });
}

