// Static DOM copy only; live app messages use the same catalog via t().
import {localeFromSearch, t} from './i18n.mjs';

export function languageHref(search, lang, pathname = '/', hash = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  params.delete('lang');
  if (lang === 'ru') params.append('lang', 'ru');
  const query = params.toString();
  return pathname + (query ? `?${query}` : '') + hash;
}

export function localizeStatic(doc = document, search = location.search, pathname = location.pathname, hash = location.hash) {
  const lang = localeFromSearch(search);
  doc.documentElement.lang = lang;
  doc.title = t('page.title', lang);
  for (const element of doc.querySelectorAll('[data-i18n], [data-i18n-aria-label], [data-i18n-title]')) {
    for (const [attribute, destination] of [['data-i18n', 'textContent'], ['data-i18n-aria-label', 'aria-label'], ['data-i18n-title', 'title']]) {
      const key = element.getAttribute(attribute);
      if (!key) continue;
      if (destination === 'textContent') element.textContent = t(key, lang);
      else element.setAttribute(destination, t(key, lang));
    }
  }
  for (const target of ['en', 'ru']) {
    const link = doc.getElementById(`lang-${target}`);
    if (!link) continue;
    link.setAttribute('href', languageHref(search, target, pathname, hash));
    if (target === lang) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  return lang;
}
