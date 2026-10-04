// Runs in <head>: redirect to the saved language before the page renders.
(function () {
  var pages = { uk: 'index.html', ru: 'index.ru.html' };
  var current = document.documentElement.lang;
  var saved = localStorage.getItem('lang');
  if (saved && saved !== current && pages[saved]) {
    location.replace(pages[saved] + location.hash);
  }
})();
