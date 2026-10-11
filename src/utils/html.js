import {domSanitize} from './sanitization.js';
/** House-safe HTML helpers used by the retained dokieli toolbar. */
export function fragmentFromString(value) { const t = document.createElement('template'); t.innerHTML = domSanitize(value); return t.content; }
export function selectArticleNode(root = document) { return root.querySelector('main > article') || root.querySelector('article') || root; }
export function getDocumentContentNode(root = document) { return selectArticleNode(root); }
export function getFormValues(form) { return Object.fromEntries(new FormData(form)); }
