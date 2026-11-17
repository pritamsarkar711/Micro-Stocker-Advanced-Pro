/**
 * First-paint theme. Runs before the bundle so the correct surface colour is
 * painted without a flash. Kept as a classic script (not a module) so it can
 * load from file:// in the packaged desktop app and in the browser build.
 */
(function () {
  try {
    var raw =
      localStorage.getItem('msap:data:msap:settings') ||
      localStorage.getItem('msap:data:settings');
    var parsed = raw ? JSON.parse(raw) : {};
    var theme = parsed && parsed.theme ? parsed.theme : null;
    var isDark =
      theme === 'dark'
        ? true
        : theme === 'light'
          ? false
          : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {
    /* keep the default surface */
  }
})();
