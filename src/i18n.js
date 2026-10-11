import translations from '../locales/en-GB/translations.json';
export const i18n = { t(key, values = {}) { const value = translations[key]; return String(value ?? key).replace(/{{(\w+)}}/g, (_,k)=>values[k] ?? ''); }, code() { return 'en-GB'; } };
