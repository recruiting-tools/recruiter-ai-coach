// Mock Transcript Stream — generates realistic TranscriptEvent sequences for UI development
// Activate: URL param ?mock=true OR set window.__RAC_MOCK = true
// Part of Track 3 (UI/UX) — Recruiter AI Coach

(function () {
  'use strict';

  const mockEvents = [
    // --- Opening ---
    { type: 'status', status: 'listening', delay: 300 },
    { type: 'audio_level', level: 15, delay: 200 },
    { type: 'audio_level', level: 35, delay: 200 },

    // Recruiter asks about experience
    { type: 'transcript_interim', text: 'Расскажите про ваш', delay: 600 },
    { type: 'transcript_final', text: 'Расскажите про ваш опыт с React', speaker: { id: 0, confidence: 0.9 }, speechFinal: true, delay: 1200 },
    { type: 'audio_level', level: 45, delay: 300 },

    // Candidate responds
    { type: 'transcript_interim', text: 'Я работал с React три', delay: 800 },
    { type: 'transcript_final', text: 'Я работал с React три года, делал SPA для финтеха', speaker: { id: 1, confidence: 0.85 }, speechFinal: false, delay: 1500 },
    { type: 'keyword_detected', keyword: 'React', confidence: 0.95, delay: 100 },
    { type: 'keyword_detected', keyword: 'SPA', confidence: 0.82, delay: 150 },
    { type: 'keyword_detected', keyword: 'финтех', confidence: 0.80, delay: 200 },

    // Candidate continues
    { type: 'transcript_final', text: 'В основном работал с хуками и контекстом', speaker: { id: 1, confidence: 0.88 }, speechFinal: true, delay: 2000 },
    { type: 'audio_level', level: 52, delay: 200 },

    // LLM hint arrives
    { type: 'hint', hint: '\u2753 \u0423\u0442\u043e\u0447\u043d\u0438, \u043a\u0430\u043a\u0443\u044e \u0432\u0435\u0440\u0441\u0438\u044e React \u2014 class components \u0438\u043b\u0438 hooks?', hint_type: 'llm', delay: 1500 },

    // Candidate mentions TypeScript
    { type: 'transcript_final', text: '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0438 hooks \u0438 TypeScript, strict mode', speaker: { id: 1, confidence: 0.9 }, speechFinal: true, delay: 2500 },
    { type: 'keyword_detected', keyword: 'TypeScript', confidence: 0.92, delay: 100 },
    { type: 'keyword_detected', keyword: 'hooks', confidence: 0.88, delay: 200 },

    // Goal auto-checked
    { type: 'goal_update', goalId: 'hard_react', addressed: true, delay: 500 },
    { type: 'hint', hint: '\u2705 React \u043e\u043f\u044b\u0442 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d. \u041f\u0435\u0440\u0435\u0445\u043e\u0434\u0438 \u043a System Design', hint_type: 'goal_check', delay: 1000 },

    // Recruiter asks about architecture
    { type: 'audio_level', level: 38, delay: 400 },
    { type: 'transcript_final', text: '\u0410 \u043a\u0430\u043a \u0432\u044b \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442\u0435 \u043a \u0430\u0440\u0445\u0438\u0442\u0435\u043a\u0442\u0443\u0440\u0435?', speaker: { id: 0, confidence: 0.9 }, speechFinal: true, delay: 2500 },

    // Candidate talks K8s
    { type: 'transcript_interim', text: '\u041c\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0438', delay: 700 },
    { type: 'transcript_final', text: '\u041c\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0438 \u043c\u0438\u043a\u0440\u043e\u0441\u0435\u0440\u0432\u0438\u0441\u044b \u043d\u0430 Kubernetes', speaker: { id: 1, confidence: 0.85 }, speechFinal: false, delay: 1800 },
    { type: 'keyword_detected', keyword: 'Kubernetes', confidence: 0.95, delay: 100 },
    { type: 'keyword_detected', keyword: '\u043c\u0438\u043a\u0440\u043e\u0441\u0435\u0440\u0432\u0438\u0441\u044b', confidence: 0.90, delay: 200 },

    { type: 'transcript_final', text: '\u0421 Helm charts \u0438 ArgoCD \u0434\u043b\u044f CI/CD', speaker: { id: 1, confidence: 0.87 }, speechFinal: true, delay: 2000 },
    { type: 'keyword_detected', keyword: 'Helm', confidence: 0.85, delay: 100 },
    { type: 'keyword_detected', keyword: 'CI/CD', confidence: 0.88, delay: 200 },

    // Competence phrase hint
    { type: 'hint', hint: '\ud83d\udca1 \u0421\u043a\u0430\u0436\u0438: "\u0412\u044b Helm charts \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0435 \u0438\u043b\u0438 kustomize \u0434\u043b\u044f K8s?"', hint_type: 'competence_phrase', delay: 1000 },

    // System design goal
    { type: 'goal_update', goalId: 'hard_system_design', addressed: true, delay: 800 },

    // React mentioned again (count should increase)
    { type: 'transcript_final', text: '\u041d\u0430 \u0444\u0440\u043e\u043d\u0442\u0435 React \u0441 SSR \u0447\u0435\u0440\u0435\u0437 Next.js', speaker: { id: 1, confidence: 0.9 }, speechFinal: true, delay: 2500 },
    { type: 'keyword_detected', keyword: 'React', confidence: 0.93, delay: 100 },
    { type: 'keyword_detected', keyword: 'Next.js', confidence: 0.90, delay: 200 },
    { type: 'keyword_detected', keyword: 'SSR', confidence: 0.85, delay: 150 },

    // Salary question
    { type: 'audio_level', level: 30, delay: 500 },
    { type: 'transcript_final', text: '\u041a\u0430\u043a\u0438\u0435 \u0443 \u0432\u0430\u0441 \u043e\u0436\u0438\u0434\u0430\u043d\u0438\u044f \u043f\u043e \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0435?', speaker: { id: 0, confidence: 0.92 }, speechFinal: true, delay: 2000 },
    { type: 'transcript_final', text: '\u041e\u0442 300 \u0442\u044b\u0441\u044f\u0447, \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043e\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u044b', speaker: { id: 1, confidence: 0.88 }, speechFinal: true, delay: 2500 },
    { type: 'goal_update', goalId: 'checklist_salary', addressed: true, delay: 500 },

    // Time warning
    { type: 'hint', hint: '\u23f0 35 \u043c\u0438\u043d \u2014 \u043f\u043e\u0440\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0442\u044c, \u043e\u0441\u0442\u0430\u043b\u043e\u0441\u044c 1 \u0442\u0435\u043c\u0430', hint_type: 'time_warning', delay: 3000 },

    // Final
    { type: 'audio_level', level: 10, delay: 1000 },
  ];

  let timers = [];
  let running = false;

  /**
   * Start sending mock events to the callback with realistic delays
   * @param {Function} callback — receives TranscriptEvent objects
   * @param {Object} [options]
   * @param {number} [options.speedMultiplier=1] — speed up/slow down (0.5 = 2x faster)
   * @param {boolean} [options.loop=false] — restart when done
   */
  function startMockStream(callback, options) {
    if (running) stopMockStream();
    running = true;

    const speed = (options && options.speedMultiplier) || 1;
    const loop = (options && options.loop) || false;

    let cumulativeDelay = 0;

    mockEvents.forEach((evt) => {
      cumulativeDelay += evt.delay * speed;

      const t = setTimeout(() => {
        if (!running) return;
        // Clone event without delay field
        const event = Object.assign({}, evt);
        delete event.delay;
        callback(event);
      }, cumulativeDelay);

      timers.push(t);
    });

    // Optional loop
    if (loop) {
      const loopTimer = setTimeout(() => {
        if (running) startMockStream(callback, options);
      }, cumulativeDelay + 2000 * speed);
      timers.push(loopTimer);
    }

    // Start timer for goals timer simulation
    _startTimerSimulation(callback, speed);
  }

  /**
   * Stop all mock events
   */
  function stopMockStream() {
    running = false;
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  /**
   * Simulate timer updates (elapsed time incrementing)
   */
  function _startTimerSimulation(callback, speed) {
    let elapsed = 0;
    const maxSec = 45 * 60; // 45 minutes

    const interval = setInterval(() => {
      if (!running) {
        clearInterval(interval);
        return;
      }
      // Each real second = 60 simulated seconds for demo
      elapsed += 60;
      if (elapsed > maxSec) elapsed = maxSec;

      callback({ type: 'timer_update', elapsedSec: elapsed, maxSec: maxSec });
    }, 1000 * speed);

    timers.push(interval);
  }

  // Export
  window.__RAC_MockStream = { startMockStream, stopMockStream };
})();
