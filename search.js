(function (root) {
  'use strict';
  function tokenize(query) {
    return [...new Set(String(query || '').normalize('NFKC').toLowerCase()
      .split(/[\s,.;·/]+/u).filter(t => /[\p{L}\p{N}]/u.test(t)))];
  }
  function matchesSynonym(token, key) {
    // Short Latin acronyms match a whole token, not the "ar" inside "art".
    return token === key || (!/^[a-z]+$/i.test(key) && token.includes(key));
  }
  const api = { tokenize, matchesSynonym };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MotifSearch = api;
})(typeof window !== 'undefined' ? window : {});
