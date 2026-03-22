const OpenAI = require('openai');
const db = require('./interview-config-db');

// Lazy-init: don't crash on import if OPENAI_API_KEY is missing
let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[claude.js] OPENAI_API_KEY not set — LLM hints disabled');
      return null;
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

const SYSTEM_PROMPT = `Ты — AI-ассистент для рекрутера во время технического собеседования.
Ты получаешь транскрипцию разговора в реальном времени и генерируешь краткие подсказки.

Твои подсказки должны быть:
- Краткими (1-3 предложения максимум)
- Конкретными и actionable
- На русском языке
- Профессиональными

Типы подсказок, которые ты можешь генерировать:

🔍 УТОЧНИ — когда кандидат говорит что-то расплывчато
❓ ВОПРОС — конкретный follow-up вопрос ("ты используешь Vue или React?", "какую версию используешь?")
🚩 ФЛАГ — противоречие или красный флаг в ответе
✅ ПОЗИТИВ — отличный ответ, стоит отметить
⏭ ДАЛЕЕ — предложение перейти к следующей теме
💡 ИНСАЙТ — интересный момент для углубления

Отвечай ТОЛЬКО если есть что-то важное для рекрутера. Если ничего примечательного — ответь пустой строкой.

Формат ответа:
[ТYPE_EMOJI] Текст подсказки

Пример:
❓ Уточни, какой фреймворк для стейт-менеджмента он использовал — Redux или Zustand?`;

// Хранилище контекста разговора по сессиям
const sessionContexts = new Map();

function addToContext(sessionId, segment) {
  if (!sessionContexts.has(sessionId)) {
    sessionContexts.set(sessionId, {
      segments: [],
      prepContext: null,
      lastHintAt: 0,
      hintCount: 0,
    });
  }
  const ctx = sessionContexts.get(sessionId);
  ctx.segments.push(segment);
  if (ctx.segments.length > 50) {
    ctx.segments = ctx.segments.slice(-50);
  }
}

function setPrepContext(sessionId, prepContext) {
  if (!sessionContexts.has(sessionId)) {
    sessionContexts.set(sessionId, { segments: [], prepContext: null, lastHintAt: 0, hintCount: 0 });
  }
  sessionContexts.get(sessionId).prepContext = prepContext;
}

async function generateHint(sessionId, newSegment, { noThrottle = false } = {}) {
  if (!getClient()) return null;
  const ctx = sessionContexts.get(sessionId);
  if (!ctx) return null;

  // Throttling: не чаще раз в 20 секунд (отключается в тест-режиме)
  const now = Date.now();
  if (!noThrottle && now - ctx.lastHintAt < 20000) return null;

  const recentSegments = ctx.segments.slice(-10);
  const recentText = recentSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
  if (recentText.length < 30) return null;

  const prepSection = ctx.prepContext
    ? `\n\nКонтекст подготовки к интервью:\n${ctx.prepContext}\n`
    : '';

  const userMessage = `${prepSection}
Транскрипция последних реплик:
${recentText}

Новая реплика: ${newSegment.speaker}: ${newSegment.text}

Нужна ли рекрутеру подсказка прямо сейчас? Если да — напиши её. Если нет — пустую строку.`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const hint = response.choices[0]?.message?.content?.trim();
    if (hint && hint.length > 2) {
      ctx.lastHintAt = now;
      ctx.hintCount++;
      return hint;
    }
    return null;
  } catch (err) {
    console.error('[OpenAI] Error generating hint:', err.message);
    return null;
  }
}

async function generatePrepKit(candidateCV, jobDescription, role) {
  const prompt = `Подготовь рекрутера к техническому интервью на позицию: ${role}

CV кандидата:
${candidateCV}

Описание вакансии:
${jobDescription}

Подготовь краткий prep kit для рекрутера (займёт 5 минут на изучение):

1. **Технический стек кандидата** — что использовал, на каком уровне
2. **Ключевые термины** — 8-10 терминов которые прозвучат в разговоре, с кратким объяснением
3. **Умные вопросы** — 6-8 вопросов типа "ты используешь A или B?", которые покажут что рекрутер разбирается
4. **На что обратить внимание** — красные флаги исходя из CV, пробелы в опыте
5. **Позитивные индикаторы** — что говорит о сильном кандидате
6. **Вопросы для закрытия** — как завершить интервью

Отвечай кратко, по делу. Рекрутер — не технарь, но должен казаться компетентным.`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0]?.message?.content;
}

// ── Goals-aware hint generation ───────────────────────────────────────

const GOALS_AWARE_SYSTEM_PROMPT = `Ты — AI-ассистент для рекрутера во время технического собеседования.
Ты получаешь транскрипцию разговора в реальном времени и генерируешь краткие подсказки.

Твои подсказки должны быть:
- Краткими (1-3 предложения максимум)
- Конкретными и actionable
- На русском языке
- Профессиональными

Типы подсказок, которые ты можешь генерировать:

🔍 УТОЧНИ — когда кандидат говорит что-то расплывчато
❓ ВОПРОС — конкретный follow-up вопрос
🚩 ФЛАГ — противоречие или красный флаг в ответе
✅ ПОЗИТИВ — отличный ответ, стоит отметить
⏭ ДАЛЕЕ — предложение перейти к следующей теме
💡 ИНСАЙТ — интересный момент для углубления
🎯 КОМПЕТЕНТНОСТЬ — фраза которая покажет что рекрутер разбирается в теме

Когда кандидат упоминает технологию, предложи рекрутеру умную фразу демонстрирующую компетентность.
Например: кандидат говорит "kubernetes" → подсказка: "Скажи: 'Вы Helm charts используете или kustomize?'"

ВАЖНО — учитывай кто говорит в новой реплике:
- Если говорит "candidate": ищи расплывчатость, красные флаги, моменты для уточнения. Предлагай follow-up вопросы и фразы компетентности.
- Если говорит "recruiter": НЕ перебивай подсказками во время его речи. Подсказку давай только если вопрос был сформулирован неэффективно (слишком широко, закрытый вопрос) — тогда предложи более точную формулировку.
- Если роль "unknown": трактуй как кандидат.

Отвечай ТОЛЬКО если есть что-то важное. Если ничего примечательного — пустую строку.

Формат ответа:
[EMOJI] Текст подсказки`;

function buildKeywordsSection(keywords) {
  if (!keywords || keywords.length === 0) return '';
  return `\n\nКлючевые слова из CV и вакансии (обращай внимание когда их упоминают):\n${keywords.join(', ')}\n`;
}

function buildGoalsSection(goals) {
  if (!goals || goals.length === 0) return '';

  const lines = ['Активные цели интервью:'];

  for (const goal of goals) {
    if (!goal.enabled) continue;
    const status = goal.addressed ? '[DONE]' : '[ACTIVE]';

    switch (goal.type) {
      case 'hard_skills': {
        const topics = goal.config?.topics?.join(', ') || '';
        lines.push(`${status} Тех. навыки: проверить ${topics} (глубина: ${goal.depth || 'medium'})`);
        break;
      }
      case 'soft_skills':
        lines.push(`${status} Поведенческие вопросы (${goal.config?.style || 'STAR'} формат)`);
        break;
      case 'competitor_research': {
        const comps = goal.config?.competitors?.join(', ') || '';
        lines.push(`${status} Мониторинг конкурентов: ${comps}`);
        break;
      }
      case 'time_saving':
        lines.push(`${status} Контроль времени: макс ${goal.config?.max_min || 45} мин`);
        break;
      case 'overemployment':
        lines.push(`${status} Детект параллельной занятости`);
        break;
      case 'show_competence': {
        const scTopics = goal.config?.topics?.join(', ') || 'все технологии';
        lines.push(`${status} Показать компетентность по: ${scTopics}`);
        break;
      }
      case 'checklist': {
        const items = goal.config?.items?.join(', ') || '';
        lines.push(`${status} Чеклист: ${items}`);
        break;
      }
    }
  }

  return '\n\n' + lines.join('\n') + '\n';
}

/**
 * Generate a hint with goals context injected into the system prompt.
 *
 * @param {string} sessionId
 * @param {{speaker: string, text: string}} segment - New transcript segment
 * @param {Goal[]} goals - Active interview goals (if empty, auto-loads from DB)
 * @param {object} [opts]
 * @param {boolean} [opts.noThrottle=false] - Disable 20s throttle
 * @param {string[]} [opts.keywords=[]] - Keywords from CV/JD to inject into prompt
 * @returns {Promise<string|null>}
 */
async function generateGoalsAwareHint(sessionId, segment, goals, { noThrottle = false, keywords = null } = {}) {
  if (!getClient()) return null;
  // Ensure segment is in context
  addToContext(sessionId, segment);
  const ctx = sessionContexts.get(sessionId);
  if (!ctx) return null;

  const now = Date.now();
  if (!noThrottle && now - ctx.lastHintAt < 20000) return null;

  const recentSegments = ctx.segments.slice(-10);
  const recentText = recentSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
  if (recentText.length < 30) return null;

  let activeGoals = goals;
  let activeKeywords = keywords || [];

  // Auto-load active interview if goals not provided or keywords not explicitly passed
  if (!activeGoals || activeGoals.length === 0 || keywords === null) {
    try {
      const interview = db.getActiveInterview();
      if (interview) {
        if (!activeGoals || activeGoals.length === 0) activeGoals = interview.goals || [];
        if (keywords === null) activeKeywords = interview.keywords || [];
      }
    } catch (err) {
      console.warn('[claude] Could not load active interview:', err.message);
    }
  }

  const prepSection = ctx.prepContext
    ? `\nКонтекст подготовки к интервью:\n${ctx.prepContext}\n`
    : '';

  const goalsSection = buildGoalsSection(activeGoals);
  const keywordsSection = buildKeywordsSection(activeKeywords);

  const systemPrompt = GOALS_AWARE_SYSTEM_PROMPT + goalsSection + keywordsSection;

  const userMessage = `${prepSection}
Транскрипция последних реплик:
${recentText}

Новая реплика [${segment.speaker === 'recruiter' ? 'РЕКРУТЕР' : segment.speaker === 'candidate' ? 'КАНДИДАТ' : 'НЕИЗВЕСТНО'}]: ${segment.text}

Нужна ли рекрутеру подсказка прямо сейчас? Учти активные цели интервью${activeGoals?.length ? '' : ' (целей нет — давай общие подсказки)'}. Если кандидат упоминает технологию — предложи умную фразу. Если нет важного — пустую строку.`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 250,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const hint = response.choices[0]?.message?.content?.trim();
    if (hint && hint.length > 2) {
      ctx.lastHintAt = now;
      ctx.hintCount++;
      return hint;
    }
    return null;
  } catch (err) {
    console.error('[OpenAI] Error generating goals-aware hint:', err.message);
    return null;
  }
}

// ── Keyword extraction from CV + JD ──────────────────────────────────

/**
 * Extract 30-50 keywords from CV + JD using GPT-4o.
 *
 * @param {string} cvText - Raw CV text
 * @param {string} jdText - Raw job description text
 * @returns {Promise<string[]>} - Array of keywords
 */
async function generateKeywords(cvText, jdText) {
  const prompt = `Извлеки 30-50 ключевых слов и фраз из CV кандидата и описания вакансии.

CV кандидата:
${cvText}

Описание вакансии:
${jdText}

Извлеки:
- Технологии и инструменты (React, Docker, PostgreSQL...)
- Названия компаний
- Роли и позиции (Team Lead, Senior, Architect...)
- Софт-скиллы (лидерство, коммуникация, менторинг...)
- Бизнес-термины (продуктовая метрика, revenue, конверсия...)
- Методологии (Agile, Scrum, CI/CD...)

ВАЖНО: верни ТОЛЬКО JSON массив строк, без пояснений. Пример:
["React", "TypeScript", "Team Lead", "Docker", "PostgreSQL"]`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    // Parse JSON array from response, handling possible markdown wrapping
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    console.error('[OpenAI] generateKeywords: could not parse JSON from response');
    return [];
  } catch (err) {
    console.error('[OpenAI] Error generating keywords:', err.message);
    return [];
  }
}

// ── Keyword explanation ───────────────────────────────────────────────

/**
 * Explain what a keyword means in context of the role + suggest follow-up question.
 *
 * @param {string} keyword - The keyword to explain
 * @param {string} role - Job title / role
 * @param {string} jdSummary - Summary of job description
 * @returns {Promise<string>} - Explanation + suggested question
 */
async function explainKeyword(keyword, role, jdSummary) {
  const prompt = `Рекрутер проводит интервью на позицию "${role}".
${jdSummary ? `Краткое описание вакансии: ${jdSummary}` : ''}

Кандидат упомянул "${keyword}".

Объясни рекрутеру в 2-3 предложениях:
1. Что это за технология/термин и зачем она нужна в контексте этой вакансии
2. Предложи один умный follow-up вопрос который рекрутер может задать

Отвечай на русском, просто и без технического жаргона. Рекрутер — не программист.`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('[OpenAI] Error explaining keyword:', err.message);
    return `Не удалось объяснить "${keyword}" — попробуйте позже.`;
  }
}

function clearSession(sessionId) {
  sessionContexts.delete(sessionId);
}

/**
 * Generate a hint by automatically loading the active interview from DB.
 * Injects enabled goals + keywords into the system prompt.
 * This is the primary function to use in the real interview flow.
 *
 * @param {string} sessionId
 * @param {{speaker: string, text: string}} segment
 * @param {object} [opts]
 * @param {boolean} [opts.noThrottle=false]
 * @returns {Promise<string|null>}
 */
async function generateHintFromActiveInterview(sessionId, segment, opts = {}) {
  let goals = [];
  let keywords = [];
  try {
    const interview = db.getActiveInterview();
    if (interview) {
      goals = (interview.goals || []).filter((g) => g.enabled);
      keywords = interview.keywords || [];
    }
  } catch (err) {
    console.warn('[claude] Could not load active interview:', err.message);
  }
  return generateGoalsAwareHint(sessionId, segment, goals, { ...opts, keywords });
}

module.exports = {
  addToContext,
  setPrepContext,
  generateHint,
  generateGoalsAwareHint,
  generateHintFromActiveInterview,
  generatePrepKit,
  generateKeywords,
  explainKeyword,
  clearSession,
  // Exported for testing
  buildGoalsSection,
  buildKeywordsSection,
};
