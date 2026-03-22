// Keyword Chips Renderer — extracted module for keyword tag rendering
// Part of Track 3 (UI/UX) — Recruiter AI Coach

(function () {
  'use strict';

  const keywords = new Map(); // keyword → { count, firstSeen, confidence, element }
  let container = null;
  let onKeywordClick = null; // callback(keyword) — for future "explain" feature

  /**
   * Initialize the keyword chips renderer
   * @param {HTMLElement} parentEl — container to render chips into
   * @param {Function} [clickCallback] — called when a chip is clicked
   */
  function init(parentEl, clickCallback) {
    container = parentEl;
    onKeywordClick = clickCallback || null;
  }

  /**
   * Add or update a keyword chip
   * @param {string} keyword
   * @param {number} confidence — 0..1
   */
  function addKeyword(keyword, confidence) {
    const key = keyword.toLowerCase();

    if (keywords.has(key)) {
      // Update existing
      const entry = keywords.get(key);
      entry.count++;
      entry.confidence = Math.max(entry.confidence, confidence);
      _updateChipText(entry);
      // Re-highlight briefly
      entry.element.classList.add('rac-kw-pulse');
      setTimeout(() => entry.element.classList.remove('rac-kw-pulse'), 600);
      return;
    }

    // Create new chip
    const chip = document.createElement('span');
    chip.className = 'rac-kw-chip rac-kw-new';
    chip.dataset.keyword = key;
    chip.textContent = keyword;
    chip.title = `Confidence: ${(confidence * 100).toFixed(0)}%`;

    chip.addEventListener('click', () => {
      if (onKeywordClick) onKeywordClick(keyword);
    });

    if (container) container.appendChild(chip);

    const entry = {
      keyword,
      count: 1,
      firstSeen: Date.now(),
      confidence,
      element: chip,
    };
    keywords.set(key, entry);

    // Remove "new" highlight after 3 seconds
    setTimeout(() => {
      chip.classList.remove('rac-kw-new');
    }, 3000);
  }

  /**
   * Update chip text to show count
   */
  function _updateChipText(entry) {
    if (entry.count > 1) {
      entry.element.textContent = `${entry.keyword} \u00d7${entry.count}`;
    }
  }

  /**
   * Get current keywords list
   * @returns {Array<{keyword: string, count: number, confidence: number, firstSeen: number}>}
   */
  function getKeywords() {
    return Array.from(keywords.values()).map((e) => ({
      keyword: e.keyword,
      count: e.count,
      confidence: e.confidence,
      firstSeen: e.firstSeen,
    }));
  }

  /**
   * Clear all keywords
   */
  function clear() {
    keywords.clear();
    if (container) container.innerHTML = '';
  }

  // Export to window for content.js access
  window.__RAC_Keywords = { init, addKeyword, getKeywords, clear };
})();
