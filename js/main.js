// Frisky Designs — shared interactivity

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

  // Animated stat counters
  const statNums = document.querySelectorAll('.hero-stats .num');
  if (statNums.length) {
    const animateCount = (el) => {
      const text = el.textContent.trim();
      const match = text.match(/^([\d.]+)(.*)$/);
      if (!match) return;
      const endStr = match[1];
      const suffix = match[2];
      const decimals = endStr.includes('.') ? endStr.split('.')[1].length : 0;
      const end = parseFloat(endStr);
      const duration = 2600;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = end * eased;
        el.textContent = (decimals ? current.toFixed(decimals) : Math.round(current)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
      const statsIo = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll('.num').forEach(animateCount);
            statsIo.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      document.querySelectorAll('.hero-stats').forEach(el => statsIo.observe(el));
    }
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

  // Budget pills (grouped by radio name, so multiple pill groups on one page don't clash)
  document.querySelectorAll('.budget-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const input = pill.querySelector('input');
      if (!input) return;
      document.querySelectorAll(`.budget-pill input[name="${input.name}"]`).forEach(i => {
        i.closest('.budget-pill').classList.remove('checked');
      });
      pill.classList.add('checked');
      input.checked = true;
    });
  });

  // Multi-step project enquiry form (contact page)
  const projectForm = document.getElementById('project-form-el');
  if (projectForm) {
    const steps = Array.from(projectForm.querySelectorAll('.form-step'));
    const backBtn = projectForm.querySelector('.form-back');
    const nextBtn = projectForm.querySelector('.form-next');
    const submitBtn = projectForm.querySelector('.form-submit');
    const stepCurrentEl = document.getElementById('step-current');
    const successDetail = document.querySelector('.form-success-detail');
    let current = 0;

    const buildOptions = projectForm.querySelectorAll('input[name="buildType"]');
    const branchGroups = projectForm.querySelectorAll('.branch-fields');

    const updateBranches = () => {
      const selected = projectForm.querySelector('input[name="buildType"]:checked');
      const value = selected ? selected.value : null;
      branchGroups.forEach(group => {
        const branches = group.dataset.branch.split(',');
        group.style.display = value && branches.includes(value) ? 'block' : 'none';
      });
    };
    buildOptions.forEach(opt => opt.addEventListener('change', updateBranches));
    updateBranches();

    const showStep = (index) => {
      steps.forEach((step, i) => step.classList.toggle('active', i === index));
      if (stepCurrentEl) stepCurrentEl.textContent = index + 1;
      backBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
      const isLast = index === steps.length - 1;
      nextBtn.style.display = isLast ? 'none' : 'inline-flex';
      submitBtn.style.display = isLast ? 'inline-flex' : 'none';
    };

    const stepIsValid = (index) => {
      const step = steps[index];
      const required = Array.from(step.querySelectorAll('[required]'));
      return required.every(field => {
        if (field.type === 'radio') {
          return step.querySelector(`input[name="${field.name}"]:checked`);
        }
        return field.value.trim() !== '';
      });
    };

    nextBtn.addEventListener('click', () => {
      if (!stepIsValid(current)) {
        const invalidField = Array.from(steps[current].querySelectorAll('[required]'))
          .find(field => field.type === 'radio'
            ? !steps[current].querySelector(`input[name="${field.name}"]:checked`)
            : field.value.trim() === '');
        if (invalidField && invalidField.reportValidity) invalidField.reportValidity();
        return;
      }
      if (current < steps.length - 1) {
        current += 1;
        showStep(current);
      }
    });

    backBtn.addEventListener('click', () => {
      if (current > 0) {
        current -= 1;
        showStep(current);
      }
    });

    projectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!stepIsValid(current)) return;
      projectForm.style.display = 'none';
      if (successDetail) {
        successDetail.classList.add('show');
        successDetail.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    showStep(current);
  }
});
