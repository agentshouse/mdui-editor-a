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


import { Icon } from './icons.js';
import { i18n } from '../i18n.js';
export function getButtonHTML({
  button,
  key,
  buttonClass,
  buttonDisabled,
  buttonPressed,
  buttonRel,
  buttonResource,
  buttonType,
  iconSize
  }) {

  if (!button) {
    throw new Error('`button` identifier is required.');
  }

  key = key || `button.${button}`;

  // const titleContent = buttonTitle || buttonIcons[button]?.title || button;
  const titleContent = i18n.t(`${key}.title`) === `${key}.title` ? button : i18n.t(`${key}.title`);
  const title = ` title="${titleContent}"`;
  // const textContent = buttonTextContent || buttonIcons[button]?.textContent;
  let textContent = i18n.t(`${key}.textContent`) === `${key}.textContent` ? null : i18n.t(`${key}.textContent`);
  //Override textContent, useful for non-translations
  textContent = buttonIcons[button].textContent ? buttonIcons[button].textContent : textContent;
  // const label = buttonLabel || titleContent;
  const label = i18n.t(`${key}.aria-label`) === `${key}.aria-label` ? null : i18n.t(`${key}.aria-label`);
  const ariaLabel = (label && !textContent) ? ` aria-label="${label}"` : '';

  const className = buttonClass ? ` class="${buttonClass}"` : '';
  const disabled = buttonDisabled ? ` disabled=""` : '';
  const pressed = (buttonPressed !== undefined) ? ` aria-pressed="${buttonPressed}"` : '';
  let icon = buttonIcons[button]?.icon;
  let buttonDir = buttonIcons[button]?.dir;
  const rel = buttonRel ? ` rel="${buttonRel}"` : '';
  const resource = buttonResource ? ` resource="${buttonResource}"` : '';
  const type = buttonType ? ` type="${buttonType}"` : '';
  const dataI18n = key ? ` data-i18n="${key}"` : '';

  if (icon) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(icon, 'image/svg+xml');
    let svgElement = doc.querySelector('svg');
    svgElement.setAttribute('aria-hidden', 'true');
    if (iconSize) {
      svgElement.classList.add(iconSize);
    }
    icon = new XMLSerializer().serializeToString(svgElement);
  }

  const buttonContent = (!icon && !textContent) ? button : `${icon ? icon : ''}${textContent ? ` <span>${textContent}</span>` : ''}`;

  buttonDir = buttonDir ? ` dir="${buttonDir}"` : '';

  return `<button${ariaLabel}${dataI18n}${className}${disabled}${pressed}${rel}${resource}${title}${type}${buttonDir}>${buttonContent}</button>`;
}


export const buttonIcons = {
  p: {
    icon: Icon['.fas.fa-paragraph']
  },
  em: {
    icon: Icon['.fas.fa-italic']
  },
  strong: {
    icon: Icon['.fas.fa-bold']
  },
  'align-left': {
    icon: Icon['.fas.fa-align-left']
  },
  'align-center': {
    icon: Icon['.fas.fa-align-center']
  },
  'align-right': {
    icon: Icon['.fas.fa-align-right']
  },
  ol: {
    icon: Icon['.fas.fa-link-ol']
  },
  ul: {
    icon: Icon['.fas.fa-link-ul']
  },
  ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].reduce((acc, heading) => {
    acc[heading] = {
      title: `heading level ${heading[1]}`,
      icon: `${Icon['.fas.fa-header']}`,
      textContent: heading[1],
      dir: "ltr"
    };
    return acc;
  }, {}),
  a: {
    icon: Icon['.fas.fa-link']
  },
  citation: {
    icon: Icon['.fas.fa-hashtag']
  },
  //TODO: Change annotate or note's icon
  comment: {
    icon: Icon['.fas.fa-comment']
  },
  note: {
    icon: Icon['.fas.fa-sticky-note']
  },
  requirement: {
    icon: Icon['.fas.fa-microchip']
  },
  semantics: {
    icon: Icon['.fas.fa-rocket']
  },
  sparkline: {
    icon: Icon['.fas.fa-chart-line']
  },
  img: {
    icon: Icon['.fas.fa-image']
  },
  pre: {
    icon: Icon['.fas.fa-terminal']
  },
  code: {
    icon: Icon['.fas.fa-code']
  },
  blockquote: {
    icon: Icon['.fas.fa-angle-right']
  },
  q: {
    icon: Icon['.fas.fa-quote-right']
  },
  math: {
    icon: Icon['.fas.fa-calculator']
  },

  highlight: {
    icon: Icon['.fas.fa-anchor']
  },
  bookmark: {
    icon: Icon['.fas.fa-bookmark']
  },
  share: {
    icon: Icon['.fas.fa-bullhorn']
  },
  permissions: {
    icon: Icon['.fas.fa-user-lock']
  },
  approve: {
    icon: Icon['.fas.fa-thumbs-up']
  },
  disapprove: {
    icon: Icon['.fas.fa-thumbs-down']
  },
  specificity: {
    icon: Icon['.fas.fa-crosshairs']
  },
  close: {
    icon: Icon['.fas.fa-times']
  },
  submit: {
    icon: Icon['.fas.fa-check']
  },
  cancel: {
    icon: Icon['.fas.fa-times']
  },
  delete: {
    icon: Icon['.fas.fa-trash-alt']
  },
  toggle: {
    icon: Icon['.fas.fa-angle-right']
  },
  more: {
    icon: Icon['.fas.fa-rotate']
  },
  cursor: {
    icon: Icon['.fas.fa-i-cursor']
  }, 
  signout: {
    icon: Icon['.far.fa-spock-hand']
  },
  signin: {
    icon: Icon['.fas.fa-user-astronaut']
  },
  license: {
    icon: Icon['.fas.fa-certificate']
  },
  lang: {
    icon: Icon['.fas.fa-language']
  },
  language: {
    icon: Icon['.fas.fa-language']
  },
  'resource-type': {
    icon: Icon['.fas.fa-shape']
  },
  inbox: {
    icon: Icon['.fas.fa-inbox']
  },
  'in-reply-to': {
    icon: Icon['.fas.fa-reply']
  },
  'publication-status': {
    icon: Icon['.fas.fa-timeline']
  },
  activities: {
    icon: Icon['.fas.fa-bolt']
  },
  new: {
    icon: Icon['.far.fa-lightbulb']
  },
  'new-slideshow': {
    icon: Icon['.fas.fa-slideshow']
  },
  open: {
    icon: Icon['.fas.fa-coffee']
  },
  save: {
    icon: Icon['.fas.fa-life-ring']
  },
  'save-as': {
    icon: Icon['.far.fa-paper-plane']
  },
  messages: {
    icon: Icon['.fas.fa-scroll']
  },
  print: {
    icon: Icon[".fas.fa-print"] 
  },
  'data-meta': {
    icon: Icon [".fas.fa-table"]
  },
  table: {
    icon: Icon [".fas.fa-table"]
  },
  toc: {
    icon: Icon [".fas.fa-list-check"]
  },
  question: {
    icon: Icon[".fas.fa-list-check"]
  },
  'questionnaire-inbox': {
    icon: Icon[".far.fa-paper-plane"]
  },
  source: {
    icon: Icon[".fas.fa-code"]
  },
  markdown: {
    icon: Icon[".fab.fa-markdown"]
  },
  memento: {
    icon: Icon[".far.fa-clock"] 
  },
  version: {
    icon: Icon[".fas.fa-code-branch"]
  },
  immutable: {
    icon: Icon[".far.fa-snowflake"] 
  },
  'robustify-links': {
    icon: Icon[".fas.fa-link"]
  },
  archive: {
    icon: Icon[".fas.fa-archive"]
  },
  feed: {
    icon: Icon[".fas.fa-rss"] 
  },
  export: {
    icon: Icon[".fas.fa-external-link-alt"]
  },
  download: {
    icon: Icon[".fas.fa-download"]
  },
  upload: {
    icon: Icon[".fas.fa-upload"]
  },
  cursor: {
    icon: Icon[".fas.fa-i-cursor"]
  },
  'local-storage': {
    icon: Icon[".fas.fa-database"]
  },
  info: {
    icon: Icon[".fas.fa-circle-info"]
  },
  success: {
    icon: Icon[".fas.fa-check"]
  },
  error: {
    icon: Icon[".fas.fa-triangle-exclamation"]
  },
  warning: {
    icon: Icon[".fas.fa-circle-exclamation"]
  },
  'test-suite': {
    icon: Icon[".fas.fa-vial-circle-check"]
  },
  clipboard: {
    icon: Icon[".fas.fa-copy"]
  },
  bars: {
    icon: Icon[".fas.fa-bars"]
  },
  minus: {
    icon: Icon[".fas.fa-minus"]
  },
  'review-changes': {
    icon: Icon[".fas.fa-microscope"]
  },
  'document-info': {
    icon: Icon[".fas.fa-atom"]
  },
  'edit-history': {
    icon: Icon[".far.fa-clock-left"]
  },
  lock: {
    icon: Icon[".fas.fa-lock"]
  },
  'lock-open': {
    icon: Icon[".fas.fa-lock-open"]
  }
}

// Provider/auth menu state was removed; House owns access and storage.
export function updateButtons() {}
