// Frisky Designs — shared interactivity

// ---------------------------------------------------------------------------
// tawk.to — loaded for visitor analytics only, with the chat widget suppressed.
// Conversations already go through the WhatsApp button, so this is here purely
// for the visitor/traffic monitoring and the weekly report email.
//
// The property is "Frisky Designs" in the tawk.to dashboard; the embed URL comes
// from Administration → Chat Widget. Blanking it stops tawk loading entirely —
// no script, no cookies — which is the switch to flip if it ever needs pulling.
// ---------------------------------------------------------------------------
const TAWK_EMBED_SRC = 'https://embed.tawk.to/6a7618cfe014d81d4ab6224d/1jvel1qqb';

if (TAWK_EMBED_SRC) {
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();

  // hideWidget() only becomes callable once tawk has finished booting — six
  // bundles, kicked off at window.onload — which is the several-second gap the
  // launcher was visible for. Closing it means hiding the node ourselves the
  // moment it appears. Tawk's outer wrapper carries a freshly generated UUID
  // for an id, so there is nothing stable to match on it; its inner parts do
  // have fixed ids, so we find one of those and hide whatever body-level
  // element it sits in. None of these ids exist in this site's own markup.
  const TAWK_PARTS = '#min-widget, #max-widget, #chat-bubble, #message-preview';

  const hideTawk = (root) => {
    if (!root || root.nodeType !== 1) return;
    const part = root.matches(TAWK_PARTS) ? root : root.querySelector(TAWK_PARTS);
    if (!part) return;
    // Hide the whole wrapper, not just the part, so nothing is left holding
    // the corner of the screen.
    (part.closest('body > *') || root).style.setProperty('display', 'none', 'important');
  };

  const tawkWatcher = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(hideTawk));
  });
  tawkWatcher.observe(document.body, { childList: true, subtree: true });

  // The observer alone still let it flash: tawk appends the wrapper empty and
  // fills it in afterwards, so at insert time there is no part to match on.
  // Sweeping every frame closes that to a frame or two rather than the half
  // second a timer would cost. Frames are cheap here — four id lookups.
  const deadline = Date.now() + 8000;
  const sweepTawk = () => {
    document.querySelectorAll(TAWK_PARTS).forEach(hideTawk);
    if (Date.now() < deadline) requestAnimationFrame(sweepTawk);
  };
  requestAnimationFrame(sweepTawk);

  // Ask tawk itself as well. onBeforeLoad fires ahead of the widget rendering,
  // so if hideWidget is callable by then it never paints in the first place;
  // onLoad is the guaranteed-but-late backstop.
  window.Tawk_API.onBeforeLoad = function () {
    if (typeof window.Tawk_API.hideWidget === 'function') window.Tawk_API.hideWidget();
  };
  window.Tawk_API.onLoad = function () {
    if (typeof window.Tawk_API.hideWidget === 'function') window.Tawk_API.hideWidget();
    tawkWatcher.disconnect();
  };

  // Injected from here rather than inline in 23 HTML files; tawk still records
  // the page view, so visitor counts and the weekly report are unaffected.
  const tawkScript = document.createElement('script');
  tawkScript.async = true;
  tawkScript.src = TAWK_EMBED_SRC;
  tawkScript.charset = 'UTF-8';
  tawkScript.setAttribute('crossorigin', '*');
  document.head.appendChild(tawkScript);
}

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

  // CTA band scroll reveal — the band pins to the viewport and is wiped open
  // from its bottom edge as the runway scrolls past, with the wording fading in
  // just behind the wipe. Held off on phones (the runway costs a lot of scroll
  // on a small screen) and under reduced-motion; the CSS falls back cleanly.
  const ctaBand = document.querySelector('.cta-band');
  const ctaSection = ctaBand && ctaBand.closest('.section-tight');
  if (ctaSection) {
    const wide = window.matchMedia('(min-width: 861px)');
    const stillness = window.matchMedia('(prefers-reduced-motion: reduce)');
    // The wipe completes before the runway ends, so the panel holds fully open
    // for a beat rather than snapping straight on into the footer.
    const WIPE = 0.72;
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    let queued = false;
    let lift = 0;

    // How far the runway is pulled back over the section above it — a viewport,
    // unless there isn't that much page above, in which case take what there is
    // so the panel can't start wiping in over the hero on a short page.
    const measureLift = () => {
      const naturalTop = ctaSection.getBoundingClientRect().top + window.scrollY + lift;
      lift = Math.min(window.innerHeight, Math.max(naturalTop - 80, 0));
      ctaSection.style.setProperty('--cta-lift', lift + 'px');
    };

    const update = () => {
      queued = false;
      const rect = ctaSection.getBoundingClientRect();
      const runway = rect.height - window.innerHeight; // distance it stays pinned
      const p = runway > 0 ? clamp01(-rect.top / (runway * WIPE)) : 1;
      ctaBand.style.setProperty('--cta-p', p.toFixed(4));
      // Trails the wipe, so the words read as fading in rather than riding it up.
      ctaBand.style.setProperty('--cta-fade', clamp01((p - 0.28) / 0.4).toFixed(4));
    };

    const onScroll = () => {
      if (queued || !ctaSection.classList.contains('cta-scroll')) return;
      queued = true;
      requestAnimationFrame(update);
    };

    const sync = () => {
      const on = wide.matches && !stillness.matches;
      ctaSection.classList.toggle('cta-scroll', on);
      if (on) {
        measureLift();
        update();
      } else {
        // Hand the band back to the plain stylesheet rather than leaving it
        // clipped at whatever the last scroll position happened to be.
        lift = 0;
        ctaSection.style.removeProperty('--cta-lift');
        ctaBand.style.removeProperty('--cta-p');
        ctaBand.style.removeProperty('--cta-fade');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', sync);
    // Lazy-loaded imagery above the band settles the page height late, which
    // moves where the runway should start.
    window.addEventListener('load', sync);
    wide.addEventListener('change', sync);
    stillness.addEventListener('change', sync);
    sync();
  }

  // Floating search bar — kept out of the way over the landing view, then faded
  // in once the hero has scrolled off. Threshold is the hero's own height, so
  // it appears at the moment the opening screen is behind you rather than at
  // some fixed pixel count that would be wrong on every other viewport.
  const siteSearch = document.querySelector('.site-search');
  if (siteSearch) {
    const hero = document.querySelector('.hero, .page-hero');
    let trigger = 0;
    let searchQueued = false;

    const measureTrigger = () => {
      trigger = hero ? hero.offsetTop + hero.offsetHeight * 0.75 : window.innerHeight * 0.75;
    };

    const applySearch = () => {
      searchQueued = false;
      siteSearch.classList.toggle('is-visible', window.scrollY > trigger);
    };

    const onSearchScroll = () => {
      if (searchQueued) return;
      searchQueued = true;
      requestAnimationFrame(applySearch);
    };

    // Nothing to submit to yet, so keep Enter from reloading the page with a
    // stray ?q= on the URL. Remove this once the search itself is built.
    siteSearch.addEventListener('submit', (e) => e.preventDefault());

    window.addEventListener('scroll', onSearchScroll, { passive: true });
    window.addEventListener('resize', () => { measureTrigger(); onSearchScroll(); });
    window.addEventListener('load', () => { measureTrigger(); applySearch(); });
    measureTrigger();
    applySearch();
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

  // What We Do — hovering (or focusing) a service row cross-fades the matching
  // icon into the sticky panel beside it. Pointer-driven only: below 860px the
  // panel is hidden by CSS and each row carries its own inline icon instead.
  const showcase = document.querySelector('.service-showcase');
  if (showcase) {
    const rows = showcase.querySelectorAll('.service-row');
    const visuals = showcase.querySelectorAll('.service-visual');
    if (rows.length && visuals.length) {
      const activate = (index) => {
        visuals.forEach((v, i) => v.classList.toggle('is-active', i === index));
      };
      rows.forEach((row, i) => {
        row.addEventListener('mouseenter', () => activate(i));
        row.addEventListener('focus', () => activate(i));
      });
      activate(0);
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

  // Design style preference sliders (live value readout)
  document.querySelectorAll('.style-slider').forEach(slider => {
    const out = slider.nextElementSibling;
    if (!out || !out.classList.contains('scale-value')) return;
    slider.addEventListener('input', () => { out.textContent = slider.value; });
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
        const active = !!value && branches.includes(value);
        group.style.display = active ? 'block' : 'none';
        // Disabled, not merely hidden. display:none does NOT exempt a field
        // from the browser's own constraint validation, and that pass runs
        // before our submit listener — so a required field in a branch the
        // visitor never saw silently blocked the whole form, whichever build
        // type they picked. Disabling also keeps those answers out of the
        // FormData, so the email only carries the questions actually asked.
        group.querySelectorAll('input, textarea, select').forEach(field => {
          field.disabled = !active;
        });
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

    // A required field inside a build-type branch the user didn't pick stays
    // in the DOM (just display:none), so it must be excluded from validation.
    const visibleRequiredFields = (step) => Array.from(step.querySelectorAll('[required]')).filter(field => {
      const branch = field.closest('.branch-fields');
      return !branch || branch.style.display !== 'none';
    });

    const fieldIsInvalid = (field) => {
      if (field.type === 'radio') return !steps[current].querySelector(`input[name="${field.name}"]:checked`);
      if (field.type === 'checkbox') return !field.checked;
      return field.value.trim() === '';
    };

    // Radio/checkbox inputs are visually hidden (styled as pills/swatches), so
    // the red boundary goes on the enclosing .form-group instead of the input.
    const invalidTarget = (field) => (field.type === 'radio' || field.type === 'checkbox')
      ? (field.closest('.form-group') || field)
      : field;

    const markFieldValidity = (field, invalid) => {
      invalidTarget(field).classList.toggle('field-invalid', invalid);
    };

    const highlightInvalidFields = (step) => {
      const fields = visibleRequiredFields(step);
      fields.forEach(field => markFieldValidity(field, fieldIsInvalid(field)));
      return fields.find(fieldIsInvalid);
    };

    // Clear a field's red boundary the moment the user starts fixing it.
    projectForm.addEventListener('input', (e) => {
      if (e.target.hasAttribute('required')) markFieldValidity(e.target, fieldIsInvalid(e.target));
    });
    projectForm.addEventListener('change', (e) => {
      if (e.target.hasAttribute('required')) markFieldValidity(e.target, fieldIsInvalid(e.target));
    });

    const stepIsValid = (index) => {
      const step = steps[index];
      const required = visibleRequiredFields(step);
      return required.every(field => {
        if (field.type === 'radio') {
          return step.querySelector(`input[name="${field.name}"]:checked`);
        }
        if (field.type === 'checkbox') {
          return field.checked;
        }
        return field.value.trim() !== '';
      });
    };

    nextBtn.addEventListener('click', () => {
      if (!stepIsValid(current)) {
        const invalidField = highlightInvalidFields(steps[current]);
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
      if (!stepIsValid(current)) {
        const invalidField = highlightInvalidFields(steps[current]);
        if (invalidField && invalidField.reportValidity) invalidField.reportValidity();
        return;
      }

      const showSuccess = () => {
        projectForm.style.display = 'none';
        if (successDetail) {
          successDetail.classList.add('show');
          successDetail.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

      // Fields from branches the visitor never saw are already disabled by
      // updateBranches(), so FormData skips them and the email carries only
      // the questions relevant to the build type they picked. Disabling them
      // here would have been too late to matter — validation has already run
      // by this point.
      const formData = new FormData(projectForm);

      fetch(projectForm.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      })
        .then((response) => {
          if (response.ok) {
            showSuccess();
          } else {
            alert('Something went wrong sending your enquiry. Please try again or email us directly.');
          }
        })
        .catch(() => {
          alert('Something went wrong sending your enquiry. Please try again or email us directly.');
        });
    });

    showStep(current);
  }
});
