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

// Local donor registries and option builders. Remote identity and lookup services are omitted.
import Config from '../../config.js';
import { i18n } from '../../i18n.js';
export const RESOURCE_TYPES = {
    "http://schema.org/Article": 'Article',
    "http://schema.org/BlogPosting": 'Blog Posting',
    "http://w3id.org/roh#CurriculumVitae": 'Curriculum Vitae',
    "http://schema.org/Course": 'Course',
    "http://schema.org/Guide": 'Guide',
    "http://schema.org/NewsArticle": 'News Article',
    "http://schema.org/Question": 'Questionnaire',
    "http://schema.org/Recipe": 'Recipe',
    "http://schema.org/Review": 'Review',
    "http://schema.org/ScholarlyArticle": 'Scholarly Article',
    "http://purl.org/ontology/bibo/Slideshow": 'Slideshow',
    "http://usefulinc.com/ns/doap#Specification": 'Specification',
    "http://schema.org/TechArticle": 'Tech Article',
    "http://schema.org/Thesis": 'Thesis',
    "http://schema.org/Trip":'Trip',
};
const COUNTRIES = {
    "AF":"Afghanistan","AL":"Albania","DZ":"Algeria","AS":"American Samoa","AD":"Andorra","AO":"Angola","AG":"Antigua and Barbuda","AR":"Argentina","AM":"Armenia","AW":"Aruba","AU":"Australia","AT":"Austria","AZ":"Azerbaijan","BS":"Bahamas, The","BH":"Bahrain","BD":"Bangladesh","BB":"Barbados","BY":"Belarus","BE":"Belgium","BZ":"Belize","BJ":"Benin","BM":"Bermuda","BT":"Bhutan","BO":"Bolivia","BA":"Bosnia and Herzegovina","BW":"Botswana","BR":"Brazil","BN":"Brunei Darussalam","BG":"Bulgaria","BF":"Burkina Faso","BI":"Burundi","CV":"Cabo Verde","KH":"Cambodia","CM":"Cameroon","CA":"Canada","KY":"Cayman Islands","CF":"Central African Republic","TD":"Chad","JG":"Channel Islands","CL":"Chile","CN":"China","CO":"Colombia","KM":"Comoros","CD":"Congo, Dem. Rep.","CG":"Congo, Rep.","CR":"Costa Rica","CI":"Cote d'Ivoire","HR":"Croatia","CU":"Cuba","CW":"Curacao","CY":"Cyprus","CZ":"Czech Republic","DK":"Denmark","DJ":"Djibouti","DM":"Dominica","DO":"Dominican Republic","EC":"Ecuador","EG":"Egypt, Arab Rep.","SV":"El Salvador","GQ":"Equatorial Guinea","ER":"Eritrea","EE":"Estonia","ET":"Ethiopia","FO":"Faeroe Islands","FJ":"Fiji","FI":"Finland","FR":"France","PF":"French Polynesia","GA":"Gabon","GM":"Gambia, The","GE":"Georgia","DE":"Germany","GH":"Ghana","GR":"Greece","GL":"Greenland","GD":"Grenada","GU":"Guam","GT":"Guatemala","GN":"Guinea","GW":"Guinea-Bissau","GY":"Guyana","HT":"Haiti","HN":"Honduras","HK":"Hong Kong SAR, China","HU":"Hungary","IS":"Iceland","IN":"India","ID":"Indonesia","IR":"Iran, Islamic Rep.","IQ":"Iraq","IE":"Ireland","IM":"Isle of Man","IL":"Israel","IT":"Italy","JM":"Jamaica","JP":"Japan","JO":"Jordan","KZ":"Kazakhstan","KE":"Kenya","KI":"Kiribati","KP":"Korea, Dem. Rep.","KR":"Korea, Rep.","KV":"Kosovo","KW":"Kuwait","KG":"Kyrgyz Republic","LA":"Lao PDR","LV":"Latvia","LB":"Lebanon","LS":"Lesotho","LR":"Liberia","LY":"Libya","LI":"Liechtenstein","LT":"Lithuania","LU":"Luxembourg","MO":"Macao SAR, China","MK":"Macedonia, FYR","MG":"Madagascar","MW":"Malawi","MY":"Malaysia","MV":"Maldives","ML":"Mali","MT":"Malta","MH":"Marshall Islands","MR":"Mauritania","MU":"Mauritius","MX":"Mexico","FM":"Micronesia, Fed. Sts.","MD":"Moldova","MC":"Monaco","MN":"Mongolia","ME":"Montenegro","MA":"Morocco","MZ":"Mozambique","MM":"Myanmar","NA":"Namibia","NP":"Nepal","NL":"Netherlands","NC":"New Caledonia","NZ":"New Zealand","NI":"Nicaragua","NE":"Niger","NG":"Nigeria","MP":"Northern Mariana Islands","NO":"Norway","OM":"Oman","PK":"Pakistan","PW":"Palau","PA":"Panama","PG":"Papua New Guinea","PY":"Paraguay","PE":"Peru","PH":"Philippines","PL":"Poland","PT":"Portugal","PR":"Puerto Rico","QA":"Qatar","RO":"Romania","RU":"Russian Federation","RW":"Rwanda","WS":"Samoa","SM":"San Marino","ST":"Sao Tome and Principe","SA":"Saudi Arabia","SN":"Senegal","RS":"Serbia","SC":"Seychelles","SL":"Sierra Leone","SG":"Singapore","SX":"Sint Maarten (Dutch part)","SK":"Slovak Republic","SI":"Slovenia","SB":"Solomon Islands","SO":"Somalia","ZA":"South Africa","SS":"South Sudan","ES":"Spain","LK":"Sri Lanka","KN":"St. Kitts and Nevis","LC":"St. Lucia","MF":"St. Martin (French part)","VC":"St. Vincent and the Grenadines","SD":"Sudan","SR":"Suriname","SZ":"Swaziland","SE":"Sweden","CH":"Switzerland","SY":"Syrian Arab Republic","TJ":"Tajikistan","TZ":"Tanzania","TH":"Thailand","TL":"Timor-Leste","TG":"Togo","TO":"Tonga","TT":"Trinidad and Tobago","TN":"Tunisia","TR":"Turkey","TM":"Turkmenistan","TC":"Turks and Caicos Islands","TV":"Tuvalu","UG":"Uganda","UA":"Ukraine","AE":"United Arab Emirates","GB":"United Kingdom","US":"United States","UY":"Uruguay","UZ":"Uzbekistan","VU":"Vanuatu","VE":"Venezuela, RB","VN":"Vietnam","VI":"Virgin Islands (U.S.)","PS":"West Bank and Gaza","YE":"Yemen, Rep.","ZM":"Zambia","ZW":"Zimbabwe"
};
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
  Object.keys(RESOURCE_TYPES)
    .map(iri => {
      const key = RESOURCE_TYPES[iri].toLowerCase().replace(/\s+/g, '-');
      return { iri, key, label: i18n.t(`resource-type.${key}.option.textContent`) };
    })
    .sort((a, b) => a.label.localeCompare(b.label, Config.User?.UI?.Language || undefined))
    .forEach(({ iri, key, label }) => {
      var selected = (iri == selectedType) ? ' selected="selected"' : '';
      s.push(`<option data-i18n="${`resource-type.${key}.option`}"${selected} title="${i18n.t(`resource-type.${key}.option.title`)}" value="${iri}">${label}</option>`);
    });

  return s.join('');
}

export function getCountryOptionsHTML(options) {
  options = options || {};
  
  var s = [], selectedCode = '';

  if ('selected' in options) {
    selectedCode = options.selected;
    if (selectedCode == '') {
      s.push(`<option dir="auto" data-i18n="country.choose.option" selected="selected" value="">${i18n.t('country.choose.option.textContent')}</option>`);
    }
  }

  //Just for fun maybe in the future:
  // else if (typeof Config.User.Address.Country !== 'undefined') {
  //   selectedCode = Config.User.Address.Country;
  // }
  // else {
  //   selectedCode = 'https://creativecommons.org/licenses/by/4.0/';
  // }

  Object.keys(COUNTRIES).forEach(code => {
    var selected = (code == selectedCode) ? ' selected="selected"' : '';
    s.push(`<option dir="auto" data-i18n="${`country.${code}.option`}" value="${code}"${selected}">${i18n.t(`country.${code}.option.textContent`)}</option>`);
  })

  return s.join('');
}

