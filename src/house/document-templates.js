/** House adapter for dokieli's Apache-2.0 document templates and ProseMirror widgets.
 * Donor HTML/section builders are retained; identity, lookup, publication and remote form delivery are omitted.
 */
import { i18n } from '../i18n.js';
import { sanitizeArticle } from '../utils/sanitization.js';
import { setTemplateNewCV, initCV } from '../ui/templates/cv.js';
import { setTemplateNewSpecification, initSpecification } from '../ui/templates/specification.js';
import { setTemplateNewSlideshow, newSlideFragment } from '../ui/templates/slideshow.js';
import { setTemplateNewQuestionnaire, initQuestionnaire, deactivateQuestionnaire, getQuestionnaires } from '../ui/templates/questionnaire.js';
import { applyDocumentTransforms, applyEditorParseTransforms } from '../ui/templates/documentTransforms.js';
import { normalizeDocumentTypeMarkup } from '../ui/templates/normalization.js';
import { documentTypeToolsPlugin } from '../editor/plugins/documentTypeTools.js';
import { documentStructurePlugin } from '../editor/plugins/documentStructure.js';
import { cvNavDecorationPlugin } from '../editor/plugins/cvNavDecorations.js';
import { specificationNavDecorationPlugin, specificationConceptSyncPlugin } from '../editor/plugins/specificationNavDecorations.js';
import { slideshowDecorationsPlugin, setActiveSlideIndex, getActiveSlideIndex } from '../editor/plugins/slideshowDecorations.js';
import { questionnaireToolsPlugin } from '../editor/plugins/questionnaireTools.js';
import { protectPlaceholdersPlugin } from '../editor/plugins/protectPlaceholders.js';

export const DOCUMENT_TEMPLATES = Object.freeze([
  { id: 'article', label: 'Article' },
  { id: 'specification', label: 'Specification' },
  { id: 'cv', label: 'Curriculum Vitae' },
  { id: 'slideshow', label: 'Slideshow' },
  { id: 'questionnaire', label: 'Questionnaire' },
]);

const templates = {
  // From the donor Editor.setTemplateNew, without replacing document.body.
  article: () => `<h1 aria-label="${i18n.t('editor.new.h1.aria-label')}" property="schema:name"></h1><div datatype="rdf:HTML" property="schema:description"><p></p></div>`,
  specification: setTemplateNewSpecification,
  cv: setTemplateNewCV,
  slideshow: setTemplateNewSlideshow,
  questionnaire: setTemplateNewQuestionnaire,
};

export function createDocumentTemplate(type = 'article', { title = '' } = {}) {
  if (!Object.hasOwn(templates, type)) throw new RangeError(`Unknown document template: ${type}`);
  const root = document.createElement('div');
  root.innerHTML = templates[type]();
  const heading = root.querySelector('h1');
  if (heading && title) { heading.textContent = title; heading.removeAttribute('aria-label'); }
  return sanitizeArticle(root.innerHTML);
}

export function documentTemplatePlugins() {
  return [documentTypeToolsPlugin, documentStructurePlugin, cvNavDecorationPlugin,
    specificationNavDecorationPlugin, specificationConceptSyncPlugin,
    slideshowDecorationsPlugin, questionnaireToolsPlugin, protectPlaceholdersPlugin];
}

// Call before parsing the existing article into ProseMirror.
export function prepareDocumentTemplateForEdit(root) {
  getQuestionnaires(root).forEach(deactivateQuestionnaire);
  applyEditorParseTransforms(root);
  // Inverse transforms consume imported values; sanitize the result before PM mounts it.
  root.innerHTML = sanitizeArticle(root.innerHTML);
}

// Run on a detached serialized copy, so save/export never rewrites the live editor.
export function serializeDocumentTemplate(html) {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = `<main><article>${sanitizeArticle(html)}</article></main>`;
  const article = doc.querySelector('article');
  // Native donor SelectView persists the choice as data-value. Materialize the
  // selected option before donor document-type/country serialization reads it.
  article.querySelectorAll('select[data-value]').forEach(select => {
    const value = select.getAttribute('data-value');
    select.querySelectorAll('option').forEach(option => {
      option.toggleAttribute('selected', option.getAttribute('value') === value);
    });
  });
  normalizeDocumentTypeMarkup(article);
  article.querySelectorAll('.do, [data-placeholder]').forEach(node => {
    if (node.classList.contains('do')) node.remove();
    else node.removeAttribute('data-placeholder');
  });
  applyDocumentTransforms(doc);
  return sanitizeArticle(article.innerHTML);
}

// The donor author toolbar already implements these ProseMirror transactions.
// Forwarding preserves its original algorithms and blocks changes during House locks.
export function installDocumentTemplateMethods(editor) {
  for (const name of ['insertFragmentAtStartOf', 'insertFragmentBeforeNode',
    'insertFragmentBeforeNodeById', 'insertFragmentAtEndOfDoc', 'insertFragmentAtEndOf',
    'insertFragmentAtEndOfChild', 'deleteNodeById', 'insertSlideAtEnd', 'insertSlideAfter',
    'deleteSlideById', 'moveSlide']) {
    editor[name] = (...args) => !editor.locked && editor.authorToolbarView?.[name](...args);
  }
}

// Call after editor creation or returning to reading mode. These donor initializers
// are idempotent; all questionnaires prevent native submission and stay local.
export function refreshDocumentTemplateView() {
  initCV();
  initSpecification();
  initQuestionnaire();
}

export function addDocumentSlide(editor, layout = 'normal') {
  if (!['normal', 'shout', 'cover'].includes(layout)) throw new RangeError('Unknown slide layout');
  if (editor.locked || !editor.editorView) return false;
  editor.insertSlideAtEnd(newSlideFragment(layout));
  return true;
}

export function selectDocumentSlide(editor, direction) {
  const view = editor.editorView;
  if (!view) return false;
  const slides = [];
  view.state.doc.descendants(node => {
    if (node.type.name === 'section' && /\bslide\b/.test(node.attrs.originalAttributes?.class || '')) slides.push(node);
  });
  if (!slides.length) return false;
  const next = Math.max(0, Math.min(slides.length - 1, getActiveSlideIndex(view) + direction));
  setActiveSlideIndex(view, next);
  return next;
}
