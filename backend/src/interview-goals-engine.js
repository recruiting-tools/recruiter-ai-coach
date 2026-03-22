/**
 * interview-goals-engine.js — Rule-based goals evaluation engine
 *
 * evaluateGoals(goals, recentSegments, elapsedSec) → GoalHint[] | null
 *
 * Pure function: takes goals config + transcript segments + elapsed time,
 * returns array of actionable hints or null.
 *
 * Goal types:
 *   hard_skills       — check if topics from config.topics were discussed
 *   soft_skills       — check for behavioral question patterns (STAR)
 *   competitor_research — detect competitor names in segments
 *   time_saving       — timer-based warnings
 *   overemployment    — detect parallel employment mentions
 *   show_competence   — generate smart follow-up phrases for tech mentions
 *   checklist         — simple items tracking
 */

// ── Pattern dictionaries ──────────────────────────────────────────────

const SOFT_SKILLS_PATTERNS = [
  /расскажите?\s+о\s+ситуации/i,
  /приведите?\s+пример/i,
  /как\s+(вы|ты)\s+поступил/i,
  /опишите?\s+случай/i,
  /был\s+ли\s+у\s+(вас|тебя)\s+опыт/i,
  /расскажите?\s+про\s+конфликт/i,
  /как\s+(вы|ты)\s+(справились|справился|решили|решил|преодолели|преодолел|решал)/i,
  /расскажите?\s+про\s+сложн/i,
  /расскажи.{0,20}(ситуаци|конфликт|сложн|проблем)/i,
  /как\s+(вы|ты)\s+(решали?|справлял)/i,
  /what\s+would\s+you\s+do/i,
  /tell\s+me\s+about\s+a\s+time/i,
  /give\s+me\s+an?\s+example/i,
  /describe\s+a\s+situation/i,
  /how\s+did\s+you\s+(handle|deal|manage)/i,
];

const OVEREMPLOYMENT_PATTERNS = [
  /сейчас\s+работаю\s+в/i,
  /параллельно/i,
  /другой\s+проект/i,
  /фриланс/i,
  /подработк/i,
  /совмеща[юе]/i,
  /на\s+стороне/i,
  /second\s+job/i,
  /freelanc/i,
  /side\s+(project|gig|hustle)/i,
  /moonlight/i,
  /currently\s+work(ing)?\s+(at|for|with)\s+\w/i,
];

// Tech terms → smart follow-up phrases for show_competence
const COMPETENCE_PHRASES = {
  kubernetes: 'Вы Helm charts используете или kustomize для манифестов?',
  k8s: 'Вы Helm charts используете или kustomize для манифестов?',
  docker: 'Multi-stage build используете для оптимизации образов?',
  react: 'Вы на хуках пишете или ещё есть class components в проекте?',
  vue: 'Composition API или Options API предпочитаете?',
  angular: 'На standalone components уже перешли или ещё NgModules?',
  typescript: 'Как у вас с generic типами — активно используете utility types?',
  python: 'Type hints используете? mypy или pyright для проверки?',
  golang: 'Горутины с каналами или больше sync.WaitGroup паттерн?',
  go: 'Горутины с каналами или больше sync.WaitGroup паттерн?',
  postgresql: 'Как у вас с индексами — используете partial indexes или GIN?',
  postgres: 'Как у вас с индексами — используете partial indexes или GIN?',
  mongodb: 'Агрегации через pipeline делаете или больше на стороне приложения?',
  redis: 'Для кеша используете или как message broker тоже?',
  graphql: 'DataLoader используете для решения N+1?',
  rest: 'Версионирование API как делаете — через URL или заголовки?',
  api: 'REST или GraphQL предпочитаете и почему?',
  microservices: 'Как у вас с service discovery — Consul, Eureka?',
  'микросервис': 'Как у вас с service discovery — Consul, Eureka, или через K8s DNS?',
  aws: 'Какие сервисы чаще всего используете — ECS, Lambda, EKS?',
  terraform: 'State management как организован — remote backend в S3?',
  ci: 'Какой CI используете — GitHub Actions, GitLab CI, Jenkins?',
  'ci/cd': 'Какой CI используете — GitHub Actions, GitLab CI, Jenkins?',
  jenkins: 'Declarative pipeline или scripted предпочитаете?',
  elasticsearch: 'Как индексы организованы — по времени ротируете?',
  kafka: 'Как с партиционированием — по ключу или round-robin?',
  rabbitmq: 'Dead letter queue настроен для обработки ошибок?',
  webpack: 'Уже мигрировали на Vite или пока на Webpack?',
  nextjs: 'App Router используете или ещё Pages Router?',
  'next.js': 'App Router используете или ещё Pages Router?',
  node: 'Какую версию используете — уже на 20 LTS?',
  'node.js': 'Какую версию используете — уже на 20 LTS?',
  java: 'На какой версии — используете records и sealed classes?',
  spring: 'Spring Boot 3 с виртуальными потоками уже пробовали?',
  agile: 'Scrum или Kanban — какой формат спринтов?',
  scrum: 'Какая длина спринтов? Ретро регулярно проводите?',
  git: 'Какую стратегию бранчинга используете — GitFlow, trunk-based?',
  linux: 'С systemd работаете или контейнеризация полностью?',
  nginx: 'Как load balancing настроен — round-robin или least connections?',
  redux: 'Redux Toolkit используете или классический Redux с actions/reducers?',
  mobx: 'MobX с декораторами или makeAutoObservable?',
  testing: 'Unit тесты или больше интеграционные? Какой coverage?',
  jest: 'Snapshot тесты используете или только unit?',
  cypress: 'E2E тесты в CI гоняете или только локально?',
};

// ── Time formatting helper ────────────────────────────────────────────

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m} мин ${s} сек` : `${m} мин`;
}

// ── Segment text helpers ──────────────────────────────────────────────

function allText(segments) {
  return segments.map((s) => s.text).join(' ');
}

function candidateText(segments) {
  return segments
    .filter((s) => s.speaker === 'candidate' || s.speaker === 'Кандидат')
    .map((s) => s.text)
    .join(' ');
}

function recruiterText(segments) {
  return segments
    .filter((s) => s.speaker === 'recruiter' || s.speaker === 'Рекрутер')
    .map((s) => s.text)
    .join(' ');
}

function lastCandidateSegment(segments) {
  for (let i = segments.length - 1; i >= 0; i--) {
    const sp = segments[i].speaker;
    if (sp === 'candidate' || sp === 'Кандидат') return segments[i];
  }
  return null;
}

// ── Topic matching ────────────────────────────────────────────────────

function topicMentioned(text, topic) {
  // Case-insensitive match. For Russian words, strip common inflectional
  // endings so "зарплата" matches "зарплате", "удалёнка" matches "удалёнку", etc.
  const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // First try exact substring match
  const exactRe = new RegExp(escaped, 'i');
  if (exactRe.test(text)) return true;

  // For words with Cyrillic characters, try stem-based matching:
  // strip last 1-2 chars (common Russian endings: а/у/е/ы/и/ой/ом/ей...)
  if (/[а-яёА-ЯЁ]/.test(topic) && topic.length >= 4) {
    const stem = topic.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stemRe = new RegExp(stem, 'i');
    return stemRe.test(text);
  }

  return false;
}

// ── Individual goal evaluators ────────────────────────────────────────

function evaluateHardSkills(goal, segments, elapsedSec) {
  const hints = [];
  const topics = goal.config?.topics || [];
  const full = allText(segments);
  const nudgeAfterSec = (goal.config?.nudge_after_min || 10) * 60;

  for (const topic of topics) {
    const mentioned = topicMentioned(full, topic);
    if (mentioned) {
      // Auto-address: topic was discussed
      if (!goal._addressedTopics) goal._addressedTopics = new Set();
      goal._addressedTopics.add(topic.toLowerCase());
      continue;
    }
    if (elapsedSec >= nudgeAfterSec) {
      hints.push({
        type: 'goal_check',
        goalId: goal.id,
        hint: `Ещё не обсудили ${topic} — ${formatTime(elapsedSec)} прошло`,
        priority: elapsedSec >= nudgeAfterSec * 1.5 ? 'high' : 'medium',
      });
    }
  }

  // Check if all topics addressed → mark goal as addressed
  if (topics.length > 0) {
    const addressedCount = goal._addressedTopics ? goal._addressedTopics.size : 0;
    if (addressedCount >= topics.length && !goal.addressed) {
      goal.addressed = true;
      goal.addressed_at = Date.now();
    }
  }

  return hints;
}

function evaluateSoftSkills(goal, segments, _elapsedSec) {
  const hints = [];
  const rText = recruiterText(segments);
  const style = goal.config?.style || 'STAR';

  let hasPatternMatch = false;
  for (const pattern of SOFT_SKILLS_PATTERNS) {
    if (pattern.test(rText)) {
      hasPatternMatch = true;
      break;
    }
  }

  if (!hasPatternMatch) {
    const styleLabel =
      style === 'STAR' ? 'STAR-формат' : style === 'behavioral' ? 'поведенческие' : 'ситуационные';
    hints.push({
      type: 'goal_check',
      goalId: goal.id,
      hint: `Пока не задали ${styleLabel} вопросы. Попросите привести конкретный пример ситуации`,
      priority: 'medium',
    });
  } else if (!goal.addressed) {
    goal.addressed = true;
    goal.addressed_at = Date.now();
  }

  return hints;
}

function evaluateCompetitorResearch(goal, segments, _elapsedSec) {
  const hints = [];
  const competitors = goal.config?.competitors || [];
  const cText = candidateText(segments);

  for (const comp of competitors) {
    if (topicMentioned(cText, comp)) {
      hints.push({
        type: 'competitor_alert',
        goalId: goal.id,
        hint: `Кандидат упомянул "${comp}" — спросите про масштаб команды и причину ухода`,
        priority: 'high',
      });
      if (!goal.addressed) {
        goal.addressed = true;
        goal.addressed_at = Date.now();
      }
    }
  }

  return hints;
}

function evaluateTimeSaving(goal, _segments, elapsedSec) {
  const hints = [];
  const warnMin = goal.config?.warn_at_min ?? goal.config?.warn_min ?? 35;
  const maxMin = goal.config?.max_min ?? 45;
  const warnSec = warnMin * 60;
  const maxSec = maxMin * 60;

  if (elapsedSec >= maxSec) {
    hints.push({
      type: 'time_warning',
      goalId: goal.id,
      hint: `${maxMin} мин — пора завершать! Скажите: "Давайте подведём итоги, у вас есть вопросы к нам?"`,
      priority: 'high',
    });
  } else if (elapsedSec >= warnSec) {
    const remaining = maxMin - Math.floor(elapsedSec / 60);
    hints.push({
      type: 'time_warning',
      goalId: goal.id,
      hint: `${formatTime(elapsedSec)} — осталось ~${remaining} мин. Проверьте, все ли темы обсудили`,
      priority: 'medium',
    });
  }

  return hints;
}

function evaluateOveremployment(goal, segments, _elapsedSec) {
  const hints = [];
  const cText = candidateText(segments);

  for (const pattern of OVEREMPLOYMENT_PATTERNS) {
    if (pattern.test(cText)) {
      hints.push({
        type: 'goal_check',
        goalId: goal.id,
        hint: 'Кандидат упомянул параллельную работу/проект — уточните текущую занятость',
        priority: 'high',
      });
      if (!goal.addressed) {
        goal.addressed = true;
        goal.addressed_at = Date.now();
      }
      break; // One alert is enough
    }
  }

  return hints;
}

function evaluateShowCompetence(goal, segments, _elapsedSec) {
  const hints = [];
  const lastCandidate = lastCandidateSegment(segments);
  if (!lastCandidate) return hints;

  const text = lastCandidate.text.toLowerCase();
  const configTopics = goal.config?.topics || [];

  // Check config topics first, then fall back to built-in dictionary
  const termsToCheck =
    configTopics.length > 0
      ? configTopics
      : Object.keys(COMPETENCE_PHRASES);

  for (const term of termsToCheck) {
    const lowerTerm = term.toLowerCase();
    if (text.includes(lowerTerm)) {
      // Look up in built-in phrases or generate generic
      const phrase =
        COMPETENCE_PHRASES[lowerTerm] ||
        `Уточните у кандидата детали про ${term} — покажет вашу компетентность`;

      hints.push({
        type: 'competence_phrase',
        goalId: goal.id,
        hint: `Скажи: "${phrase}"`,
        priority: 'low',
      });
      break; // One competence phrase per evaluation cycle
    }
  }

  return hints;
}

function evaluateChecklist(goal, segments, _elapsedSec) {
  const hints = [];
  const items = goal.config?.items || [];
  const full = allText(segments);

  const unchecked = [];
  for (const item of items) {
    if (topicMentioned(full, item)) {
      if (!goal._checkedItems) goal._checkedItems = new Set();
      goal._checkedItems.add(item);
    } else {
      unchecked.push(item);
    }
  }

  // Mark goal addressed if all items checked
  if (items.length > 0 && unchecked.length === 0 && !goal.addressed) {
    goal.addressed = true;
    goal.addressed_at = Date.now();
  }

  if (unchecked.length > 0) {
    hints.push({
      type: 'goal_check',
      goalId: goal.id,
      hint: `Не обсудили: ${unchecked.join(', ')}`,
      priority: unchecked.length >= 3 ? 'medium' : 'low',
    });
  }

  return hints;
}

// ── Evaluator dispatch ────────────────────────────────────────────────

const EVALUATORS = {
  hard_skills: evaluateHardSkills,
  soft_skills: evaluateSoftSkills,
  competitor_research: evaluateCompetitorResearch,
  time_saving: evaluateTimeSaving,
  time_management: evaluateTimeSaving, // alias used by presets
  overemployment: evaluateOveremployment,
  show_competence: evaluateShowCompetence,
  checklist: evaluateChecklist,
};

// ── Main entry point ──────────────────────────────────────────────────

/**
 * Evaluate all enabled goals against recent transcript segments.
 *
 * @param {Goal[]} goals - Array of goal objects from InterviewConfig
 * @param {Array<{speaker: string, text: string}>} recentSegments - Recent transcript lines
 * @param {number} elapsedSec - Seconds since interview started
 * @returns {GoalHint[] | null} - Array of hints, or null if none
 */
function evaluateGoals(goals, recentSegments, elapsedSec) {
  if (!goals || goals.length === 0) return null;
  if (!recentSegments || recentSegments.length === 0) return null;

  const allHints = [];

  for (const goal of goals) {
    if (!goal.enabled) continue;
    // Skip already manually addressed goals (but allow auto re-evaluation)
    // Note: some goals like time_saving should always evaluate

    const evaluator = EVALUATORS[goal.type];
    if (!evaluator) {
      console.warn(`[GoalsEngine] Unknown goal type: ${goal.type}`);
      continue;
    }

    const hints = evaluator(goal, recentSegments, elapsedSec);
    allHints.push(...hints);
  }

  return allHints.length > 0 ? allHints : null;
}

/**
 * Get summary of goal states — which are addressed and which are pending.
 *
 * @param {Goal[]} goals - Array of goal objects
 * @returns {{ addressed: string[], pending: string[] }}
 */
function getGoalsSummary(goals) {
  const addressed = [];
  const pending = [];

  for (const goal of goals) {
    if (!goal.enabled) continue;
    const label = `${goal.type}:${goal.id}`;
    if (goal.addressed) {
      addressed.push(label);
    } else {
      pending.push(label);
    }
  }

  return { addressed, pending };
}

module.exports = {
  evaluateGoals,
  getGoalsSummary,
  // Exported for testing
  COMPETENCE_PHRASES,
  SOFT_SKILLS_PATTERNS,
  OVEREMPLOYMENT_PATTERNS,
};
