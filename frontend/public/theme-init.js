// Applies the saved theme before first paint to avoid a light/dark flash.
// Kept as a static file (not inline) so the Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('springerp-theme')
  var dark = t === 'dark' || ((!t || t === 'system') && matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
} catch (e) {
  /* storage unavailable: fall back to the light theme */
}
