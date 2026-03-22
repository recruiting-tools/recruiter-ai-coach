#!/usr/bin/env node
/**
 * simulate-interview-with-goals.js
 *
 * Mock test that runs a sample interview dialogue through the goals engine
 * and goals-aware LLM hints. Works standalone without database.
 *
 * Usage: node scripts/simulate-interview-with-goals.js
 *
 * What it does:
 * 1. Defines a set of goals (hard_skills, time_saving, show_competence, etc.)
 * 2. Runs a 10-line dialogue (mix of recruiter and candidate)
 * 3. After each line: calls evaluateGoals() and prints any goal hints
 * 4. After each candidate line: calls generateGoalsAwareHint() and prints LLM hints
 * 5. Shows which goals got auto-addressed at the end
 */

const path = require('path');
const backendDir = path.join(__dirname, '../backend');

// Load .env from project root
require(`${backendDir}/node_modules/dotenv`).config({ path: path.join(__dirname, '../.env') });

const { evaluateGoals, getGoalsSummary } = require(`${backendDir}/src/interview-goals-engine`);
const { generateGoalsAwareHint, addToContext, clearSession } = require(`${backendDir}/src/claude`);

// ── Colors for terminal output ────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

function log(color, prefix, text) {
  console.log(`${color}${prefix}${C.reset} ${text}`);
}

// ── Mock goals ────────────────────────────────────────────────────────

const goals = [
  {
    id: 'hard_react',
    type: 'hard_skills',
    enabled: true,
    depth: 'deep',
    config: {
      topics: ['React', 'TypeScript', 'Node.js'],
      nudge_after_min: 5, // lowered for demo (normally 10)
    },
    addressed: false,
  },
  {
    id: 'soft_star',
    type: 'soft_skills',
    enabled: true,
    config: { style: 'STAR' },
    addressed: false,
  },
  {
    id: 'time_45',
    type: 'time_saving',
    enabled: true,
    config: { max_min: 45, warn_min: 35 },
    addressed: false,
  },
  {
    id: 'competence_tech',
    type: 'show_competence',
    enabled: true,
    config: {
      topics: ['React', 'TypeScript', 'kubernetes', 'Docker', 'CI/CD', 'Node.js'],
    },
    addressed: false,
  },
  {
    id: 'competitor_watch',
    type: 'competitor_research',
    enabled: true,
    config: { competitors: ['Яндекс', 'VK', 'Ozon', 'Сбер'] },
    addressed: false,
  },
  {
    id: 'overemploy_check',
    type: 'overemployment',
    enabled: true,
    config: {},
    addressed: false,
  },
  {
    id: 'checklist_basic',
    type: 'checklist',
    enabled: true,
    config: {
      items: ['зарплата', 'удалёнка', 'английский'],
    },
    addressed: false,
  },
];

// ── Mock dialogue ─────────────────────────────────────────────────────
// Each line has a simulated elapsed time to test time-based goals

const dialogue = [
  {
    speaker: 'recruiter',
    text: 'Привет! Расскажи о себе и своём опыте',
    elapsedMin: 1,
  },
  {
    speaker: 'candidate',
    text: 'Привет! Я фронтенд-разработчик, 5 лет опыта. Последние 3 года работаю с React, до этого был Vue.',
    elapsedMin: 2,
  },
  {
    speaker: 'recruiter',
    text: 'Какие проекты делал на React?',
    elapsedMin: 4,
  },
  {
    speaker: 'candidate',
    text: 'Делал SPA для финтеха, там был Redux, потом перешли на React Query. Также настраивал CI/CD через GitHub Actions.',
    elapsedMin: 6,
  },
  {
    speaker: 'recruiter',
    text: 'А как с TypeScript?',
    elapsedMin: 8,
  },
  {
    speaker: 'candidate',
    text: 'TypeScript использую везде, generic типы, utility types, строгий режим. Ещё я параллельно фриланс делаю — небольшие проекты на Node.js.',
    elapsedMin: 10,
  },
  {
    speaker: 'recruiter',
    text: 'Расскажи, как ты решал конфликтные ситуации в команде?',
    elapsedMin: 15,
  },
  {
    speaker: 'candidate',
    text: 'Был случай — мы спорили об архитектуре с тимлидом. Я предложил сделать прототип обоих вариантов. В итоге мой подход оказался быстрее. До Яндекса работал в стартапе, там всё решали голосованием.',
    elapsedMin: 20,
  },
  {
    speaker: 'recruiter',
    text: 'Какие у тебя ожидания по зарплате и формату работы?',
    elapsedMin: 35,
  },
  {
    speaker: 'candidate',
    text: 'Хочу от 400 тысяч, предпочитаю удалёнку. Английский B2, могу на звонках общаться.',
    elapsedMin: 37,
  },
];

// ── Simulation runner ─────────────────────────────────────────────────

async function runSimulation() {
  const SESSION_ID = 'sim-goals-test';
  clearSession(SESSION_ID);

  console.log(`\n${C.bold}${C.cyan}========================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  Interview Goals Simulation${C.reset}`);
  console.log(`${C.bold}${C.cyan}========================================${C.reset}\n`);

  // Print active goals
  console.log(`${C.bold}Active goals:${C.reset}`);
  for (const g of goals) {
    if (g.enabled) {
      const topics = g.config?.topics?.join(', ') || g.config?.items?.join(', ') || g.config?.competitors?.join(', ') || '';
      console.log(`  ${C.dim}-${C.reset} ${C.bold}${g.type}${C.reset} (${g.id})${topics ? ': ' + topics : ''}`);
    }
  }
  console.log('');

  const hasApiKey = !!process.env.OPENAI_API_KEY;
  if (!hasApiKey) {
    log(C.yellow, '[WARN]', 'OPENAI_API_KEY not set — LLM hints will be skipped. Only goals engine will run.');
    console.log('');
  }

  const allSegments = []; // accumulate for goals engine

  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];
    const elapsedSec = line.elapsedMin * 60;

    // Add to accumulated segments
    allSegments.push({ speaker: line.speaker, text: line.text });

    // Display the line
    const speakerColor = line.speaker === 'recruiter' ? C.blue : C.green;
    const speakerLabel = line.speaker === 'recruiter' ? 'Recruiter' : 'Candidate';
    const timeLabel = `[${line.elapsedMin} min]`;

    console.log(`${C.dim}${timeLabel}${C.reset} ${speakerColor}${C.bold}${speakerLabel}:${C.reset} ${line.text}`);

    // ── Run goals engine after every line ──
    const goalHints = evaluateGoals(goals, allSegments, elapsedSec);
    if (goalHints) {
      for (const gh of goalHints) {
        const priorityColor =
          gh.priority === 'high' ? C.red : gh.priority === 'medium' ? C.yellow : C.dim;
        const typeLabel = gh.type.toUpperCase().replace('_', ' ');
        log(priorityColor, `       [${typeLabel}]`, gh.hint);
      }
    }

    // ── Run LLM goals-aware hint after candidate lines ──
    if (line.speaker === 'candidate' && hasApiKey) {
      try {
        // Add context for LLM
        addToContext(SESSION_ID, { speaker: line.speaker, text: line.text });

        const llmHint = await generateGoalsAwareHint(
          SESSION_ID,
          { speaker: line.speaker, text: line.text },
          goals,
          { noThrottle: true }
        );
        if (llmHint) {
          log(C.magenta, '       [LLM HINT]', llmHint);
        }
      } catch (err) {
        log(C.red, '       [LLM ERROR]', err.message);
      }
    }

    console.log(''); // blank line between dialogue turns
  }

  // ── Summary ──
  console.log(`${C.bold}${C.cyan}========================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  Goals Summary${C.reset}`);
  console.log(`${C.bold}${C.cyan}========================================${C.reset}\n`);

  const summary = getGoalsSummary(goals);

  if (summary.addressed.length > 0) {
    console.log(`${C.green}${C.bold}Addressed:${C.reset}`);
    for (const g of summary.addressed) {
      console.log(`  ${C.green}[v]${C.reset} ${g}`);
    }
  }

  if (summary.pending.length > 0) {
    console.log(`\n${C.yellow}${C.bold}Still pending:${C.reset}`);
    for (const g of summary.pending) {
      console.log(`  ${C.yellow}[ ]${C.reset} ${g}`);
    }
  }

  // Show detailed goal state
  console.log(`\n${C.bold}Detailed goal states:${C.reset}`);
  for (const g of goals) {
    if (!g.enabled) continue;
    const check = g.addressed ? `${C.green}[v]${C.reset}` : `${C.yellow}[ ]${C.reset}`;
    const extra = [];
    if (g._addressedTopics) extra.push(`topics hit: ${[...g._addressedTopics].join(', ')}`);
    if (g._checkedItems) extra.push(`items checked: ${[...g._checkedItems].join(', ')}`);
    if (g.addressed_at) extra.push(`at: ${new Date(g.addressed_at).toLocaleTimeString()}`);
    const extraStr = extra.length > 0 ? ` ${C.dim}(${extra.join('; ')})${C.reset}` : '';
    console.log(`  ${check} ${g.id} (${g.type})${extraStr}`);
  }

  console.log(`\n${C.bold}${C.cyan}Done!${C.reset}\n`);
  clearSession(SESSION_ID);
}

// ── Entry point ───────────────────────────────────────────────────────

runSimulation().catch((err) => {
  console.error(`${C.red}Fatal error:${C.reset}`, err);
  process.exit(1);
});
