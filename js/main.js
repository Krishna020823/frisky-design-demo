// Firsky Designs — shared interactivity

document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  document.querySelectorAll('#year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.mobile-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      panel.classList.toggle('open');
    });
    panel.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        toggle.classList.remove('open');
        panel.classList.remove('open');
      });
    });
  }

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  // Portfolio filters
  const filterBtns = document.querySelectorAll('.filter-btn');
  const workItems = document.querySelectorAll('.work-item');
  if (filterBtns.length && workItems.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.filter;
        workItems.forEach(item => {
          const match = cat === 'all' || item.dataset.category === cat;
          item.classList.toggle('hidden', !match);
        });
      });
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // Budget pills (contact form)
  document.querySelectorAll('.budget-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.budget-pill').forEach(p => p.classList.remove('checked'));
      pill.classList.add('checked');
      const input = pill.querySelector('input');
      if (input) input.checked = true;
    });
  });

  // Contact form submit (static demo — no backend)
  const form = document.getElementById('contact-form');
  const success = document.querySelector('.form-success');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (success) success.classList.add('show');
      form.reset();
      document.querySelectorAll('.budget-pill').forEach(p => p.classList.remove('checked'));
      if (success) success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
});
