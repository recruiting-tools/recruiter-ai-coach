// Recruiter AI Coach — Content Script
// UI: overlay with transcript, keywords, hints, goals checklist on Google Meet / Zoom
// Track 3 (UI/UX) — Iteration 2
// Changes: sticky hints at top, WebSocket to ws/events, MockStream integration

(function () {
  if (document.getElementById('rac-overlay')) return;

  // ── Lib modules loaded before this script via manifest ───
  // window.__RAC_Keywords  → keyword-chips-renderer.js
  // window.__RAC_Goals     → goals-checklist-renderer.js
  // window.__RAC_MockStream → mock-transcript-stream.js

  // ── Mock mode detection ─────────────────────────────────
  const isMockMode = (
    window.__RAC_MOCK === true ||
    new URLSearchParams(window.location.search).has('mock')
  );

  // ── Build overlay HTML ──────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'rac-overlay';
  overlay.innerHTML = `
    <div id="rac-header">
      <span>🎯 AI Coach</span>
      <div id="rac-dot"></div>
      <button id="rac-toggle">−</button>
    </div>
    <div id="rac-body">

      <!-- STICKY HINT — always at top when active -->
      <div id="rac-sticky-hint" class="rac-hidden"></div>

      <div id="rac-level-bar">
        <div id="rac-level-fill"></div>
        <span id="rac-level-text">Audio: --</span>
      </div>

      <div id="rac-section-transcript" class="rac-section">
        <div id="rac-transcript"></div>
      </div>

      <div id="rac-section-keywords" class="rac-section rac-collapsible">
        <div class="rac-section-header" data-target="rac-keywords-body">
          <span>🏷 Ключевики</span>
          <span class="rac-section-arrow">▶</span>
        </div>
        <div id="rac-keywords-body" class="rac-section-body rac-expanded">
          <div id="rac-keywords-chips"></div>
          <div id="rac-keywords-empty" class="rac-empty-hint">Ожидание ключевых слов...</div>
        </div>
      </div>

      <div id="rac-section-goals" class="rac-section rac-collapsible">
        <div class="rac-section-header" data-target="rac-goals-body">
          <span>✅ Цели</span>
          <span class="rac-section-arrow">▶</span>
        </div>
        <div id="rac-goals-body" class="rac-section-body rac-collapsed">
          <div id="rac-goals-list"></div>
          <div id="rac-goals-timer" class="rac-timer">⏱ 0 мин / 45 мин</div>
        </div>
      </div>

    </div>
  `;

  // ── Styles ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* === Base overlay === */
    #rac-overlay {
      position: fixed; top: 20px; right: 20px; width: 340px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; border-radius: 12px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.55);
      transition: width 0.2s ease;
    }

    /* === Header === */
    #rac-header {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; padding: 10px 14px;
      display: flex; align-items: center; gap: 8px;
      font-weight: 600; cursor: move;
      user-select: none;
    }
    #rac-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(255,255,255,0.3); margin-left: auto;
      transition: background 0.3s;
    }
    #rac-dot.on { background: #4ade80; animation: rac-pulse 1.5s infinite; }
    @keyframes rac-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    #rac-toggle {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
      font-size: 14px; line-height: 22px; text-align: center;
    }
    #rac-toggle:hover { background: rgba(255,255,255,0.35); }

    /* === Body === */
    #rac-body {
      background: rgba(13,13,13,0.96);
      backdrop-filter: blur(10px);
      max-height: 520px; overflow-y: auto;
    }
    #rac-body::-webkit-scrollbar { width: 4px; }
    #rac-body::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    /* === Sticky Hint Zone — pinned at top of body === */
    #rac-sticky-hint {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(13,13,13,0.98);
    }
    #rac-sticky-hint.rac-hidden {
      display: none;
    }
    .rac-hint-inner {
      position: relative;
      padding: 11px 36px 11px 13px;
      font-size: 13px; line-height: 1.5;
      border-bottom: 1px solid #222;
      animation: rac-hint-slide-in 0.25s ease;
    }
    .rac-hint-inner.rac-hint-exit {
      animation: rac-hint-slide-out 0.25s ease forwards;
    }
    @keyframes rac-hint-slide-in {
      0%   { opacity: 0; transform: translateY(-10px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes rac-hint-slide-out {
      0%   { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-10px); }
    }
    /* Hint types */
    .rac-hint-llm {
      background: rgba(99, 102, 241, 0.15);
      border-left: 3px solid rgba(99, 102, 241, 0.6);
      color: #c4b5fd;
    }
    .rac-hint-goal_check {
      background: rgba(59, 130, 246, 0.15);
      border-left: 3px solid rgba(59, 130, 246, 0.6);
      color: #93c5fd;
    }
    .rac-hint-competence_phrase {
      background: rgba(34, 197, 94, 0.15);
      border-left: 3px solid rgba(34, 197, 94, 0.6);
      color: #86efac;
    }
    .rac-hint-time_warning {
      background: rgba(245, 158, 11, 0.15);
      border-left: 3px solid rgba(245, 158, 11, 0.6);
      color: #fcd34d;
    }
    .rac-hint-dismiss-btn {
      position: absolute; top: 7px; right: 8px;
      background: none; border: none; color: inherit;
      opacity: 0.45; cursor: pointer; font-size: 15px;
      width: 22px; height: 22px; line-height: 22px;
      text-align: center; border-radius: 50%; padding: 0;
    }
    .rac-hint-dismiss-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); }

    /* === Audio level === */
    #rac-level-bar {
      height: 20px; background: #111; border-radius: 4px;
      margin: 10px 10px 0 10px; position: relative; overflow: hidden;
    }
    #rac-level-fill {
      height: 100%; width: 0%; border-radius: 4px;
      background: linear-gradient(90deg, #22c55e, #eab308, #ef4444);
      transition: width 0.15s ease;
    }
    #rac-level-text {
      position: absolute; top: 0; left: 8px; line-height: 20px;
      font-size: 10px; color: #aaa;
    }

    /* === Sections === */
    .rac-section { padding: 0 10px; }
    .rac-section-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 0 4px 0; cursor: pointer; user-select: none;
      color: #999; font-size: 12px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .rac-section-header:hover { color: #ccc; }
    .rac-section-arrow {
      font-size: 9px; transition: transform 0.2s ease;
      display: inline-block;
    }
    .rac-section-body {
      overflow: hidden; transition: max-height 0.3s ease, opacity 0.2s ease;
    }
    .rac-section-body.rac-expanded  { max-height: 500px; opacity: 1; }
    .rac-section-body.rac-collapsed { max-height: 0; opacity: 0; }
    .rac-empty-hint { color: #444; font-size: 11px; font-style: italic; padding: 4px 0; }

    /* === Transcript === */
    #rac-transcript {
      font-size: 13px; color: #ccc; line-height: 1.6;
      max-height: 160px; overflow-y: auto; padding: 8px 0;
    }
    #rac-transcript::-webkit-scrollbar { width: 3px; }
    #rac-transcript::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    #rac-transcript:empty::before { content: 'Ожидание транскрипции...'; color: #555; }
    .rac-paragraph {
      margin-bottom: 6px; padding: 4px 8px;
      border-radius: 6px; border-left: 3px solid #333;
      background: rgba(255,255,255,0.02);
    }
    .rac-speaker-0  { border-left-color: #60a5fa; color: #93bbfd; }
    .rac-speaker-1  { border-left-color: #4ade80; color: #86efac; }
    .rac-speaker-unknown { border-left-color: #6b7280; color: #9ca3af; }
    .rac-speaker-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 2px; display: block; opacity: 0.7;
    }
    .rac-interim { color: #888; font-style: italic; }
    .rac-debug   { color: #555; font-size: 11px; font-style: italic; padding: 2px 8px; }

    /* === Keywords chips === */
    #rac-keywords-chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 0; }
    .rac-kw-chip {
      display: inline-block; padding: 3px 8px; border-radius: 12px;
      font-size: 11px; font-weight: 500;
      background: #1e293b; color: #94a3b8; border: 1px solid #334155;
      cursor: pointer; transition: all 0.3s ease; white-space: nowrap;
    }
    .rac-kw-chip:hover { background: #334155; color: #e2e8f0; border-color: #475569; }
    .rac-kw-new {
      background: #312e81 !important; color: #c4b5fd !important;
      border-color: #6366f1 !important;
      animation: rac-kw-glow 0.6s ease;
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
    }
    @keyframes rac-kw-glow {
      0%   { transform: scale(1.15); box-shadow: 0 0 12px rgba(99, 102, 241, 0.6); }
      100% { transform: scale(1);    box-shadow: 0 0 8px rgba(99, 102, 241, 0.4); }
    }
    .rac-kw-pulse { animation: rac-kw-bump 0.4s ease; }
    @keyframes rac-kw-bump {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    /* === Goals checklist === */
    #rac-goals-list { padding: 4px 0; }
    .rac-goal-row {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 6px; border-radius: 6px;
      cursor: pointer; transition: background 0.15s ease; user-select: none;
    }
    .rac-goal-row:hover { background: rgba(255,255,255,0.05); }
    .rac-goal-check {
      font-size: 16px; color: #6b7280;
      transition: color 0.2s ease; flex-shrink: 0; width: 20px; text-align: center;
    }
    .rac-goal-done .rac-goal-check { color: #4ade80; }
    .rac-goal-auto .rac-goal-check { color: #60a5fa; }
    .rac-goal-label { color: #aaa; font-size: 12px; transition: color 0.2s ease; }
    .rac-goal-done .rac-goal-label { color: #666; text-decoration: line-through; }
    .rac-goal-auto .rac-goal-label { color: #7da3d4; text-decoration: line-through; }
    .rac-goal-auto-flash { animation: rac-goal-flash 1.2s ease; }
    @keyframes rac-goal-flash {
      0%   { background: rgba(74, 222, 128, 0.2); }
      100% { background: transparent; }
    }

    /* === Timer === */
    .rac-timer {
      padding: 6px 0; font-size: 12px; color: #888;
      text-align: right; border-top: 1px solid #1a1a1a; margin-top: 4px;
    }

    /* === Dividers === */
    .rac-section + .rac-section { border-top: 1px solid #1a1a1a; }

    /* === Mock mode badge === */
    .rac-mock-badge {
      background: #f59e0b; color: #000; font-size: 9px;
      padding: 1px 6px; border-radius: 8px; font-weight: 700;
      margin-left: 6px; letter-spacing: 0.3px;
    }

    /* === WS status dot in header === */
    #rac-ws-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #6b7280; margin-left: 2px;
      transition: background 0.5s;
      flex-shrink: 0;
      title: 'Backend WS';
    }
    #rac-ws-dot.connected  { background: #4ade80; }
    #rac-ws-dot.connecting { background: #f59e0b; animation: rac-pulse 1s infinite; }
    #rac-ws-dot.error      { background: #ef4444; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  // ── Add WS status dot to header ──────────────────────────
  const wsDot = document.createElement('div');
  wsDot.id = 'rac-ws-dot';
  wsDot.title = 'Backend connection';
  const headerEl = document.getElementById('rac-header');
  const toggleBtn = document.getElementById('rac-toggle');
  headerEl.insertBefore(wsDot, toggleBtn);

  // ── Mock mode badge ──────────────────────────────────────
  if (isMockMode) {
    const badge = document.createElement('span');
    badge.className = 'rac-mock-badge';
    badge.textContent = 'MOCK';
    document.querySelector('#rac-header span').appendChild(badge);
  }

  // ── Drag ────────────────────────────────────────────────
  let dragging = false, ox = 0, oy = 0;
  headerEl.addEventListener('mousedown', (e) => {
    if (e.target.id === 'rac-toggle' || e.target.closest('#rac-toggle')) return;
    dragging = true;
    const r = overlay.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    overlay.style.right = 'auto';
    overlay.style.left = (e.clientX - ox) + 'px';
    overlay.style.top  = (e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // ── Collapse main body ───────────────────────────────────
  let collapsed = false;
  document.getElementById('rac-toggle').addEventListener('click', () => {
    collapsed = !collapsed;
    document.getElementById('rac-body').style.display = collapsed ? 'none' : 'block';
    document.getElementById('rac-toggle').textContent = collapsed ? '+' : '−';
  });

  // ── Collapsible sections ─────────────────────────────────
  document.querySelectorAll('.rac-section-header').forEach((hdr) => {
    const targetId = hdr.dataset.target;
    const body  = document.getElementById(targetId);
    const arrow = hdr.querySelector('.rac-section-arrow');
    if (body && arrow) {
      arrow.style.transform = body.classList.contains('rac-expanded') ? 'rotate(90deg)' : 'rotate(0deg)';
    }
    hdr.addEventListener('click', () => {
      if (!body) return;
      const isExpanded = body.classList.contains('rac-expanded');
      body.classList.toggle('rac-expanded', !isExpanded);
      body.classList.toggle('rac-collapsed', isExpanded);
      if (arrow) arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
    });
  });

  // ── Initialize keyword renderer ──────────────────────────
  const keywordsChipsEl = document.getElementById('rac-keywords-chips');
  const keywordsEmptyEl = document.getElementById('rac-keywords-empty');

  if (window.__RAC_Keywords) {
    window.__RAC_Keywords.init(keywordsChipsEl, (keyword) => {
      console.log('[RAC] Keyword clicked:', keyword);
      try { chrome.runtime.sendMessage({ type: 'keyword_explain', keyword }); } catch (e) {}
    });
  }

  // ── Initialize goals renderer ────────────────────────────
  const goalsListEl  = document.getElementById('rac-goals-list');
  const goalsTimerEl = document.getElementById('rac-goals-timer');

  if (window.__RAC_Goals) {
    window.__RAC_Goals.init(goalsListEl, goalsTimerEl, (goalId, checked) => {
      console.log('[RAC] Goal toggled:', goalId, checked);
      try { chrome.runtime.sendMessage({ type: 'goal_toggle', goalId, checked }); } catch (e) {}
    });

    window.__RAC_Goals.setGoals([
      { id: 'hard_react',       label: 'React experience',   type: 'hard_skills' },
      { id: 'hard_typescript',  label: 'TypeScript',         type: 'hard_skills' },
      { id: 'hard_system_design', label: 'System Design',    type: 'hard_skills' },
      { id: 'checklist_salary', label: 'Salary expectations', type: 'checklist' },
    ]);
  }

  // ── Sticky hint management ───────────────────────────────
  const stickyHintEl = document.getElementById('rac-sticky-hint');
  let hintAutoDismissTimer = null;
  let currentHintInner = null;

  function showHint(hintText, hintType) {
    // Clear auto-dismiss
    if (hintAutoDismissTimer) { clearTimeout(hintAutoDismissTimer); hintAutoDismissTimer = null; }

    // Exit-animate previous hint if visible
    if (currentHintInner && !stickyHintEl.classList.contains('rac-hidden')) {
      const old = currentHintInner;
      old.classList.add('rac-hint-exit');
      setTimeout(() => { if (old.parentNode) old.remove(); }, 250);
    }

    // Build new hint element
    const typeClass = 'rac-hint-' + (hintType || 'llm');
    const inner = document.createElement('div');
    inner.className = 'rac-hint-inner ' + typeClass;
    inner.textContent = hintText; // safe — no innerHTML with user content

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'rac-hint-dismiss-btn';
    dismissBtn.textContent = '✕';
    dismissBtn.title = 'Закрыть';
    dismissBtn.addEventListener('click', dismissHint);
    inner.appendChild(dismissBtn);

    stickyHintEl.appendChild(inner);
    stickyHintEl.classList.remove('rac-hidden');
    currentHintInner = inner;

    // Auto-dismiss after 15 s
    hintAutoDismissTimer = setTimeout(dismissHint, 15000);
  }

  function dismissHint() {
    if (hintAutoDismissTimer) { clearTimeout(hintAutoDismissTimer); hintAutoDismissTimer = null; }
    if (!currentHintInner) return;
    const inner = currentHintInner;
    currentHintInner = null;
    inner.classList.add('rac-hint-exit');
    setTimeout(() => {
      if (inner.parentNode) inner.remove();
      if (!stickyHintEl.hasChildNodes()) stickyHintEl.classList.add('rac-hidden');
    }, 250);
  }

  // ── Transcript state ─────────────────────────────────────
  const transcriptEl = document.getElementById('rac-transcript');
  let currentParagraph = null;
  let interimSpan      = null;
  let finalText        = '';
  let currentSpeaker   = null;

  const speakerNames   = { 0: 'Рекрутер', 1: 'Кандидат' };
  const speakerClasses = { 0: 'rac-speaker-0', 1: 'rac-speaker-1' };

  function getSpeakerClass(speaker) {
    if (!speaker) return 'rac-speaker-unknown';
    const id = speaker.id !== undefined ? speaker.id : speaker;
    return speakerClasses[id] || 'rac-speaker-unknown';
  }

  function getSpeakerName(speaker) {
    if (!speaker) return '';
    const id = speaker.id !== undefined ? speaker.id : speaker;
    return speakerNames[id] || '';
  }

  // ── Central event handler ────────────────────────────────
  function handleEvent(msg) {
    if (msg.type === 'audio_level') {
      const pct = Math.min(100, msg.level * 1.5);
      document.getElementById('rac-level-fill').style.width = pct + '%';
      document.getElementById('rac-level-text').textContent = 'Audio: ' + msg.level;
      return;
    }

    if (msg.type === 'transcript_interim') {
      if (msg.text && msg.text.startsWith('[debug]')) { showDebug(msg.text); return; }
      ensureParagraph(msg.speaker);
      if (!interimSpan) {
        interimSpan = document.createElement('span');
        interimSpan.className = 'rac-interim';
        currentParagraph.appendChild(interimSpan);
      }
      interimSpan.textContent = ' ' + msg.text;
      scrollTranscript();
      return;
    }

    if (msg.type === 'transcript_final') {
      const newSpeakerId = msg.speaker ? (msg.speaker.id !== undefined ? msg.speaker.id : msg.speaker) : null;
      if (currentParagraph && currentSpeaker !== newSpeakerId && newSpeakerId !== null) {
        currentParagraph = null; finalText = '';
      }
      ensureParagraph(msg.speaker);
      if (interimSpan) { interimSpan.remove(); interimSpan = null; }
      finalText += (finalText ? ' ' : '') + msg.text;
      const textNode = currentParagraph.querySelector('.rac-para-text');
      if (textNode) textNode.textContent = finalText;
      scrollTranscript();
      if (msg.speechFinal) { currentParagraph = null; finalText = ''; currentSpeaker = null; }
      return;
    }

    if (msg.type === 'keyword_detected') {
      if (window.__RAC_Keywords) {
        window.__RAC_Keywords.addKeyword(msg.keyword, msg.confidence || 0.8);
        if (keywordsEmptyEl) keywordsEmptyEl.style.display = 'none';
      }
      return;
    }

    if (msg.type === 'hint') {
      showHint(msg.hint, msg.hint_type);
      return;
    }

    if (msg.type === 'goal_update') {
      if (window.__RAC_Goals) window.__RAC_Goals.updateGoal(msg.goalId, msg.addressed);
      return;
    }

    if (msg.type === 'timer_update') {
      if (window.__RAC_Goals) window.__RAC_Goals.updateTimer(msg.elapsedSec, msg.maxSec);
      return;
    }

    if (msg.type === 'status') {
      updateStatus(msg.status);
      return;
    }
  }

  function ensureParagraph(speaker) {
    if (currentParagraph) return;
    currentParagraph = document.createElement('div');
    currentParagraph.className = 'rac-paragraph';
    const speakerId = speaker ? (speaker.id !== undefined ? speaker.id : speaker) : null;
    currentSpeaker = speakerId;
    currentParagraph.classList.add(getSpeakerClass(speaker));
    const name = getSpeakerName(speaker);
    if (name) {
      const label = document.createElement('span');
      label.className = 'rac-speaker-label';
      label.textContent = name;
      currentParagraph.appendChild(label);
    }
    const textSpan = document.createElement('span');
    textSpan.className = 'rac-para-text';
    currentParagraph.appendChild(textSpan);
    transcriptEl.appendChild(currentParagraph);
    finalText = ''; interimSpan = null;
  }

  function showDebug(text) {
    const el = document.createElement('div');
    el.className = 'rac-debug';
    el.textContent = text;
    transcriptEl.appendChild(el);
    scrollTranscript();
  }

  function scrollTranscript() {
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
    // #rac-sticky-hint has position:sticky so no need to reset body scroll
  }

  function updateStatus(status) {
    const dot = document.getElementById('rac-dot');
    dot.classList.toggle('on', status === 'listening');
  }

  function setWsDotState(state) {
    wsDot.className = '';
    if (state) wsDot.classList.add(state);
  }

  // ── Listen for messages from background.js ───────────────
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      handleEvent(msg);
    });
  }

  // ── WebSocket to backend events endpoint ─────────────────
  // Receives: hint, keyword_detected, goal_update, transcript_*, audio_level
  let eventsWs = null;
  let eventsWsRetryTimer = null;
  let eventsWsRetryCount = 0;
  const EVENTS_WS_URL = 'ws://localhost:3000/ws/events';

  function connectEventsWS() {
    if (eventsWs && (eventsWs.readyState === WebSocket.OPEN || eventsWs.readyState === WebSocket.CONNECTING)) return;

    setWsDotState('connecting');
    console.log('[RAC] Connecting to events WS:', EVENTS_WS_URL);

    try {
      eventsWs = new WebSocket(EVENTS_WS_URL);
    } catch (e) {
      console.warn('[RAC] Events WS constructor error:', e.message);
      scheduleEventsWsReconnect();
      return;
    }

    eventsWs.onopen = () => {
      eventsWsRetryCount = 0;
      setWsDotState('connected');
      console.log('[RAC] Events WS connected');
    };

    eventsWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleEvent(msg);
      } catch (err) {
        console.warn('[RAC] Events WS parse error:', err.message, e.data);
      }
    };

    eventsWs.onclose = (e) => {
      eventsWs = null;
      setWsDotState('error');
      console.log('[RAC] Events WS closed (code=' + e.code + '), reconnecting...');
      scheduleEventsWsReconnect();
    };

    eventsWs.onerror = () => {
      // onclose fires next; just log
      console.warn('[RAC] Events WS error');
    };
  }

  function scheduleEventsWsReconnect() {
    clearTimeout(eventsWsRetryTimer);
    const delay = Math.min(500 * Math.pow(2, eventsWsRetryCount), 30000);
    eventsWsRetryCount++;
    eventsWsRetryTimer = setTimeout(connectEventsWS, delay);
  }

  // ── Startup ──────────────────────────────────────────────
  if (isMockMode) {
    console.log('[RAC] Mock mode — starting MockStream');
    if (window.__RAC_MockStream) {
      window.__RAC_MockStream.startMockStream(handleEvent, { loop: true, speedMultiplier: 1 });
      // Show mock status
      setTimeout(() => updateStatus('listening'), 300);
    } else {
      console.warn('[RAC] MockStream not loaded, falling back to direct WS');
      connectEventsWS();
    }
  } else {
    connectEventsWS();
  }

})();
