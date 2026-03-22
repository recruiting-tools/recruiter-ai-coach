const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'coach.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ──────────────────────────────────────────────────
// Schema: auto-create tables on init
// ──────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    raw_cv TEXT,
    cv_summary TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    raw_jd TEXT,
    jd_summary TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES candidates(id),
    job_id TEXT NOT NULL REFERENCES jobs(id),
    meet_url TEXT,
    scheduled_at TEXT,
    status TEXT DEFAULT 'draft',
    goals TEXT DEFAULT '[]',
    prep_kit TEXT,
    keywords TEXT DEFAULT '[]',
    language TEXT DEFAULT 'ru',
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    interview_id TEXT REFERENCES interviews(id),
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_sec INTEGER
  );

  CREATE TABLE IF NOT EXISTS transcript_segments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    speaker TEXT,
    text TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    source TEXT DEFAULT 'deepgram'
  );

  CREATE TABLE IF NOT EXISTS hints (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    hint_type TEXT,
    content TEXT NOT NULL,
    triggered_by TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    dismissed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS keywords_detected (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    keyword TEXT NOT NULL,
    confidence REAL,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_interviews_meet_url ON interviews(meet_url);
  CREATE INDEX IF NOT EXISTS idx_interviews_active ON interviews(is_active);
  CREATE INDEX IF NOT EXISTS idx_sessions_interview ON sessions(interview_id);
  CREATE INDEX IF NOT EXISTS idx_segments_session ON transcript_segments(session_id);
  CREATE INDEX IF NOT EXISTS idx_hints_session ON hints(session_id);
  CREATE INDEX IF NOT EXISTS idx_keywords_session ON keywords_detected(session_id);
`);

console.log(`[DB] SQLite initialized at ${DB_PATH}`);

// ──────────────────────────────────────────────────
// Candidates
// ──────────────────────────────────────────────────

const _insertCandidate = db.prepare(
  'INSERT INTO candidates (id, name, raw_cv) VALUES (?, ?, ?)'
);

function createCandidate(name, rawCv) {
  const id = uuidv4();
  _insertCandidate.run(id, name, rawCv || null);
  return getCandidate(id);
}

function getCandidate(id) {
  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
}

function listCandidates() {
  return db.prepare('SELECT * FROM candidates ORDER BY created_at DESC').all();
}

// ──────────────────────────────────────────────────
// Jobs
// ──────────────────────────────────────────────────

const _insertJob = db.prepare(
  'INSERT INTO jobs (id, title, raw_jd) VALUES (?, ?, ?)'
);

function createJob(title, rawJd) {
  const id = uuidv4();
  _insertJob.run(id, title, rawJd || null);
  return getJob(id);
}

function getJob(id) {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
}

function listJobs() {
  return db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
}

// ──────────────────────────────────────────────────
// Interviews
// ──────────────────────────────────────────────────

const _insertInterview = db.prepare(
  'INSERT INTO interviews (id, candidate_id, job_id) VALUES (?, ?, ?)'
);

function createInterview(candidateId, jobId) {
  const id = uuidv4();
  _insertInterview.run(id, candidateId, jobId);
  return getInterview(id);
}

function getInterview(id) {
  const row = db.prepare(`
    SELECT i.*,
           c.name AS candidate_name, c.raw_cv, c.cv_summary,
           j.title AS job_title, j.raw_jd, j.jd_summary
    FROM interviews i
    JOIN candidates c ON c.id = i.candidate_id
    JOIN jobs j ON j.id = i.job_id
    WHERE i.id = ?
  `).get(id);

  if (!row) return null;

  return {
    ...row,
    goals: JSON.parse(row.goals || '[]'),
    keywords: JSON.parse(row.keywords || '[]'),
  };
}

function listInterviews() {
  const rows = db.prepare(`
    SELECT i.id, i.status, i.meet_url, i.is_active, i.language, i.created_at,
           c.name AS candidate_name,
           j.title AS job_title
    FROM interviews i
    JOIN candidates c ON c.id = i.candidate_id
    JOIN jobs j ON j.id = i.job_id
    ORDER BY i.created_at DESC
  `).all();

  return rows;
}

function getInterviewByMeetUrl(meetUrl) {
  const row = db.prepare(`
    SELECT i.*,
           c.name AS candidate_name, c.raw_cv, c.cv_summary,
           j.title AS job_title, j.raw_jd, j.jd_summary
    FROM interviews i
    JOIN candidates c ON c.id = i.candidate_id
    JOIN jobs j ON j.id = i.job_id
    WHERE i.meet_url = ?
  `).get(meetUrl);

  if (!row) return null;

  return {
    ...row,
    goals: JSON.parse(row.goals || '[]'),
    keywords: JSON.parse(row.keywords || '[]'),
  };
}

function updateGoals(interviewId, goals) {
  db.prepare('UPDATE interviews SET goals = ? WHERE id = ?')
    .run(JSON.stringify(goals), interviewId);
  return getInterview(interviewId);
}

function updateKeywords(interviewId, keywords) {
  db.prepare('UPDATE interviews SET keywords = ? WHERE id = ?')
    .run(JSON.stringify(keywords), interviewId);
  return getInterview(interviewId);
}

function updatePrepKit(interviewId, prepKit) {
  db.prepare('UPDATE interviews SET prep_kit = ? WHERE id = ?')
    .run(prepKit, interviewId);
}

function bindMeetUrl(interviewId, meetUrl) {
  db.prepare('UPDATE interviews SET meet_url = ? WHERE id = ?')
    .run(meetUrl, interviewId);
  return getInterview(interviewId);
}

function setActiveInterview(interviewId) {
  // Deactivate all first, then activate the one
  const tx = db.transaction(() => {
    db.prepare('UPDATE interviews SET is_active = 0 WHERE is_active = 1').run();
    db.prepare('UPDATE interviews SET is_active = 1, status = ? WHERE id = ?')
      .run('active', interviewId);
  });
  tx();
  return getInterview(interviewId);
}

function getActiveInterview() {
  const row = db.prepare(`
    SELECT i.*,
           c.name AS candidate_name, c.raw_cv, c.cv_summary,
           j.title AS job_title, j.raw_jd, j.jd_summary
    FROM interviews i
    JOIN candidates c ON c.id = i.candidate_id
    JOIN jobs j ON j.id = i.job_id
    WHERE i.is_active = 1
    LIMIT 1
  `).get();

  if (!row) return null;

  return {
    ...row,
    goals: JSON.parse(row.goals || '[]'),
    keywords: JSON.parse(row.keywords || '[]'),
  };
}

// ──────────────────────────────────────────────────
// Sessions
// ──────────────────────────────────────────────────

function createSession(interviewId) {
  const id = uuidv4();
  db.prepare('INSERT INTO sessions (id, interview_id) VALUES (?, ?)').run(id, interviewId);
  return { id, interview_id: interviewId };
}

function endSession(sessionId) {
  db.prepare(`
    UPDATE sessions
    SET ended_at = datetime('now'),
        duration_sec = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
    WHERE id = ?
  `).run(sessionId);
}

// ──────────────────────────────────────────────────
// Transcript segments
// ──────────────────────────────────────────────────

function saveSegment(sessionId, speaker, text, source) {
  const id = uuidv4();
  db.prepare(
    'INSERT INTO transcript_segments (id, session_id, speaker, text, source) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, speaker || 'unknown', text, source || 'deepgram');
  return id;
}

// ──────────────────────────────────────────────────
// Hints
// ──────────────────────────────────────────────────

function saveHint(sessionId, hintType, content, triggeredBy) {
  const id = uuidv4();
  db.prepare(
    'INSERT INTO hints (id, session_id, hint_type, content, triggered_by) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, hintType, content, triggeredBy || null);
  return id;
}

// ──────────────────────────────────────────────────
// Keywords detected
// ──────────────────────────────────────────────────

function saveKeywordHit(sessionId, keyword, confidence) {
  const id = uuidv4();
  db.prepare(
    'INSERT INTO keywords_detected (id, session_id, keyword, confidence) VALUES (?, ?, ?, ?)'
  ).run(id, sessionId, keyword, confidence || 1.0);
  return id;
}

// ──────────────────────────────────────────────────
// Goal Presets
// ──────────────────────────────────────────────────

const PRESETS = {
  screening: [
    { type: 'proper_opening', enabled: true },
    { type: 'assess_hard_skills_screening', enabled: true },
    { type: 'assess_motivation', enabled: true },
    { type: 'detect_red_flags', enabled: true, config: { watch: ['overemployment', 'job_hopping', 'contradictions'] } },
    { type: 'collect_logistics', enabled: true, config: { items: ['salary_expectations', 'notice_period', 'work_format'] } },
    { type: 'competitor_intel', enabled: true },
    { type: 'sell_the_role', enabled: true },
    { type: 'time_management', enabled: true, config: { max_min: 30, warn_min: 23 } },
    { type: 'proper_closing', enabled: true },
  ],

  deep_technical: [
    { type: 'proper_opening', enabled: true },
    { type: 'assess_hard_skills_deep', enabled: true },
    { type: 'assess_problem_solving', enabled: true },
    { type: 'verify_resume', enabled: true },
    { type: 'show_competence', enabled: true },
    { type: 'pacing_control', enabled: true, config: { max_min_per_section: 15 } },
    { type: 'capture_scorecard', enabled: true },
    { type: 'time_management', enabled: true, config: { max_min: 60, warn_min: 50 } },
    { type: 'proper_closing', enabled: true },
  ],

  culture_fit: [
    { type: 'proper_opening', enabled: true },
    { type: 'build_rapport', enabled: true },
    { type: 'assess_cultural_fit', enabled: true },
    { type: 'assess_soft_skills', enabled: true, config: { style: 'STAR' } },
    { type: 'assess_motivation', enabled: true },
    { type: 'sell_the_role', enabled: true },
    { type: 'candidate_experience', enabled: true },
    { type: 'bias_mitigation', enabled: true },
    { type: 'time_management', enabled: true, config: { max_min: 45, warn_min: 35 } },
    { type: 'proper_closing', enabled: true },
  ],

  leadership: [
    { type: 'proper_opening', enabled: true },
    { type: 'assess_leadership', enabled: true, config: { topics: ['delegation', 'conflict_resolution', 'decision_making', 'mentoring'] } },
    { type: 'assess_soft_skills', enabled: true, config: { style: 'behavioral' } },
    { type: 'assess_problem_solving', enabled: true },
    { type: 'assess_motivation', enabled: true },
    { type: 'verify_resume', enabled: true },
    { type: 'capture_scorecard', enabled: true },
    { type: 'time_management', enabled: true, config: { max_min: 60, warn_min: 50 } },
    { type: 'proper_closing', enabled: true },
  ],

  full: [
    { type: 'proper_opening', enabled: true },
    { type: 'build_rapport', enabled: true },
    { type: 'understand_current_situation', enabled: true },
    { type: 'assess_hard_skills_deep', enabled: true },
    { type: 'assess_problem_solving', enabled: true },
    { type: 'assess_soft_skills', enabled: true, config: { style: 'STAR' } },
    { type: 'assess_cultural_fit', enabled: true },
    { type: 'assess_motivation', enabled: true },
    { type: 'assess_leadership', enabled: true },
    { type: 'assess_communication', enabled: true },
    { type: 'verify_resume', enabled: true },
    { type: 'detect_red_flags', enabled: true },
    { type: 'competitor_intel', enabled: true },
    { type: 'collect_logistics', enabled: true },
    { type: 'sell_the_role', enabled: true },
    { type: 'show_competence', enabled: true },
    { type: 'candidate_experience', enabled: true },
    { type: 'bias_mitigation', enabled: true },
    { type: 'capture_scorecard', enabled: true },
    { type: 'time_management', enabled: true, config: { max_min: 90, warn_min: 75 } },
    { type: 'proper_closing', enabled: true },
  ],
};

function createPreset(type) {
  const preset = PRESETS[type];
  if (!preset) {
    throw new Error(`Unknown preset type: "${type}". Valid: ${Object.keys(PRESETS).join(', ')}`);
  }
  // Return a deep copy with generated ids
  return JSON.parse(JSON.stringify(preset)).map((goal, i) => ({
    id: goal.id || `${type}_${goal.type}_${i}`,
    ...goal,
  }));
}

function listPresets() {
  return Object.keys(PRESETS).map(type => ({
    type,
    goal_count: PRESETS[type].length,
    goals: PRESETS[type].map(g => g.type),
  }));
}

// ──────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────

module.exports = {
  db,
  // Candidates
  createCandidate,
  getCandidate,
  listCandidates,
  // Jobs
  createJob,
  getJob,
  listJobs,
  // Interviews
  createInterview,
  getInterview,
  listInterviews,
  getInterviewByMeetUrl,
  updateGoals,
  updateKeywords,
  updatePrepKit,
  bindMeetUrl,
  setActiveInterview,
  getActiveInterview,
  // Sessions
  createSession,
  endSession,
  // Transcript
  saveSegment,
  // Hints
  saveHint,
  // Keywords
  saveKeywordHit,
  // Presets
  createPreset,
  listPresets,
};
