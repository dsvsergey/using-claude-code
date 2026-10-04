// Theme toggle (persisted)
const root = document.documentElement;
const savedTheme = localStorage.getItem('theme');
if (savedTheme) root.dataset.theme = savedTheme;
else if (matchMedia('(prefers-color-scheme: dark)').matches) root.dataset.theme = 'dark';

document.getElementById('theme').addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', root.dataset.theme);
});

// UI strings per language
const i18n = {
  uk: { copy: 'Копіювати', copied: 'Скопійовано ✓' },
  ru: { copy: 'Копировать', copied: 'Скопировано ✓' },
};
const t = i18n[root.lang] || i18n.uk;

// Language switcher: remember choice and keep current section
document.querySelectorAll('.lang a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    localStorage.setItem('lang', a.dataset.lang);
    location.href = a.getAttribute('href') + location.hash;
  });
});

// Copy buttons on code blocks
document.querySelectorAll('pre').forEach(pre => {
  const btn = document.createElement('button');
  btn.className = 'copy';
  btn.textContent = t.copy;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(pre.querySelector('code').innerText);
    btn.textContent = t.copied;
    setTimeout(() => (btn.textContent = t.copy), 1500);
  });
  pre.appendChild(btn);
});

// Active section highlight in sidebar
const links = [...document.querySelectorAll('#toc a')];
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  });
}, { rootMargin: '-30% 0px -60% 0px' });
document.querySelectorAll('section.card').forEach(s => observer.observe(s));

// Search: filter sections by text
const search = document.getElementById('search');
const sections = [...document.querySelectorAll('section.card')];
search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  sections.forEach(s => {
    const match = !q || s.textContent.toLowerCase().includes(q);
    s.classList.toggle('hidden', !match);
    if (match && q) s.querySelectorAll('details').forEach(d => {
      if (d.textContent.toLowerCase().includes(q)) d.open = true;
    });
  });
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
  if (e.key === 'Escape' && document.activeElement === search) { search.value = ''; search.dispatchEvent(new Event('input')); search.blur(); }
});

// Onboarding checklist (persisted)
const boxes = document.querySelectorAll('#checklist input');
const state = JSON.parse(localStorage.getItem('checklist') || '[]');
boxes.forEach((b, i) => {
  b.checked = !!state[i];
  b.addEventListener('change', () => {
    localStorage.setItem('checklist', JSON.stringify([...boxes].map(x => x.checked)));
  });
});
