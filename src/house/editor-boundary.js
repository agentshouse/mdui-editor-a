/** Deliberately closed boundary for donor-only remote features. No transport, identity, or fallback data. */
export function unavailable() { throw new Error('This remote dokieli feature is not available in the House document editor.'); }
export const searchSourceStreams = unavailable, isUnlocked = unavailable, hasKeystore = unavailable, isPublicRead = unavailable, getLinkRelation = unavailable;
export const getAnnotationInboxLocationHTML = unavailable, getAnnotationLocationHTML = unavailable, getDocument = unavailable, getReferenceLabel = unavailable;
export {createRDFaHTMLRequirement,getCitationOptionsHTML,getRequirementLevelOptionsHTML,getRequirementSubjectOptionsHTML,getLanguageOptionsHTML,getLicenseOptionsHTML} from './local-metadata.js';


export const showUserIdentityInput = unavailable, showEncryptionSetup = unavailable, showEncryptionUnlock = unavailable;

export function toggleMarkdownMode(event) { window.dispatchEvent(new CustomEvent('house:markdown-mode',{detail:{markdown:!!event.target.closest('.mode-markdown')}})); }
