(() => {
  'use strict';

  let currentVideoId = null;
  let panelEl = null;
  let btnEl = null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
  }

  function waitForElement(selector, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error(`Timeout waiting for ${selector}`)); }, timeout);
    });
  }

  function formatMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^## (.+)$/gm, '<h3 class="distill-heading">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 class="distill-heading">$1</h2>')
      .replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li><span class="distill-num">$1.</span> $2</li>')
      .replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, m => `<ul class="distill-list">${m}</ul>`)
      .replace(/\n{2,}/g, '</p><p class="distill-p">')
      .replace(/^(?!<[hup\/])/gm, '<p class="distill-p">$&')
      .replace(/<p class="distill-p"><\/p>/g, '')
      .trim();
  }

  // ─── UI construction ──────────────────────────────────────────────────────

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'distill-panel';
    panel.innerHTML = `
      <div class="distill-header">
        <span class="distill-logo">✦ Distill</span>
        <div class="distill-modes" role="group" aria-label="Summary mode">
          <button class="distill-mode active" data-mode="bullets">Key Points</button>
          <button class="distill-mode" data-mode="detailed">Detailed</button>
          <button class="distill-mode" data-mode="takeaways">Takeaways</button>
        </div>
        <button class="distill-close" title="Close" aria-label="Close Distill panel">✕</button>
      </div>
      <div class="distill-body">
        <div class="distill-idle">
          <p>Summarize this video with Gemini AI.</p>
          <button class="distill-run-btn">✦ Summarize</button>
        </div>
      </div>
    `;

    panel.querySelector('.distill-close').addEventListener('click', closePanel);
    panel.querySelector('.distill-run-btn').addEventListener('click', runSummary);
    panel.querySelectorAll('.distill-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.distill-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    return panel;
  }

  function buildButton() {
    const btn = document.createElement('button');
    btn.id = 'distill-btn';
    btn.setAttribute('aria-label', 'Distill this video');
    btn.innerHTML = `<span class="distill-btn-icon">✦</span><span class="distill-btn-label">Distill</span>`;
    btn.addEventListener('click', togglePanel);
    return btn;
  }

  // ─── Mount / teardown ─────────────────────────────────────────────────────

  async function mount() {
    const videoId = getVideoId();
    if (!videoId) return;
    if (videoId === currentVideoId) return;

    currentVideoId = videoId;
    teardown();

    let titleEl;
    try {
      titleEl = await waitForElement('h1.ytd-watch-metadata');
    } catch {
      return;
    }

    const titleContainer = titleEl.closest('#title') || titleEl.parentElement;

    btnEl = buildButton();
    panelEl = buildPanel();

    // Place button inline with the title
    titleContainer.appendChild(btnEl);

    // Place panel after the entire #title row, inside #above-the-fold
    const aboveFold = titleContainer.closest('#above-the-fold') || titleContainer.parentElement;
    titleContainer.insertAdjacentElement('afterend', panelEl);

    // Make the title row flex so button sits beside the title text
    titleContainer.style.cssText += ';display:flex;flex-wrap:wrap;align-items:center;gap:10px;';
  }

  function teardown() {
    document.getElementById('distill-btn')?.remove();
    document.getElementById('distill-panel')?.remove();
    panelEl = null;
    btnEl = null;
  }

  // ─── Panel state ──────────────────────────────────────────────────────────

  function togglePanel() {
    if (!panelEl) return;
    const hidden = panelEl.getAttribute('aria-hidden') !== 'false';
    panelEl.setAttribute('aria-hidden', String(!hidden));
    panelEl.classList.toggle('distill-open', hidden);
    btnEl?.classList.toggle('distill-btn-active', hidden);
  }

  function closePanel() {
    panelEl?.setAttribute('aria-hidden', 'true');
    panelEl?.classList.remove('distill-open');
    btnEl?.classList.remove('distill-btn-active');
  }

  async function runSummary() {
    if (!panelEl) return;
    const mode = panelEl.querySelector('.distill-mode.active')?.dataset.mode || 'bullets';
    const body = panelEl.querySelector('.distill-body');

    body.innerHTML = `
      <div class="distill-loading" aria-live="polite">
        <div class="distill-spinner"></div>
        <span>Distilling with Gemini…</span>
      </div>`;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DISTILL_VIDEO',
        videoUrl: window.location.href,
        mode,
      });

      if (!response.success) throw new Error(response.error);

      body.innerHTML = `
        <div class="distill-result">${formatMarkdown(response.summary)}</div>
        <div class="distill-actions">
          <button class="distill-run-btn distill-rerun">↺ Re-summarize</button>
          <button class="distill-copy-btn">⎘ Copy</button>
        </div>`;

      body.querySelector('.distill-rerun').addEventListener('click', runSummary);
      body.querySelector('.distill-copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(response.summary).catch(() => {});
        const cb = body.querySelector('.distill-copy-btn');
        cb.textContent = '✓ Copied';
        setTimeout(() => { cb.innerHTML = '⎘ Copy'; }, 1800);
      });

    } catch (err) {
      body.innerHTML = `
        <div class="distill-error" aria-live="assertive">
          <p>⚠ ${err.message}</p>
          <button class="distill-run-btn">Try again</button>
        </div>`;
      body.querySelector('.distill-run-btn').addEventListener('click', runSummary);
    }
  }

  // ─── Navigation handling ──────────────────────────────────────────────────

  // YouTube fires this event on SPA navigation
  window.addEventListener('yt-navigate-finish', mount);

  // Also observe URL changes for robustness
  let lastHref = location.href;
  new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      if (location.pathname === '/watch') mount();
      else { teardown(); currentVideoId = null; }
    }
  }).observe(document, { subtree: true, childList: true });

  // Initial page load
  mount();
})();
