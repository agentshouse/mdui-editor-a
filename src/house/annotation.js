/** Import only the donor library's transport-free DOM helpers. Avoid its JSON-LD document loaders. */
export { cloneSelection, restoreSelection, getSelectedParentElement } from '../../node_modules/@dokieli/web-annotation/dist/selection.js';
export { selectionToTextQuote, setSelectionFromTextQuote } from '../../node_modules/@dokieli/web-annotation/dist/text-quote.js';
export { applyMarksFromTextQuote, applyMarkFromSelector } from '../../node_modules/@dokieli/web-annotation/dist/dom-mark.js';
