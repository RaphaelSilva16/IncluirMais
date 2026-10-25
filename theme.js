const themeToggle = document.getElementById('theme-toggle');
const heroIllustration = document.querySelector('.hero-visual img[data-dark-src]');

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-theme', isDark);
  if (heroIllustration) {
    heroIllustration.src = isDark ? heroIllustration.dataset.darkSrc : heroIllustration.dataset.lightSrc;
  }
  if (themeToggle) {
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Alternar tema');
  }
  localStorage.setItem('theme', theme);
}

const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

themeToggle?.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-theme');
  applyTheme(isDark ? 'light' : 'dark');
});
