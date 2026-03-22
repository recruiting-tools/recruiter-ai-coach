// Goals Checklist Renderer — extracted module for goals tracking
// Part of Track 3 (UI/UX) — Recruiter AI Coach

(function () {
  'use strict';

  const goals = new Map(); // goalId → { id, label, type, checked, autoChecked, element }
  let container = null;
  let timerEl = null;
  let onGoalToggle = null; // callback(goalId, checked)

  /**
   * Initialize the goals checklist renderer
   * @param {HTMLElement} parentEl — container to render goals into
   * @param {HTMLElement} timerElement — element for timer display
   * @param {Function} [toggleCallback] — called when goal is manually toggled
   */
  function init(parentEl, timerElement, toggleCallback) {
    container = parentEl;
    timerEl = timerElement;
    onGoalToggle = toggleCallback || null;
  }

  /**
   * Set the full goals list (replaces existing)
   * @param {Array<{id: string, label: string, type: string, checked?: boolean}>} goalsList
   */
  function setGoals(goalsList) {
    goals.clear();
    if (container) container.innerHTML = '';

    goalsList.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'rac-goal-row';
      row.dataset.goalId = g.id;

      const checkbox = document.createElement('span');
      checkbox.className = 'rac-goal-check';
      checkbox.textContent = g.checked ? '\u2611' : '\u2610';

      const label = document.createElement('span');
      label.className = 'rac-goal-label';
      label.textContent = g.label;

      row.appendChild(checkbox);
      row.appendChild(label);

      row.addEventListener('click', () => {
        _handleToggle(g.id);
      });

      if (container) container.appendChild(row);

      goals.set(g.id, {
        id: g.id,
        label: g.label,
        type: g.type,
        checked: !!g.checked,
        autoChecked: false,
        element: row,
        checkEl: checkbox,
        labelEl: label,
      });

      if (g.checked) {
        row.classList.add('rac-goal-done');
      }
    });
  }

  /**
   * Update a goal (from system/auto)
   * @param {string} goalId
   * @param {boolean} addressed
   */
  function updateGoal(goalId, addressed) {
    const entry = goals.get(goalId);
    if (!entry) return;

    entry.checked = addressed;
    entry.autoChecked = addressed;
    _renderGoalState(entry);

    // Flash animation for auto-check
    if (addressed) {
      entry.element.classList.add('rac-goal-auto-flash');
      setTimeout(() => entry.element.classList.remove('rac-goal-auto-flash'), 1500);
    }
  }

  /**
   * Manual toggle by click
   */
  function toggleGoal(goalId) {
    _handleToggle(goalId);
  }

  function _handleToggle(goalId) {
    const entry = goals.get(goalId);
    if (!entry) return;

    entry.checked = !entry.checked;
    if (!entry.checked) entry.autoChecked = false; // unchecking removes auto state
    _renderGoalState(entry);

    if (onGoalToggle) onGoalToggle(goalId, entry.checked);
  }

  function _renderGoalState(entry) {
    entry.checkEl.textContent = entry.checked ? '\u2611' : '\u2610';

    entry.element.classList.toggle('rac-goal-done', entry.checked);
    entry.element.classList.toggle('rac-goal-auto', entry.autoChecked);
  }

  /**
   * Get current goals state
   * @returns {Array<{id: string, label: string, type: string, checked: boolean, autoChecked: boolean}>}
   */
  function getGoals() {
    return Array.from(goals.values()).map((e) => ({
      id: e.id,
      label: e.label,
      type: e.type,
      checked: e.checked,
      autoChecked: e.autoChecked,
    }));
  }

  /**
   * Update timer display
   * @param {number} elapsedSec
   * @param {number} maxSec
   */
  function updateTimer(elapsedSec, maxSec) {
    if (!timerEl) return;
    const elMin = Math.floor(elapsedSec / 60);
    const maxMin = Math.floor(maxSec / 60);
    timerEl.textContent = `\u23f1 ${elMin} \u043c\u0438\u043d / ${maxMin} \u043c\u0438\u043d`;

    // Warning color when close to limit
    const ratio = elapsedSec / maxSec;
    if (ratio >= 1) {
      timerEl.style.color = '#ef4444';
    } else if (ratio >= 0.78) {
      timerEl.style.color = '#f59e0b';
    } else {
      timerEl.style.color = '#888';
    }
  }

  // Export to window for content.js access
  window.__RAC_Goals = { init, setGoals, updateGoal, toggleGoal, getGoals, updateTimer };
})();
