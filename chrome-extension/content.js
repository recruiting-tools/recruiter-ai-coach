// Recruiter AI Coach — Content Script
// UI: overlay with transcript, keywords, hints, goals checklist on Google Meet / Zoom
// Track 3 (UI/UX) — Iteration 1

(function () {
  if (document.getElementById('rac-overlay')) return;

  // ── Load lib modules (injected via manifest or inline) ──
  // keyword-chips-renderer.js and goals-checklist-renderer.js
  // set window.__RAC_Keywords and window.__RAC_Goals

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
      <span>\ud83c\udfaf AI Coach</span>
      <div id="rac-dot"></div>
      <button id="rac-toggle">\u2212</button>
    </div>
    <div id="rac-body">
      <div id="rac-level-bar">
        <div id="rac-level-fill"></div>
        <span id="rac-level-text">Audio: --</span>
      </div>

      <div id="rac-section-transcript" class="rac-section">
        <div id="rac-transcript"></div>
      </div>

      <div id="rac-section-keywords" class="rac-section rac-collapsible">
        <div class="rac-section-header" data-target="rac-keywords-body">
          <span>\ud83c\udff7 \u041a\u043b\u044e\u0447\u0435\u0432\u0438\u043a\u0438</span>
          <span class="rac-section-arrow">\u25b6</span>
        </div>
        <div id="rac-keywords-body" class="rac-section-body rac-expanded">
          <div id="rac-keywords-chips"></div>
          <div id="rac-keywords-empty" class="rac-empty-hint">\u041e\u0436\u0438\u0434\u0430\u043d\u0438\u0435 \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0445 \u0441\u043b\u043e\u0432...</div>
        </div>
      </div>

      <div id="rac-section-hint" class="rac-section">
        <div id="rac-hint-card" class="rac-hint-card rac-hidden">
          <div id="rac-hint-text"></div>
          <button id="rac-hint-dismiss">\u00d7</button>
        </div>
      </div>

      <div id="rac-section-goals" class="rac-section rac-collapsible">
        <div class="rac-section-header" data-target="rac-goals-body">
          <span>\u2705 \u0426\u0435\u043b\u0438</span>
          <span class="rac-section-arrow">\u25b6</span>
        </div>
        <div id="rac-goals-body" class="rac-section-body rac-collapsed">
          <div id="rac-goals-list"></div>
          <div id="rac-goals-timer" class="rac-timer">\u23f1 0 \u043c\u0438\u043d / 45 \u043c\u0438\u043d</div>
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
    .rac-section {
      padding: 0 10px;
    }
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
    .rac-section-body.rac-expanded + .rac-section-header .rac-section-arrow,
    .rac-expanded > .rac-section-header .rac-section-arrow {
      transform: rotate(90deg);
    }
    .rac-section-body {
      overflow: hidden; transition: max-height 0.3s ease, opacity 0.2s ease;
    }
    .rac-section-body.rac-expanded {
      max-height: 500px; opacity: 1;
    }
    .rac-section-body.rac-collapsed {
      max-height: 0; opacity: 0;
    }
    .rac-empty-hint {
      color: #444; font-size: 11px; font-style: italic; padding: 4px 0;
    }

    /* === Transcript === */
    #rac-transcript {
      font-size: 13px; color: #ccc; line-height: 1.6;
      max-height: 160px; overflow-y: auto; padding: 8px 0;
    }
    #rac-transcript::-webkit-scrollbar { width: 3px; }
    #rac-transcript::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    #rac-transcript:empty::before {
      content: '\u041e\u0436\u0438\u0434\u0430\u043d\u0438\u0435 \u0442\u0440\u0430\u043d\u0441\u043a\u0440\u0438\u043f\u0446\u0438\u0438...';
      color: #555;
    }
    .rac-paragraph {
      margin-bottom: 6px; padding: 4px 8px;
      border-radius: 6px;
      border-left: 3px solid #333;
      background: rgba(255,255,255,0.02);
    }
    .rac-speaker-0 {
      border-left-color: #60a5fa;
      color: #93bbfd;
    }
    .rac-speaker-1 {
      border-left-color: #4ade80;
      color: #86efac;
    }
    .rac-speaker-unknown {
      border-left-color: #6b7280;
      color: #9ca3af;
    }
    .rac-speaker-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 2px; display: block;
      opacity: 0.7;
    }
    .rac-interim { color: #888; font-style: italic; }
    .rac-debug { color: #555; font-size: 11px; font-style: italic; padding: 2px 8px; }

    /* === Keywords chips === */
    #rac-keywords-chips {
      display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 0;
    }
    .rac-kw-chip {
      display: inline-block;
      padding: 3px 8px; border-radius: 12px;
      font-size: 11px; font-weight: 500;
      background: #1e293b; color: #94a3b8;
      border: 1px solid #334155;
      cursor: pointer; transition: all 0.3s ease;
      white-space: nowrap;
    }
    .rac-kw-chip:hover {
      background: #334155; color: #e2e8f0;
      border-color: #475569;
    }
    .rac-kw-new {
      background: #312e81 !important; color: #c4b5fd !important;
      border-color: #6366f1 !important;
      animation: rac-kw-glow 0.6s ease;
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
    }
    @keyframes rac-kw-glow {
      0% { transform: scale(1.15); box-shadow: 0 0 12px rgba(99, 102, 241, 0.6); }
      100% { transform: scale(1); box-shadow: 0 0 8px rgba(99, 102, 241, 0.4); }
    }
    .rac-kw-pulse {
      animation: rac-kw-bump 0.4s ease;
    }
    @keyframes rac-kw-bump {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    /* === Hint card === */
    .rac-hint-card {
      position: relative;
      padding: 10px 30px 10px 12px;
      border-radius: 8px; margin: 8px 0;
      font-size: 13px; line-height: 1.5;
      animation: rac-hint-slide-in 0.3s ease;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .rac-hint-card.rac-hidden {
      display: none;
    }
    @keyframes rac-hint-slide-in {
      0% { opacity: 0; transform: translateY(-8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .rac-hint-card.rac-hint-dismissing {
      opacity: 0; transform: translateY(-8px);
    }
    /* Hint types */
    .rac-hint-llm {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #c4b5fd;
    }
    .rac-hint-goal_check {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
    }
    .rac-hint-competence_phrase {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #86efac;
    }
    .rac-hint-time_warning {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fcd34d;
    }
    #rac-hint-dismiss {
      position: absolute; top: 6px; right: 6px;
      background: none; border: none; color: inherit;
      opacity: 0.5; cursor: pointer; font-size: 16px;
      width: 20px; height: 20px; line-height: 20px;
      text-align: center; border-radius: 50%;
      padding: 0;
    }
    #rac-hint-dismiss:hover { opacity: 1; background: rgba(255,255,255,0.1); }

    /* === Goals checklist === */
    #rac-goals-list {
      padding: 4px 0;
    }
    .rac-goal-row {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 6px; border-radius: 6px;
      cursor: pointer; transition: background 0.15s ease;
      user-select: none;
    }
    .rac-goal-row:hover { background: rgba(255,255,255,0.05); }
    .rac-goal-check {
      font-size: 16px; color: #6b7280;
      transition: color 0.2s ease;
      flex-shrink: 0; width: 20px; text-align: center;
    }
    .rac-goal-done .rac-goal-check { color: #4ade80; }
    .rac-goal-auto .rac-goal-check { color: #60a5fa; }
    .rac-goal-label {
      color: #aaa; font-size: 12px;
      transition: color 0.2s ease;
    }
    .rac-goal-done .rac-goal-label {
      color: #666; text-decoration: line-through;
    }
    .rac-goal-auto .rac-goal-label {
      color: #7da3d4;
      text-decoration: line-through;
    }
    .rac-goal-auto-flash {
      animation: rac-goal-flash 1.2s ease;
    }
    @keyframes rac-goal-flash {
      0% { background: rgba(74, 222, 128, 0.2); }
      100% { background: transparent; }
    }

    /* === Timer === */
    .rac-timer {
      padding: 6px 0; font-size: 12px; color: #888;
      text-align: right;
      border-top: 1px solid #1a1a1a;
      margin-top: 4px;
    }

    /* === Divider between sections === */
    .rac-section + .rac-section {
      border-top: 1px solid #1a1a1a;
    }

    /* === Mock mode indicator === */
    .rac-mock-badge {
      background: #f59e0b; color: #000; font-size: 9px;
      padding: 1px 6px; border-radius: 8px; font-weight: 700;
      margin-left: 6px; letter-spacing: 0.3px;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  // ── Mock mode badge ─────────────────────────────────────
  if (isMockMode) {
    const badge = document.createElement('span');
    badge.className = 'rac-mock-badge';
    badge.textContent = 'MOCK';
    document.querySelector('#rac-header span').appendChild(badge);
  }

  // ── Drag ────────────────────────────────────────────────
  const header = document.getElementById('rac-header');
  let dragging = false, ox = 0, oy = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target.id === 'rac-toggle' || e.target.closest('#rac-toggle')) return;
    dragging = true;
    const r = overlay.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    overlay.style.right = 'auto';
    overlay.style.left = (e.clientX - ox) + 'px';
    overlay.style.top = (e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // ── Collapse main body ──────────────────────────────────
  let collapsed = false;
  document.getElementById('rac-toggle').addEventListener('click', () => {
    collapsed = !collapsed;
    document.getElementById('rac-body').style.display = collapsed ? 'none' : 'block';
    document.getElementById('rac-toggle').textContent = collapsed ? '+' : '\u2212';
  });

  // ── Collapsible sections ────────────────────────────────
  document.querySelectorAll('.rac-section-header').forEach((hdr) => {
    hdr.addEventListener('click', () => {
      const targetId = hdr.dataset.target;
      const body = document.getElementById(targetId);
      if (!body) return;
      const isExpanded = body.classList.contains('rac-expanded');
      body.classList.toggle('rac-expanded', !isExpanded);
      body.classList.toggle('rac-collapsed', isExpanded);
      // Rotate arrow
      const arrow = hdr.querySelector('.rac-section-arrow');
      if (arrow) {
        arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
      }
    });
    // Set initial arrow state
    const targetId = hdr.dataset.target;
    const body = document.getElementById(targetId);
    const arrow = hdr.querySelector('.rac-section-arrow');
    if (body && arrow) {
      arrow.style.transform = body.classList.contains('rac-expanded') ? 'rotate(90deg)' : 'rotate(0deg)';
    }
  });

  // ── Initialize keyword renderer ─────────────────────────
  const keywordsChipsEl = document.getElementById('rac-keywords-chips');
  const keywordsEmptyEl = document.getElementById('rac-keywords-empty');

  // Init keyword renderer (from lib/keyword-chips-renderer.js)
  if (window.__RAC_Keywords) {
    window.__RAC_Keywords.init(keywordsChipsEl, (keyword) => {
      // Future: send message to background requesting explanation
      console.log('[RAC] Keyword clicked:', keyword);
      try {
        chrome.runtime.sendMessage({
          type: 'keyword_explain',
          keyword: keyword,
        });
      } catch (e) { /* ignore if no background */ }
    });
  }

  // ── Initialize goals renderer ───────────────────────────
  const goalsListEl = document.getElementById('rac-goals-list');
  const goalsTimerEl = document.getElementById('rac-goals-timer');

  if (window.__RAC_Goals) {
    window.__RAC_Goals.init(goalsListEl, goalsTimerEl, (goalId, checked) => {
      console.log('[RAC] Goal toggled:', goalId, checked);
      try {
        chrome.runtime.sendMessage({
          type: 'goal_toggle',
          goalId: goalId,
          checked: checked,
        });
      } catch (e) { /* ignore */ }
    });

    // Set default mock goals
    window.__RAC_Goals.setGoals([
      { id: 'hard_react', label: 'React experience', type: 'hard_skills' },
      { id: 'hard_typescript', label: 'TypeScript', type: 'hard_skills' },
      { id: 'hard_system_design', label: 'System Design', type: 'hard_skills' },
      { id: 'checklist_salary', label: 'Salary expectations', type: 'checklist' },
    ]);
  }

  // ── Hint management ─────────────────────────────────────
  const hintCard = document.getElementById('rac-hint-card');
  const hintText = document.getElementById('rac-hint-text');
  const hintDismiss = document.getElementById('rac-hint-dismiss');
  let hintAutoDismissTimer = null;

  function showHint(hint, hintType) {
    // Clear previous auto-dismiss
    if (hintAutoDismissTimer) {
      clearTimeout(hintAutoDismissTimer);
      hintAutoDismissTimer = null;
    }

    // Remove old type classes
    hintCard.className = 'rac-hint-card';

    // Set type class
    const typeClass = 'rac-hint-' + (hintType || 'llm');
    hintCard.classList.add(typeClass);

    hintText.textContent = hint;

    // Force re-trigger animation
    hintCard.style.animation = 'none';
    hintCard.offsetHeight; // reflow
    hintCard.style.animation = '';

    // Auto-dismiss after 15 seconds
    hintAutoDismissTimer = setTimeout(() => {
      dismissHint();
    }, 15000);
  }

  function dismissHint() {
    hintCard.classList.add('rac-hint-dismissing');
    setTimeout(() => {
      hintCard.classList.add('rac-hidden');
      hintCard.classList.remove('rac-hint-dismissing');
    }, 300);
    if (hintAutoDismissTimer) {
      clearTimeout(hintAutoDismissTimer);
      hintAutoDismissTimer = null;
    }
  }

  hintDismiss.addEventListener('click', dismissHint);

  // ── Transcript state ────────────────────────────────────
  const transcript = document.getElementById('rac-transcript');
  let currentParagraph = null;
  let interimSpan = null;
  let finalText = '';
  let currentSpeaker = null;

  // Speaker name map
  const speakerNames = { 0: '\u0420\u0435\u043a\u0440\u0443\u0442\u0435\u0440', 1: '\u041a\u0430\u043d\u0434\u0438\u0434\u0430\u0442' };
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

  // ── Central event handler ───────────────────────────────
  function handleEvent(msg) {
    if (msg.type === 'audio_level') {
      const fill = document.getElementById('rac-level-fill');
      const text = document.getElementById('rac-level-text');
      const pct = Math.min(100, msg.level * 1.5);
      fill.style.width = pct + '%';
      text.textContent = 'Audio: ' + msg.level;
    }

    if (msg.type === 'transcript_interim') {
      if (msg.text && msg.text.startsWith('[debug]')) {
        showDebug(msg.text);
        return;
      }
      ensureParagraph(msg.speaker);
      if (!interimSpan) {
        interimSpan = document.createElement('span');
        interimSpan.className = 'rac-interim';
        currentParagraph.appendChild(interimSpan);
      }
      interimSpan.textContent = ' ' + msg.text;
      scrollTranscript();
    }

    if (msg.type === 'transcript_final') {
      // If speaker changed, start new paragraph
      const newSpeakerId = msg.speaker ? (msg.speaker.id !== undefined ? msg.speaker.id : msg.speaker) : null;
      if (currentParagraph && currentSpeaker !== newSpeakerId && newSpeakerId !== null) {
        currentParagraph = null;
        finalText = '';
      }

      ensureParagraph(msg.speaker);

      // Remove interim
      if (interimSpan) {
        interimSpan.remove();
        interimSpan = null;
      }

      finalText += (finalText ? ' ' : '') + msg.text;
      // Update text content (first text node after the label)
      const textNode = currentParagraph.querySelector('.rac-para-text');
      if (textNode) textNode.textContent = finalText;
      scrollTranscript();

      // speechFinal — end of utterance, start new paragraph
      if (msg.speechFinal) {
        currentParagraph = null;
        finalText = '';
        currentSpeaker = null;
      }
    }

    if (msg.type === 'keyword_detected') {
      if (window.__RAC_Keywords) {
        window.__RAC_Keywords.addKeyword(msg.keyword, msg.confidence || 0.8);
        // Hide empty placeholder
        if (keywordsEmptyEl) keywordsEmptyEl.style.display = 'none';
      }
    }

    if (msg.type === 'hint') {
      showHint(msg.hint, msg.hint_type);
    }

    if (msg.type === 'goal_update') {
      if (window.__RAC_Goals) {
        window.__RAC_Goals.updateGoal(msg.goalId, msg.addressed);
      }
    }

    if (msg.type === 'timer_update') {
      if (window.__RAC_Goals) {
        window.__RAC_Goals.updateTimer(msg.elapsedSec, msg.maxSec);
      }
    }

    if (msg.type === 'status') updateStatus(msg.status);
  }

  function ensureParagraph(speaker) {
    if (!currentParagraph) {
      currentParagraph = document.createElement('div');
      currentParagraph.className = 'rac-paragraph';

      const speakerId = speaker ? (speaker.id !== undefined ? speaker.id : speaker) : null;
      currentSpeaker = speakerId;

      // Add speaker class
      const spClass = getSpeakerClass(speaker);
      currentParagraph.classList.add(spClass);

      // Speaker label
      const name = getSpeakerName(speaker);
      if (name) {
        const label = document.createElement('span');
        label.className = 'rac-speaker-label';
        label.textContent = name;
        currentParagraph.appendChild(label);
      }

      // Text container
      const textSpan = document.createElement('span');
      textSpan.className = 'rac-para-text';
      currentParagraph.appendChild(textSpan);

      transcript.appendChild(currentParagraph);
      finalText = '';
      interimSpan = null;
    }
  }

  function showDebug(text) {
    const el = document.createElement('div');
    el.className = 'rac-debug';
    el.textContent = text;
    transcript.appendChild(el);
    scrollTranscript();
  }

  function scrollTranscript() {
    transcript.scrollTop = transcript.scrollHeight;
    const body = document.getElementById('rac-body');
    body.scrollTop = body.scrollHeight;
  }

  function updateStatus(status) {
    const dot = document.getElementById('rac-dot');
    if (status === 'listening') {
      dot.classList.add('on');
    } else {
      dot.classList.remove('on');
    }
  }

  // ── Listen for messages from background.js ──────────────
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      handleEvent(msg);
    });
  }

  // ── Mock mode: inline mock stream ───────────────────────
  if (isMockMode) {
    console.log('[RAC] Mock mode — starting inline mock stream');

    const mockEvents = [
      { type: 'status', status: 'listening', delay: 300 },
      { type: 'audio_level', level: 35, delay: 500 },

      { type: 'transcript_final', text: 'Расскажите про ваш опыт с React', speaker: { id: 0 }, speechFinal: true, delay: 1500 },
      { type: 'audio_level', level: 45, delay: 300 },

      { type: 'transcript_final', text: 'Я работал с React три года, делал SPA для финтеха', speaker: { id: 1 }, speechFinal: false, delay: 2000 },
      { type: 'keyword_detected', keyword: 'React', confidence: 0.95, delay: 100 },
      { type: 'keyword_detected', keyword: 'SPA', confidence: 0.82, delay: 200 },
      { type: 'keyword_detected', keyword: 'финтех', confidence: 0.80, delay: 200 },

      { type: 'transcript_final', text: 'В основном работал с хуками и контекстом', speaker: { id: 1 }, speechFinal: true, delay: 2000 },
      { type: 'hint', hint: '❓ Уточни, какую версию React — class components или hooks?', hint_type: 'llm', delay: 1500 },

      { type: 'transcript_final', text: 'Использовали hooks и TypeScript, strict mode', speaker: { id: 1 }, speechFinal: true, delay: 2500 },
      { type: 'keyword_detected', keyword: 'TypeScript', confidence: 0.92, delay: 100 },
      { type: 'keyword_detected', keyword: 'hooks', confidence: 0.88, delay: 200 },
      { type: 'goal_update', goalId: 'hard_react', addressed: true, delay: 500 },
      { type: 'hint', hint: '✅ React опыт подтверждён. Переходи к System Design', hint_type: 'goal_check', delay: 1000 },

      { type: 'transcript_final', text: 'А как вы подходите к архитектуре?', speaker: { id: 0 }, speechFinal: true, delay: 2500 },

      { type: 'transcript_final', text: 'Мы использовали микросервисы на Kubernetes', speaker: { id: 1 }, speechFinal: false, delay: 2000 },
      { type: 'keyword_detected', keyword: 'Kubernetes', confidence: 0.95, delay: 100 },
      { type: 'keyword_detected', keyword: 'микросервисы', confidence: 0.90, delay: 200 },

      { type: 'transcript_final', text: 'С Helm charts и ArgoCD для CI/CD', speaker: { id: 1 }, speechFinal: true, delay: 2000 },
      { type: 'keyword_detected', keyword: 'Helm', confidence: 0.85, delay: 100 },
      { type: 'keyword_detected', keyword: 'CI/CD', confidence: 0.88, delay: 200 },
      { type: 'hint', hint: '💡 Скажи: "Вы Helm charts используете или kustomize для K8s?"', hint_type: 'competence_phrase', delay: 1000 },
      { type: 'goal_update', goalId: 'hard_system_design', addressed: true, delay: 800 },

      { type: 'transcript_final', text: 'На фронте React с SSR через Next.js', speaker: { id: 1 }, speechFinal: true, delay: 2500 },
      { type: 'keyword_detected', keyword: 'Next.js', confidence: 0.90, delay: 100 },
      { type: 'keyword_detected', keyword: 'SSR', confidence: 0.85, delay: 200 },

      { type: 'transcript_final', text: 'Какие у вас ожидания по зарплате?', speaker: { id: 0 }, speechFinal: true, delay: 2000 },
      { type: 'transcript_final', text: 'От 300 тысяч, зависит от проекта и команды', speaker: { id: 1 }, speechFinal: true, delay: 2500 },
      { type: 'goal_update', goalId: 'checklist_salary', addressed: true, delay: 500 },

      { type: 'hint', hint: '⏰ 35 мин — пора завершать, осталась 1 тема', hint_type: 'time_warning', delay: 3000 },
      { type: 'audio_level', level: 10, delay: 1000 },
    ];

    let cumDelay = 0;
    const timers = [];
    function runMock() {
      mockEvents.forEach((evt) => {
        cumDelay += evt.delay;
        timers.push(setTimeout(() => {
          const e = Object.assign({}, evt);
          delete e.delay;
          handleEvent(e);
        }, cumDelay));
      });
      // Loop after all events
      timers.push(setTimeout(() => { cumDelay = 0; runMock(); }, cumDelay + 3000));
    }
    setTimeout(runMock, 500);
  }
})();
