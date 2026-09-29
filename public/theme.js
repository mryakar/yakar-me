(function () {
  var t = null;
  try {
    t = localStorage.getItem('theme');
  } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = t;
})();
