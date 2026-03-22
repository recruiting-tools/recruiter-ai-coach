#!/usr/bin/env node

/**
 * Seed script — creates mock candidates, jobs, and interviews for development.
 * Run from project root: cd backend && node ../scripts/seed-mock-interviews.js
 * Or: node -e "process.chdir('backend')" && node scripts/seed-mock-interviews.js
 */

// Add backend/node_modules to module resolution so dotenv, better-sqlite3, etc. resolve
const path = require('path');
module.paths.unshift(path.join(__dirname, '../backend/node_modules'));

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../backend/src/interview-config-db');

// ──────────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────────

const candidates = [
  {
    name: 'Алексей Петров',
    raw_cv: `Senior Frontend Developer, 5 лет опыта.
Стек: React, TypeScript, Next.js, Redux, GraphQL.
Последнее место: Яндекс, команда Маркета (2 года).
До этого: стартап в финтехе, full-stack на Node.js + React.
Образование: МФТИ, прикладная математика.
Английский: B2.
Делал: микрофронтенды, design system, CI/CD на GitLab, мониторинг через Grafana.
Хобби: опенсорс, контрибьютил в React Query.`,
  },
  {
    name: 'Maria Gonzalez',
    raw_cv: `Full Stack Engineer, 4 years experience.
Stack: Python, Django, FastAPI, React, PostgreSQL, Docker, AWS.
Current: Backend lead at fintech startup (1.5 years), team of 3.
Before: Junior developer at outsourcing company, various projects.
Education: BSc Computer Science, Universidad de Buenos Aires.
English: C1.
Built: payment processing pipeline, REST APIs, deployed on ECS.
Interests: machine learning, took Andrew Ng's course.`,
  },
  {
    name: 'Дмитрий Козлов',
    raw_cv: `DevOps / SRE Engineer, 6 лет опыта.
Стек: Kubernetes, Terraform, Ansible, AWS, GCP, Prometheus, Grafana.
Последнее место: Ozon, SRE команда (3 года).
До этого: системный администратор в банке.
Образование: МАИ, информационная безопасность.
Сертификаты: AWS Solutions Architect, CKA (Kubernetes).
Опыт: on-call ротация, incident management, SLO/SLI, chaos engineering.
Автоматизировал деплой 200+ микросервисов.`,
  },
];

const jobs = [
  {
    title: 'Senior Frontend Developer',
    raw_jd: `Ищем Senior Frontend Developer в продуктовую команду.
Требования:
- React 18+, TypeScript (strict mode)
- Опыт с Next.js или аналогичным SSR фреймворком
- State management (Redux Toolkit, Zustand, или MobX)
- Тестирование: Jest, React Testing Library, Cypress
- CI/CD, Docker basics
- Опыт работы в продуктовой команде от 3 лет

Будет плюсом:
- GraphQL
- Микрофронтенды
- Design system experience
- Опыт менторинга

Условия: удалёнка, 300-450к, ДМС, акции.`,
  },
  {
    title: 'Backend Python Developer',
    raw_jd: `Looking for a Backend Developer to join our platform team.
Requirements:
- Python 3.10+, FastAPI or Django
- PostgreSQL, Redis
- Docker, basic Kubernetes knowledge
- REST API design, OpenAPI specs
- Experience with async programming (asyncio)
- 3+ years of backend experience

Nice to have:
- Message queues (RabbitMQ, Kafka)
- AWS or GCP experience
- ML pipeline basics
- Team lead experience

Offer: remote, $4000-6000/mo, stock options.`,
  },
];

// ──────────────────────────────────────────────────
// Seed
// ──────────────────────────────────────────────────

console.log('Seeding mock data...\n');

// Create candidates
const createdCandidates = candidates.map((c) => {
  const result = db.createCandidate(c.name, c.raw_cv);
  console.log(`  Candidate: ${result.name} (${result.id})`);
  return result;
});

// Create jobs
const createdJobs = jobs.map((j) => {
  const result = db.createJob(j.title, j.raw_jd);
  console.log(`  Job: ${result.title} (${result.id})`);
  return result;
});

// Create interviews
const interview1 = db.createInterview(createdCandidates[0].id, createdJobs[0].id);
console.log(`\n  Interview 1: ${createdCandidates[0].name} -> ${createdJobs[0].title} (${interview1.id})`);

const interview2 = db.createInterview(createdCandidates[1].id, createdJobs[1].id);
console.log(`  Interview 2: ${createdCandidates[1].name} -> ${createdJobs[1].title} (${interview2.id})`);

const interview3 = db.createInterview(createdCandidates[2].id, createdJobs[0].id);
console.log(`  Interview 3: ${createdCandidates[2].name} -> ${createdJobs[0].title} (${interview3.id})`);

// Set goals for interview 1
const goals1 = [
  {
    id: 'hard_deep',
    type: 'hard_skills',
    depth: 'deep',
    enabled: true,
    config: { topics: ['React', 'TypeScript', 'Next.js', 'Redux'] },
  },
  {
    id: 'soft_star',
    type: 'soft_skills',
    enabled: true,
    config: { style: 'STAR' },
  },
  {
    id: 'time',
    type: 'time_saving',
    enabled: true,
    config: { max_min: 45, warn_min: 35 },
  },
  {
    id: 'checklist_1',
    type: 'checklist',
    enabled: true,
    config: { items: ['Salary expectations', 'Notice period', 'English level check'] },
  },
];

db.updateGoals(interview1.id, goals1);
console.log(`  Goals set for interview 1 (${goals1.length} goals)`);

// Set keywords for interview 1 (hardcoded for now, generate-keywords endpoint uses OpenAI)
const keywords1 = [
  'React', 'TypeScript', 'Next.js', 'Redux', 'GraphQL',
  'микрофронтенды', 'design system', 'CI/CD', 'GitLab',
  'Grafana', 'Jest', 'Cypress', 'SSR', 'Zustand',
  'Яндекс', 'Маркет', 'МФТИ', 'React Query',
];

db.updateKeywords(interview1.id, keywords1);
console.log(`  Keywords set for interview 1 (${keywords1.length} keywords)`);

// Activate interview 1
db.setActiveInterview(interview1.id);
console.log(`  Interview 1 activated`);

// Bind a mock meet URL to interview 1
db.bindMeetUrl(interview1.id, 'https://meet.google.com/abc-defg-hij');
console.log(`  Meet URL bound to interview 1`);

// Summary
console.log('\n--- Summary ---');
console.log(`Candidates: ${createdCandidates.length}`);
console.log(`Jobs: ${createdJobs.length}`);
console.log(`Interviews: 3`);
console.log(`Active interview ID: ${interview1.id}`);
console.log(`\nDone! Database at: backend/data/coach.db`);
