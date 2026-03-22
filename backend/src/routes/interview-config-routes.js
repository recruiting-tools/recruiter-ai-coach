const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const db = require('../interview-config-db');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ──────────────────────────────────────────────────
// Candidates
// ──────────────────────────────────────────────────

router.post('/candidates', (req, res) => {
  const { name, raw_cv } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const candidate = db.createCandidate(name, raw_cv);
    res.status(201).json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/candidates', (req, res) => {
  try {
    res.json(db.listCandidates());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────
// Jobs
// ──────────────────────────────────────────────────

router.post('/jobs', (req, res) => {
  const { title, raw_jd } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const job = db.createJob(title, raw_jd);
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/jobs', (req, res) => {
  try {
    res.json(db.listJobs());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────
// Interviews
// ──────────────────────────────────────────────────

// GET active interview — must be before /:id to avoid route conflict
router.get('/interviews/active', (req, res) => {
  try {
    const interview = db.getActiveInterview();
    if (!interview) return res.status(404).json({ error: 'No active interview' });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET interview by meet URL
router.get('/interviews/by-meet-url', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param is required' });

  try {
    const interview = db.getInterviewByMeetUrl(url);
    if (!interview) return res.status(404).json({ error: 'No interview found for this Meet URL' });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/interviews', (req, res) => {
  const { candidate_id, job_id } = req.body;
  if (!candidate_id || !job_id) {
    return res.status(400).json({ error: 'candidate_id and job_id are required' });
  }

  try {
    const interview = db.createInterview(candidate_id, job_id);
    res.status(201).json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/interviews', (req, res) => {
  try {
    res.json(db.listInterviews());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/interviews/:id', (req, res) => {
  try {
    const interview = db.getInterview(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update goals
router.put('/interviews/:id/goals', (req, res) => {
  const { goals } = req.body;
  if (!goals || !Array.isArray(goals)) {
    return res.status(400).json({ error: 'goals must be an array' });
  }

  try {
    const interview = db.updateGoals(req.params.id, goals);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bind Meet URL
router.post('/interviews/:id/bind-meet', (req, res) => {
  const { meet_url } = req.body;
  if (!meet_url) return res.status(400).json({ error: 'meet_url is required' });

  try {
    const interview = db.bindMeetUrl(req.params.id, meet_url);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate interview
router.post('/interviews/:id/activate', (req, res) => {
  try {
    const interview = db.setActiveInterview(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate keywords from CV + JD using OpenAI
router.post('/interviews/:id/generate-keywords', async (req, res) => {
  try {
    const interview = db.getInterview(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });

    const { raw_cv, raw_jd, job_title, candidate_name } = interview;

    if (!raw_cv && !raw_jd) {
      return res.status(400).json({ error: 'Interview has no CV or JD text to generate keywords from' });
    }

    const prompt = `Проанализируй CV кандидата и описание вакансии. Выдели ключевые слова и фразы, которые могут прозвучать на собеседовании.

Кандидат: ${candidate_name}
Позиция: ${job_title}

CV:
${raw_cv || '(не указано)'}

JD:
${raw_jd || '(не указано)'}

Верни JSON массив из 15-25 ключевых слов/фраз. Включи:
- Технологии и инструменты
- Методологии
- Навыки из JD которые есть в CV
- Навыки из JD которых нет в CV (пометь как "gap")
- Компании-конкуренты если упоминаются

Формат: ["keyword1", "keyword2", ...]
Только JSON массив, без пояснений.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content?.trim();

    // Parse the JSON array from GPT response
    let keywords;
    try {
      // Handle case where GPT wraps in ```json ... ```
      const jsonStr = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
      keywords = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({
        error: 'Failed to parse keywords from OpenAI response',
        raw: content,
      });
    }

    const updated = db.updateKeywords(req.params.id, keywords);
    res.json({ keywords, interview: updated });
  } catch (err) {
    console.error('[generate-keywords] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
