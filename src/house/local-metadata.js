/* eslint-disable no-unused-vars, no-redeclare */
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


import Config from '../config.js';
import {i18n} from '../i18n.js';
import {htmlEncode} from '../utils/sanitization.js';
import {generateAttributeId} from '../util.js';
import {getFragmentOrLastPath} from '../uri.js';
const ns=Config.ns;

export function getClassesOfProductsConcepts() {
  var concepts = [];

  if (Config.Resource[Config.DocumentURL]?.spec?.classesOfProducts) {
    var classesOfProducts = Config.Resource[Config.DocumentURL]?.spec?.classesOfProducts;

    Object.keys(classesOfProducts).forEach(conceptSchemeIRI => {
      var conceptScheme = classesOfProducts[conceptSchemeIRI].skos.data;
      var hasTopConcepts = conceptScheme[conceptSchemeIRI][ns.skos.hasTopConcept];
      if (hasTopConcepts) {
        concepts = concepts.concat(hasTopConcepts);
      }
    })
  }

  // Live-DOM fallback: documents whose parsed graph predates the currently defined product classes.
  if (!concepts.length) {
    document.querySelectorAll('#classes-of-products dl[rel~="skos:hasTopConcept"] > dt[about]').forEach(dt => {
      try { concepts.push(new URL(dt.getAttribute('about'), Config.DocumentURL).href); } catch { /* skip unresolvable */ }
    });
  }

  return concepts;
}
function getClassOfProductFromDOM(conceptIRI) {
  const dt = Array.from(document.querySelectorAll('#classes-of-products dl[rel~="skos:hasTopConcept"] > dt[about]'))
    .find(d => { try { return new URL(d.getAttribute('about'), Config.DocumentURL).href === conceptIRI; } catch { return false; } });
  if (!dt) return null;
  const dd = dt.nextElementSibling?.tagName === 'DD' ? dt.nextElementSibling : null;
  return { label: dt.textContent.trim(), definition: dd?.textContent.trim() || '' };
}
export function createLicenseHTML(iri, options = {}) {
  options['rel'] = options.rel ? options.rel : 'schema:license';
  options['label'] = options.label ? options.label : 'License';
  return createLicenseRightsHTML(iri, options);
}
export function createLicenseRightsHTML(iri, options = {}) {
  if (!iri) return '';

  var html = '';
  var title = '';
  var name = iri;

  const labelKey = options.label.toLowerCase().replace(/\s+/g, '-');

  html = `<dl class="${labelKey}"><dt data-i18n="${labelKey}.label">${i18n.t(`${labelKey}.label.textContent`)}</dt><dd>`;
  // if ('name' in options) {
  //   name = options.name;
  //   title = ('description' in options) ? ` title="${i18n.t(`${labelKey}.dt.title`)}"` : '';
  // }
  // else
  if (Config.License[iri]) {
    name = Config.License[iri].name;
    title = ` title="${i18n.t(`${labelKey}.${Config.License[iri].code}.option.title`)}"`;
  }

  html += '<a href="' + iri + '" rel="' + options.rel + '"' + title + '>' + name + '</a>';
  html += '</dd></dl>';

  return html;
}
export function createLanguageHTML(language, options = {}) {
  if (!language) return '';

  var property = options.property || 'dcterms:language';
  var content = language;
  var textContent = Config.Languages[language].sourceName || language;
  options['title'] = options.label || 'Language';

  return createDefinitionListHTML([{ property, content, textContent, lang: '', xmlLang: '' }], options);
}
export function createInReplyToHTML(url, options = {}) {
  if (!url) return '';

  options['class'] = options.class || 'in-reply-to';
  options['title'] = 'In reply to';

  return createDefinitionListHTML([{ 'href': url, 'rel': 'as:inReplyTo' }], options);
}
export function createPublicationStatusHTML(url, options = {}) {
  if (!url) return '';

  options['class'] = options.class || 'publication-status';
  console.log(Config.PublicationStatus)
  console.log(Config.PublicationStatus[url], url)

  var textContent = Config.PublicationStatus[url] || url;
  options['title'] = 'Status';

  return createDefinitionListHTML(
    [
      {
        prefix: 'pso: http://purl.org/spar/pso/',
        rel: 'pso:holdsStatusInTime',
        resource: '#' + generateAttributeId(),
        child: {
          rel: 'pso:withStatus', resource: url, typeOf: 'pso:PublicationStatus', textContent
        }
      }
    ],
    options
  );
}
export function createResourceTypeHTML(url, options = {}) {
  if (!url) return '';

  options['class'] = options.class || 'resource-type';
  var textContent = Config.ResourceType[url] || url;
  options['title'] = 'Type';

  return createDefinitionListHTML([{ 'href': url, 'rel': 'rdf:type', textContent }], options);
}
export function createTestSuiteHTML(url, options = {}) {
  if (!url) return '';

  options['class'] = options.class || 'test-suite';
  options['title'] = 'Test Suite';

  return createDefinitionListHTML([{ 'href': url, 'rel': 'spec:testSuite' }], options);
}
export function getPublicationStatusOptionsHTML(options) {
  options = options || {};
  var s = [], selectedIRI = '';

  if ('selected' in options) {
    selectedIRI = options.selected;
    if (selectedIRI == '') {
      s.push(`<option data-i18n="publication-status.choose.option" selected="selected" value="">${i18n.t('publication-status.choose.option.textContent')}</option>`);
    }
  }
  else {
    selectedIRI = ns.pso.draft.value;
  }

  Object.keys(Config.PublicationStatus).forEach(iri => {
    var selected = (iri == selectedIRI) ? ' selected="selected"' : '';
    const key = Config.PublicationStatus[iri].toLowerCase().replace(/\s+/g, '-');
    s.push(`<option data-i18n="publication-status.${key}.option"${selected} title="${i18n.t(`publication-status.${key}.option.title`)}" value="${iri}">${i18n.t(`publication-status.${key}.option.textContent`)}</option>`);
  })

  return s.join('');
}
export function getResourceTypeOptionsHTML(options) {
  options = options || {};
  var s = [], selectedType = '';

  if ('selected' in options) {
    selectedType = options.selected;
    if (selectedType == '') {
      s.push(`<option data-i18n="resource-type.choose.option" selected="selected" value="">${i18n.t('resource-type.choose.option.textContent')}</option>`);
    }
  }
  else {
    selectedType = 'http://schema.org/Article';
  }

  // Sorted by label in the UI language.
  Object.keys(Config.ResourceType)
    .map(iri => {
      const key = Config.ResourceType[iri].toLowerCase().replace(/\s+/g, '-');
      return { iri, key, label: i18n.t(`resource-type.${key}.option.textContent`) };
    })
    .sort((a, b) => a.label.localeCompare(b.label, Config.User?.UI?.Language || undefined))
    .forEach(({ iri, key, label }) => {
      var selected = (iri == selectedType) ? ' selected="selected"' : '';
      s.push(`<option data-i18n="${`resource-type.${key}.option`}"${selected} title="${i18n.t(`resource-type.${key}.option.title`)}" value="${iri}">${label}</option>`);
    });

  return s.join('');
}
export function getLanguageOptionsHTML(options) {
  options = options || {};
  var s = [], selectedLang = '';

  if ('selected' in options) {
    selectedLang = options.selected;
    if (selectedLang == '') {
      s.push(`<option data-i18n="language.choose.option" selected="selected" value="">${i18n.t('language.choose.option.textContent')}</option>`);
    }
  }
  else if (typeof Config.User.UI?.Language !== 'undefined') {
    selectedLang = Config.User.UI.Language;
  }
  else {
    selectedLang = 'en';
  }

  Object.keys(Config.Languages).forEach(lang => {
    let selected = (lang == selectedLang) ? ' selected="selected"' : '';
    s.push(`<option dir="${Config.Languages[lang].dir}" lang="${lang}"${selected} value="${lang}" xml:lang="${lang}">${Config.Languages[lang].sourceName}</option>`);
  });

  return s.join('');
}
export function getLicenseOptionsHTML(options) {
  options = options || {};
  var s = [], selectedIRI = '';

  if ('selected' in options) {
    selectedIRI = options.selected;
    if (selectedIRI == '') {
      s.push(`<option dir="auto" data-i18n="license.choose.option" selected="selected" value="">${i18n.t('license.choose.option.textContent')}</option>`);
    }
  }
  else if (typeof Config.User.UI.License !== 'undefined') {
    selectedIRI = Config.User.UI.License;
  }
  else {
    selectedIRI = 'https://creativecommons.org/licenses/by/4.0/';
  }

  Object.keys(Config.License).forEach(iri => {
    if (iri != 'NoLicense') {
      var selected = (iri == selectedIRI) ? ' selected="selected"' : '';
      s.push(`<option dir="auto" data-i18n="license.${Config.License[iri].code}.option" value="${iri}"${selected} title="${i18n.t('license.' + Config.License[iri].code + '.option.title')}">${Config.License[iri].name}</option>`);
    }
  })

  return s.join('');
}
export function getCitationOptionsHTML(options = {}) {
  options = options || {};
  var s = [], selectedIRI = '';

  if ('selected' in options) {
    selectedIRI = options.selected;
    if (selectedIRI == '') {
      s.push(`<option data-i18n="citation.choose.option" selected="selected" value="">${i18n.t('citation.choose.option.textContent')}</option>`);
    }
  }

  Object.keys(Config.Citation).forEach(iri => {
    const key = Config.Citation[iri].toLowerCase().replace(/\s+/g, '-');
    s.push(`<option data-i18n="${`citation.${key}.option`}" value="${iri}">${i18n.t(`citation.${key}.option.textContent`)}</option>`);
  })

  return s.join('');
}
export function getRequirementLevelOptionsHTML(type) {
  type = type || 'MUST';

  var s = '';
  Object.keys(Config.RequirementLevel).forEach(iri => {
    s += '<option value="' + iri + '">' + Config.RequirementLevel[iri] + '</option>';
  })

  return s;
}
export function getRequirementSubjectOptionsHTML(options) {
  options = options || {};
  var s = '', selectedIRI = '';
// console.trace();
// console.log(options)

  if ('selected' in options) {
    selectedIRI = options.selected;
    if (selectedIRI == '') {
      s += '<option selected="selected" value="">Choose a requirement subject</option>';
    }
  }

  const conceptIRIs = getClassesOfProductsConcepts();
// console.log(concepts)
  if (conceptIRIs.length) {
    conceptIRIs.forEach(conceptIRI => {
      var conceptData = Config.Resource[conceptIRI]?.skos?.data[conceptIRI];
      var conceptLabel, title;

      if (conceptData) {
        conceptLabel = conceptData[ns.skos.prefLabel] || '';
        title = conceptData[ns.skos.definition] || '';
      }
      else {
        var domConcept = getClassOfProductFromDOM(conceptIRI);
        if (!domConcept) return;
        conceptLabel = domConcept.label;
        title = domConcept.definition;
      }

      if (title) {
        title = ` title="${htmlEncode(title)}"`;
      }

      var selected = (conceptIRI == selectedIRI) ? ' selected="selected"' : '';

      s += '<option value="' + htmlEncode(conceptIRI) + '"' + selected + title + '>' + htmlEncode(conceptLabel) + '</option>';
    })
  }

  return s;
}
export function createRDFaHTMLRequirement(r, mode) {
  var s = '', about = '', property = '', rel = '', resource = '', href = '', content = '', langDatatype = '', typeOf = '', idValue = '', id = '', subject = '', level = '', basedOnConsensus;

  var idValue = r.id || generateAttributeId();
  id = ` id="${idValue}"`;

  var aboutValue = ('about' in r && r.about != '') ? r.about : '';
  about= ` about="${aboutValue}"`;

  rel = ' rel="spec:requirement"';
  resource = ' resource="#' + idValue + '"';

  if ('lang' in r && r.lang != '') {
    langDatatype = ' lang="' + r.lang + '" xml:lang="' + r.lang + '"';
  }
  else {
    if ('datatype' in r && r.datatype != '') {
      langDatatype = ' datatype="' + r.datatype + '"';
    }
  }

  if ('typeOf' in r && r.typeOf != '') {
    typeOf = ' typeof="' + r.typeOf + '"';
  }

  //TODO: Perhaps the value passed to this function should include both requirementSubjectURI and requirementSubjectLabel. For now this is URI and label is derived :( Same goes for requirement level.

  //TODO: Handle undefined r.subject, level etc.
  var requirementSubjectURI = r.subject;
  var requirementSubjectLabel = requirementSubjectURI ? getFragmentOrLastPath(requirementSubjectURI) : '';
  var requirementLevelURI = r.level;
  var requirementLevelLabel = requirementLevelURI ? getFragmentOrLastPath(requirementLevelURI): '';
  var prevRequirementLevelLabel = r.prevLevelLabel || requirementLevelLabel;
  var prevRequirementSubjectLabel = r.prevSubjectLabel || requirementSubjectLabel;
  var selectedTextContent = r.selectedTextContent || '';
  var selectedHtmlString = r.selectedHtmlString || selectedTextContent;

  var requirementSubject = `<span rel="spec:requirementSubject" resource="${requirementSubjectURI}">${requirementSubjectLabel}</span>`;
  var requirementLevel = `<span rel="spec:requirementLevel" resource="${requirementLevelURI}">${requirementLevelLabel}</span>`;

  // console.log(selectedTextContent);

  

  const subjectLabel = prevRequirementSubjectLabel;
  const levelLabel = prevRequirementLevelLabel;
  
  const subjIndex = selectedHtmlString.indexOf(subjectLabel);
  const levelIndex = selectedHtmlString.indexOf(levelLabel);
  
  const replacements = [
    { start: subjIndex, end: subjIndex + (subjectLabel||'').length, replacement: requirementSubject },
    { start: levelIndex, end: levelIndex + (levelLabel||'').length, replacement: requirementLevel }
  ]
    .filter(r => r.start !== -1)
    .sort((a,b) => b.start - a.start);
  
  let newHtmlString = selectedHtmlString;
  for (const { start, end, replacement } of replacements) {
    newHtmlString = newHtmlString.slice(0, start) + replacement + newHtmlString.slice(end);
  }
  var statement = `<span property="spec:statement">${newHtmlString}</span>`;

  //TODO: Do other things that match terms from HTTP-RDF.

  //TODO: if selected text is the only content in parent, consider using `p`
  var element = 'span';

  //Input (with or without p):
  //<p>Client <code>SHOULD</code> generate a Content-Type header field in a message that contains content. [<a href="https://example.org/consensus/1" rel="cito:citesAsSourceDocument">Source</a>]</p>

  // position the markup according to previous subject and level labels positions


  //span or p:
  //<p about="" id="server-content-type-includes" rel="spec:requirement" resource="#server-content-type-includes"><span property="spec:statement"><span rel="spec:requirementSubject" resource="#Server">Server</span> <span rel="spec:requirementLevel" resource="spec:MUST">MUST</span> generate a <code>Content-Type</code> header field in a message that contains content.</span></p>

  s = '<' + element + about + id + langDatatype + rel + resource + typeOf + '>' + statement + '</' + element + '>';

  // console.log(s)

  return s;
}
export function createDefinitionListHTML(data, options = {}) {
  // console.log(data, options)
  if (!data || !options) { return; }

  var id = (options.id) ? ` id="${options.id}"` : '';
  var title = options.title || options.id;
  var classAttribute = (options.class) ? ` class="${options.class}"` : ` class="${title.toLowerCase()}"`;

  var dds = [];

  data.forEach(d => {
    var prefix = d.prefix ? ` prefix="${d.prefix}"` : '';
    var lang = d.lang !== undefined ? ` lang="${d.lang}"` : '';
    var xmlLang = d.xmlLang !== undefined ? ` xml:lang="${d.xmlLang}"` : '';
    var resource = d.resource ? ` resource="${d.resource}"` : '';
    var content = d.content ? ` content="${d.content}"` : '';
    var datatype = d.datatype ? ` datatype="${d.datatype}"` : '';
    var typeOf = d.typeOf ? ` typeof="${d.typeOf}"` : '';

    //d.href is required, d.resource is optional.

    ///XXX: This can be further developed
    if (d.child) {
      var childTypeOf = d.child.typeOf ? ` typeof="${d.child.typeOf}"` : '';
      var childResource = d.child.resource ? ` resource="${d.child.resource}"` : '';

      dds.push(`
        <dd>
          <span${content}${datatype}${lang}${prefix} rel="${d.rel}"${resource}${typeOf}${xmlLang}>
            <span rel="${d.child.rel}"${childResource}${childTypeOf}>${d.child.textContent}</span>
          </span>
        </dd>
      `);
    }
    else if (d.rel && d.property) {
      dds.push(`<dd><a href="${d.href}"${content}"${lang} property="${d.property}" rel="${d.rel}${resource}${xmlLang}>${d.textContent || d.href}</a></dd>`);
    }
    else if (d.rel) {
      dds.push(`<dd><a href="${d.href}"${prefix} rel="${d.rel}"${resource}>${d.textContent || d.href}</a></dd>`);
    }
    else if (d.property) {
      dds.push(`<dd><span${content}${datatype}${lang}${prefix} property="${d.property}"${xmlLang}>${d.textContent}</span></dd>`);
    }
  });

  var html = `
    <dl${classAttribute}${id}>
      <dt>${title}</dt>
      ${dds.join('\n')}
    </dl>`;

  // console.log(html);

  return html;
}