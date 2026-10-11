const IDENTIFIER_SEARCHERS={};
function normalizeIdentifier(_service,value){return String(value??'').trim();}
import {unavailable} from './house/editor-boundary.js';
export function listLookupServices(){return [];}
export function getLookupService(){return undefined;}
export const lookupIdentifier=unavailable;
export function getIdentifierSearch(lookup) {
  const service = getLookupService(lookup?.service);
  const name = lookup?.search || service?.search;
  return name ? IDENTIFIER_SEARCHERS[name] || null : null;
}

// True when the value is a search term, so the suggestion list decides rather than the top hit.
export function needsIdentifierPick(lookup, value) {
  if (!getIdentifierSearch(lookup)) return false;

  const service = getLookupService(lookup?.service);
  if (!service?.identifierPattern) return false;

  return !service.identifierPattern.test(String(value ?? '').trim());
}

// Columns able to drive lookups: those mapped to the service's identifier property, else all.
export function identifierColumnCandidates(lookup, columns) {
  const service = getLookupService(lookup?.service);
  const template = service?.columns?.find((column) => column.identifier);
  if (!template?.propertyUrl) return columns;

  const matching = columns.filter((column) => column.propertyUrl === template.propertyUrl);
  return matching.length ? matching : columns;
}

// Whether the value can be an identifier at all; asking otherwise is a wasted request.
export function looksLikeIdentifier(lookup, value) {
  const service = getLookupService(lookup?.service);
  if (!service?.identifierPattern) return true;

  const id = normalizeIdentifier(service, value);
  if (!service.identifierPattern.test(id)) return false;

  // A shape can carry a check digit; a service that can verify it, does.
  return service.identifierValid ? service.identifierValid(id) : true;
}

// ISBN-10 (X-check allowed) and ISBN-13 check digits, per ISO 2108.