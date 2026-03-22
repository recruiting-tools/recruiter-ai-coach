# Interview Goals Catalog for Recruiter AI Coach

Comprehensive catalog of high-level interview goals, methodologies, and AI coach behaviors.
Each goal answers: **"What does the interviewer want to ACHIEVE in this call?"**

---

## 1. ASSESSMENT GOALS (What to Evaluate)

### 1.1 Assess Hard Skills Deeply
- **Label:** `assess_hard_skills_deep`
- **Description:** Verify the candidate's technical competencies against the job requirements with depth and follow-up questions.
- **AI Coach behavior:** Track which required technologies/topics from the JD have been discussed. Nudge if key topics are missed after 10 min. Suggest smart follow-up questions when candidate mentions a technology (e.g., "They said Kubernetes — ask about Helm vs kustomize").
- **Estimated time added:** +15-20 min
- **Config:** `{ topics: ["React", "TypeScript", ...], nudge_after_min: 10 }`

### 1.2 Assess Hard Skills Surface-Level (Screening)
- **Label:** `assess_hard_skills_screening`
- **Description:** Quickly validate whether the candidate has baseline familiarity with the required stack — no deep dives.
- **AI Coach behavior:** Check if each required topic was at least mentioned. Do NOT suggest deep follow-ups. Flag if recruiter is going too deep on one topic ("You've spent 8 min on React — move to the next topic").
- **Estimated time added:** +5-10 min
- **Config:** `{ topics: [...], max_min_per_topic: 3 }`

### 1.3 Assess Soft Skills (Behavioral / STAR)
- **Label:** `assess_soft_skills`
- **Description:** Evaluate communication, teamwork, conflict resolution, and leadership through behavioral questions.
- **AI Coach behavior:** Detect whether the recruiter has asked STAR-format questions. If not, suggest: "Ask: Tell me about a time you had a conflict with a colleague — how did you resolve it?" Track whether candidate gives structured answers (Situation-Task-Action-Result).
- **Estimated time added:** +10-15 min
- **Config:** `{ style: "STAR" | "behavioral" | "situational", min_questions: 2 }`

### 1.4 Assess Cultural Fit
- **Label:** `assess_cultural_fit`
- **Description:** Determine whether the candidate's values, work style, and preferences align with the team and company culture.
- **AI Coach behavior:** Suggest questions about work environment preferences, collaboration style, feedback reception, autonomy vs structure preferences. Flag if the conversation stays purely technical and cultural fit hasn't been explored.
- **Estimated time added:** +5-10 min
- **Config:** `{ values: ["ownership", "transparency", "remote-first"], probe_after_min: 15 }`

### 1.5 Assess Motivation and Intent
- **Label:** `assess_motivation`
- **Description:** Understand WHY the candidate is looking, what drives them, and whether their motivators align with what the role offers.
- **AI Coach behavior:** Listen for motivation signals (leaving because of X, interested in Y). Suggest probing questions: "What would make you reject an offer even if salary is right?" Alert if candidate's stated motivators conflict with what the role offers (e.g., candidate wants on-site but role is remote).
- **Estimated time added:** +5-7 min
- **Config:** `{ role_offers: ["remote", "startup", "equity"], red_flags: ["just looking", "any offer"] }`

### 1.6 Assess Leadership / Management Potential
- **Label:** `assess_leadership`
- **Description:** Evaluate the candidate's ability to lead, mentor, delegate, and make decisions under pressure.
- **AI Coach behavior:** Suggest leadership-specific questions: "How did you onboard the last person on your team?" "Describe a time you had to make a difficult decision with incomplete information." Track whether leadership topics were covered.
- **Estimated time added:** +7-10 min
- **Config:** `{ level: "team_lead" | "manager" | "director", topics: ["delegation", "conflict_resolution", "decision_making", "mentoring"] }`

### 1.7 Assess Problem-Solving Ability
- **Label:** `assess_problem_solving`
- **Description:** Evaluate how the candidate approaches unfamiliar problems, thinks through ambiguity, and structures solutions.
- **AI Coach behavior:** Suggest a situational or case question if none has been asked. Monitor candidate's response structure — does the candidate clarify assumptions, break the problem down, consider trade-offs? Prompt recruiter to ask "What alternatives did you consider?"
- **Estimated time added:** +10-15 min
- **Config:** `{ style: "case" | "situational" | "whiteboard", domain: "system_design" | "business" | "technical" }`

### 1.8 Assess Communication Skills
- **Label:** `assess_communication`
- **Description:** Evaluate clarity of expression, ability to explain complex ideas simply, active listening, and English proficiency (if relevant).
- **AI Coach behavior:** Monitor candidate's speech patterns. Flag overly vague answers ("Candidate gave a generic answer — ask for specifics"). If language assessment is needed, suggest switching to English at the right moment. Note talk-to-listen ratio.
- **Estimated time added:** +3-5 min (passive observation, minimal extra questions)
- **Config:** `{ check_language: "en" | null, flag_vague_answers: true }`

### 1.9 Verify Resume Claims
- **Label:** `verify_resume`
- **Description:** Cross-check specific claims from the CV — project ownership, team size, technologies actually used, duration of experience.
- **AI Coach behavior:** Generate targeted verification questions from CV data: "CV says 'led migration to microservices' — ask what the architecture looked like before and after." "CV says 'team of 12' — ask who reported to them." Alert if candidate's verbal account contradicts CV.
- **Estimated time added:** +5-10 min
- **Config:** `{ claims_to_verify: ["led team of 12", "built payment system", "reduced latency by 40%"] }`

### 1.10 Detect Red Flags / Risk Assessment
- **Label:** `detect_red_flags`
- **Description:** Watch for signs of overemployment, dishonesty, job-hopping patterns, or misalignment.
- **AI Coach behavior:** Pattern-match against known red flag indicators: frequent job changes without explanation, vague answers about current role, mentions of parallel employment/freelancing, reluctance to discuss specific projects. Alert recruiter discreetly.
- **Estimated time added:** +0 min (passive monitoring)
- **Config:** `{ watch: ["overemployment", "job_hopping", "vague_answers", "contradictions"] }`

---

## 2. PROCESS GOALS (How to Run the Interview)

### 2.1 Stay Within Time Limit
- **Label:** `time_management`
- **Description:** Keep the interview within the allocated time window and ensure all planned topics are covered.
- **AI Coach behavior:** Show elapsed time. Warn at configurable thresholds (e.g., 35 min of 45). If time is running out and key topics haven't been covered, suggest: "5 min left — you haven't discussed salary expectations yet." Suggest closing script when time is up.
- **Estimated time added:** +0 min (saves time)
- **Config:** `{ max_min: 45, warn_min: 35, must_cover_before_end: ["salary", "notice_period"] }`

### 2.2 Follow Structured Interview Format
- **Label:** `structured_format`
- **Description:** Ensure the interview follows a consistent structure with standardized questions, reducing bias and improving comparability across candidates.
- **AI Coach behavior:** Display the planned interview agenda/sections. Track which sections have been completed. Nudge if recruiter skips a section or goes off-script. Remind to use the same core questions for all candidates in the pipeline.
- **Estimated time added:** +0 min (improves quality, not duration)
- **Config:** `{ sections: ["intro", "experience", "technical", "behavioral", "culture", "questions", "close"], required_questions: [...] }`

### 2.3 Maintain Interview Pacing
- **Label:** `pacing_control`
- **Description:** Prevent spending too long on any single topic and ensure balanced coverage of all evaluation areas.
- **AI Coach behavior:** Track time spent per topic/section. Alert: "You've been on this topic for 12 min — consider moving on." Suggest transition phrases: "Great, that's very helpful. Let me shift to another area..."
- **Estimated time added:** +0 min (redistributes existing time)
- **Config:** `{ max_min_per_section: 10, alert_at_min: 7 }`

### 2.4 Take Structured Notes / Score
- **Label:** `capture_scorecard`
- **Description:** Ensure the recruiter captures structured evaluation data during or immediately after the interview for the scorecard.
- **AI Coach behavior:** After each major section, prompt: "Rate this section before moving on." At the end, display a mini-scorecard with all dimensions. Remind to note specific evidence, not just impressions.
- **Estimated time added:** +2-3 min
- **Config:** `{ dimensions: ["technical", "communication", "culture_fit", "motivation", "leadership"], scale: "1-5" }`

### 2.5 Ensure Proper Opening
- **Label:** `proper_opening`
- **Description:** Start the interview with a warm introduction, agenda overview, and rapport-building to set the candidate at ease.
- **AI Coach behavior:** At the start, display a checklist: introduce yourself, explain the format, state duration, ask if candidate has questions about the process. Nudge if recruiter jumps straight to questions without warming up.
- **Estimated time added:** +3-5 min
- **Config:** `{ checklist: ["self_intro", "company_intro", "format_explanation", "duration_stated", "icebreaker"] }`

### 2.6 Ensure Proper Closing
- **Label:** `proper_closing`
- **Description:** End the interview professionally — summarize, explain next steps, answer candidate questions, and leave a positive impression.
- **AI Coach behavior:** When nearing end time, prompt: "Time to close. Ask 'Do you have any questions for us?' Then explain the next steps and timeline." Remind to thank the candidate and give a clear timeline.
- **Estimated time added:** +3-5 min
- **Config:** `{ checklist: ["candidate_questions", "next_steps", "timeline", "thank_you"], trigger_at_remaining_min: 5 }`

---

## 3. RELATIONSHIP GOALS (Impression Management)

### 3.1 Sell the Role / Company
- **Label:** `sell_the_role`
- **Description:** Actively promote the opportunity — highlight company strengths, team culture, growth prospects, and unique selling points to attract the candidate.
- **AI Coach behavior:** Remind recruiter to weave in selling points throughout the conversation, not just at the end. Suggest context-relevant pitches: if candidate mentions interest in ML, say "By the way, we're launching an ML team next quarter." Track whether key selling points have been mentioned.
- **Estimated time added:** +3-5 min
- **Config:** `{ selling_points: ["remote-first", "equity", "strong engineering culture", "fast growth"], mention_at_least: 2 }`

### 3.2 Create Positive Candidate Experience
- **Label:** `candidate_experience`
- **Description:** Ensure the candidate feels respected, heard, and well-informed regardless of the outcome — this protects employer brand.
- **AI Coach behavior:** Monitor recruiter behavior: flag if recruiter interrupts candidate frequently, if candidate hasn't spoken for 3+ minutes, or if the tone is overly transactional. Suggest moments of active listening: "Good moment to acknowledge their experience."
- **Estimated time added:** +0 min (behavioral quality)
- **Config:** `{ max_recruiter_monologue_sec: 120, min_candidate_talk_ratio: 0.4 }`

### 3.3 Show Technical Competence (Recruiter Credibility)
- **Label:** `show_competence`
- **Description:** Demonstrate that the recruiter understands the technical domain, earning candidate's respect and trust.
- **AI Coach behavior:** When candidate mentions a technology, whisper a smart follow-up question that demonstrates knowledge (e.g., candidate says "Kubernetes" -> suggest asking "Helm or kustomize?"). Builds recruiter credibility without deep technical knowledge.
- **Estimated time added:** +0 min (enhances existing conversation)
- **Config:** `{ topics: [...], custom_phrases: { "kubernetes": "Helm or kustomize for manifests?" } }`

### 3.4 Build Rapport and Trust
- **Label:** `build_rapport`
- **Description:** Establish a genuine human connection beyond the transactional interview — find common ground, show empathy, create psychological safety.
- **AI Coach behavior:** Suggest personalized rapport-building moments based on CV data: "Candidate went to MIPT — if you have any connection, mention it." Remind to use candidate's name. Flag if conversation feels too formal/rigid for too long.
- **Estimated time added:** +2-3 min
- **Config:** `{ use_cv_data: true, suggest_icebreakers: true }`

### 3.5 Represent Company Values
- **Label:** `represent_values`
- **Description:** Embody and communicate the company's core values throughout the interview — not as a pitch, but through behavior and language.
- **AI Coach behavior:** If company values include "transparency," remind recruiter to be honest about challenges. If "diversity," flag any non-inclusive language. Suggest value-aligned responses to candidate questions.
- **Estimated time added:** +0 min (behavioral overlay)
- **Config:** `{ values: ["transparency", "ownership", "diversity", "growth_mindset"] }`

---

## 4. INFORMATION GATHERING GOALS

### 4.1 Collect Logistics / Admin Info
- **Label:** `collect_logistics`
- **Description:** Gather essential administrative information: salary expectations, notice period, availability, work authorization, location/timezone.
- **AI Coach behavior:** Track which logistical items have been discussed. Nudge before closing: "You haven't asked about notice period yet." Warn if this is left to the end and time is running out.
- **Estimated time added:** +3-5 min
- **Config:** `{ items: ["salary_expectations", "notice_period", "start_date", "work_authorization", "location", "timezone"] }`

### 4.2 Understand Current Situation
- **Label:** `understand_current_situation`
- **Description:** Map the candidate's current role, responsibilities, team size, reporting line, and reasons for looking — essential context for the entire evaluation.
- **AI Coach behavior:** Prompt at the beginning: "Start by understanding their current situation." Suggest follow-ups: "How big is the team? Who do you report to? What's driving the change?" Flag if recruiter never asked why the candidate is looking.
- **Estimated time added:** +5-7 min
- **Config:** `{ must_learn: ["current_role", "team_size", "reason_for_leaving", "reporting_to"] }`

### 4.3 Competitor Intelligence
- **Label:** `competitor_intel`
- **Description:** Gather insights about competitor companies — their tech stack, team structure, processes, culture — from candidates who worked there.
- **AI Coach behavior:** Detect when candidate mentions a competitor company. Suggest: "They worked at [Competitor] — ask about team size, tech stack, and what they liked/didn't like." Be discreet — this should feel like natural conversation.
- **Estimated time added:** +3-5 min
- **Config:** `{ competitors: ["Yandex", "Ozon", "VK", "Tinkoff"], probe_topics: ["team_size", "tech_stack", "culture"] }`

### 4.4 Map Career Trajectory
- **Label:** `map_career_trajectory`
- **Description:** Understand the candidate's career arc — progression speed, job change reasons, growth pattern — to assess trajectory and predict retention.
- **AI Coach behavior:** Prompt questions about transitions: "Why did you leave X for Y?" "What made you choose this career path?" Flag rapid job changes (< 1 year) for follow-up. Note upward trajectory vs lateral moves.
- **Estimated time added:** +5-7 min
- **Config:** `{ min_tenure_months: 12, flag_job_hopping: true }`

### 4.5 Assess Counter-Offer Risk
- **Label:** `counter_offer_risk`
- **Description:** Gauge how likely the candidate is to accept a counter-offer from their current employer if we make an offer.
- **AI Coach behavior:** Suggest subtle probing: "If your current company offered a raise and promotion to stay, would you consider it?" "Have you told your manager you're looking?" Flag high-risk signals: candidate speaks positively about current employer, hasn't told anyone they're looking, main reason for leaving is money.
- **Estimated time added:** +2-3 min
- **Config:** `{ risk_signals: ["positive_about_current", "only_leaving_for_money", "not_told_manager"] }`

### 4.6 Understand Candidate's Decision Criteria
- **Label:** `decision_criteria`
- **Description:** Learn what factors the candidate will use to choose between offers — so you can tailor your pitch and predict acceptance.
- **AI Coach behavior:** Prompt: "What are the top 3 things you're looking for in your next role?" Track stated priorities and compare against what your role offers. Alert if there's a mismatch: "Candidate wants on-site leadership role but this is an IC remote position."
- **Estimated time added:** +3-5 min
- **Config:** `{ role_offers: ["remote", "IC role", "equity"], compare: true }`

### 4.7 Pipeline / Competing Offers Status
- **Label:** `pipeline_status`
- **Description:** Understand where the candidate is in other hiring processes — urgency level, competing offers, and timeline pressure.
- **AI Coach behavior:** Prompt: "Are you interviewing elsewhere? Do you have any deadlines we should be aware of?" Flag urgency: "Candidate has a competing offer expiring next week — escalate internally." Track for follow-up.
- **Estimated time added:** +2-3 min
- **Config:** `{ ask_about: ["other_processes", "offers_in_hand", "decision_timeline"] }`

---

## 5. COMPLIANCE / RISK GOALS

### 5.1 Avoid Illegal / Discriminatory Questions
- **Label:** `legal_compliance`
- **Description:** Ensure no questions are asked about protected characteristics: age, marital status, children, religion, national origin, disability, pregnancy, sexual orientation.
- **AI Coach behavior:** Real-time monitoring of recruiter's speech. If recruiter starts asking about family, age, or origin — immediately flash a warning: "This question may be discriminatory. Rephrase or skip." Provide legal alternatives: instead of "Do you have kids?" ask "Are you able to meet the travel requirements of this role?"
- **Estimated time added:** +0 min (prevention)
- **Config:** `{ jurisdiction: "RU" | "US" | "EU" | "UAE", strictness: "warn" | "block" }`

### 5.2 Ensure Consistent Process Across Candidates
- **Label:** `process_consistency`
- **Description:** Ask the same core questions to all candidates for the same role to enable fair comparison and reduce bias.
- **AI Coach behavior:** Display the standardized question set. Track which questions have been asked. At the end, show completion: "You asked 4 of 6 core questions." Warn if recruiter is adding questions not in the standard set that could introduce bias.
- **Estimated time added:** +0 min (structure, not extra time)
- **Config:** `{ core_questions: [...], min_coverage: 0.8 }`

### 5.3 Bias Mitigation
- **Label:** `bias_mitigation`
- **Description:** Actively counteract common interviewer biases: halo effect, similarity bias, anchoring, contrast effect, confirmation bias.
- **AI Coach behavior:** If recruiter makes an early positive/negative comment, remind: "Avoid anchoring on first impression — continue the full evaluation." If recruiter bonds over shared background, flag potential similarity bias. Prompt to focus on job-related criteria only.
- **Estimated time added:** +0 min (cognitive guardrails)
- **Config:** `{ monitor: ["halo_effect", "similarity_bias", "anchoring", "confirmation_bias"] }`

### 5.4 Document the Interview
- **Label:** `documentation`
- **Description:** Ensure sufficient documentation of questions asked and rationale for hiring decisions — protects against legal challenges.
- **AI Coach behavior:** Auto-generate a structured summary after the interview: questions asked, key candidate responses, evaluation notes. Prompt recruiter to add specific evidence for each rating. Flag undocumented decisions.
- **Estimated time added:** +2-3 min (post-interview)
- **Config:** `{ auto_summary: true, require_evidence: true }`

### 5.5 Data Privacy (GDPR / Local Regulations)
- **Label:** `data_privacy`
- **Description:** Inform the candidate about data processing, recording consent, and data retention policies as required by local law.
- **AI Coach behavior:** At the start, prompt: "Inform the candidate that the interview may be recorded/transcribed and ask for consent." Track whether consent was obtained. Remind about data deletion policies if candidate asks.
- **Estimated time added:** +1-2 min
- **Config:** `{ requires_consent: true, mention_recording: true, jurisdiction: "RU" | "EU" | "US" }`

---

## 6. INTERVIEW METHODOLOGIES (Reference)

These are not goals themselves, but methodological frameworks that goals can reference.

### 6.1 STAR Method (Situation-Task-Action-Result)
- **Use with:** `assess_soft_skills`, `assess_leadership`
- **How it works:** Ask the candidate to describe a specific past Situation, their Task/role, the Actions they took, and the Result achieved.
- **Time allocation:** Situation (20%), Task (10%), Action (60%), Result (10%)
- **AI Coach tip:** If candidate skips the Result, prompt recruiter to ask: "What was the outcome?"

### 6.2 Behavioral Interviewing
- **Use with:** `assess_soft_skills`, `assess_leadership`, `assess_problem_solving`
- **How it works:** Based on the premise that past behavior predicts future performance. All questions reference real past experiences.
- **Key phrases:** "Tell me about a time when...", "Give me an example of...", "Describe a situation where..."
- **AI Coach tip:** Flag hypothetical answers — "Candidate is speaking theoretically. Redirect: Can you give a specific example?"

### 6.3 Situational Interviewing
- **Use with:** `assess_problem_solving`, `assess_soft_skills`
- **How it works:** Hypothetical future-oriented questions. Good for junior candidates with limited experience.
- **Key phrases:** "What would you do if...", "How would you handle...", "Imagine that..."
- **AI Coach tip:** Best combined with behavioral questions. Use situational when candidate lacks relevant past experience.

### 6.4 Topgrading (Chronological In-Depth)
- **Use with:** `map_career_trajectory`, `verify_resume`
- **How it works:** Walk through the candidate's entire career chronologically. For each position, ask: what were you hired to do, what did you accomplish, what mistakes did you make, who was your boss and what would they say about you.
- **Duration:** 2-4 hours (full), 45-60 min (abbreviated)
- **AI Coach tip:** Track which positions have been covered. Ensure consistency of questions across positions.

### 6.5 Case Interview
- **Use with:** `assess_problem_solving`
- **How it works:** Present a business or technical problem. Evaluate the candidate's analytical framework, structured thinking, and ability to reach conclusions with limited data.
- **Duration:** 20-40 min per case
- **AI Coach tip:** Prompt recruiter to observe process, not just answer. Note if candidate asks clarifying questions (good sign).

### 6.6 Competency-Based Interview
- **Use with:** `assess_hard_skills_deep`, `assess_soft_skills`, `assess_leadership`
- **How it works:** Questions mapped directly to specific, predefined competencies required for the role. Each competency has defined "poor/average/excellent" answer anchors.
- **AI Coach tip:** Display competency rubric. After each answer, prompt recruiter to rate against the anchors.

### 6.7 Stress Interview
- **Use with:** `assess_problem_solving` (use sparingly)
- **How it works:** Deliberately create pressure — rapid-fire questions, challenging assertions, silence. Tests composure and resilience.
- **AI Coach tip:** Monitor carefully. Flag if stress becomes excessive or disrespectful. Not recommended for most roles.

### 6.8 Panel Interview
- **Use with:** Any assessment goal
- **How it works:** Multiple interviewers, one candidate. Reduces individual bias, provides multiple perspectives.
- **AI Coach tip:** If panel is detected, coordinate question allocation so topics don't repeat. Remind each panelist to score independently before debriefing.

### 6.9 Structured Scoring (BARS / BOS)
- **Use with:** `capture_scorecard`, `process_consistency`
- **How it works:** Behaviorally Anchored Rating Scales define what 1/2/3/4/5 looks like for each competency with concrete behavioral examples.
- **AI Coach tip:** After each answer, show the relevant BARS anchors and prompt for a rating.

---

## 7. GOAL PRESETS BY INTERVIEW STAGE

Ready-made goal configurations for common interview stages.

### 7.1 Phone Screening (30 min)
```json
{
  "goals": [
    { "type": "assess_hard_skills_screening", "enabled": true },
    { "type": "assess_motivation", "enabled": true },
    { "type": "collect_logistics", "enabled": true },
    { "type": "pipeline_status", "enabled": true },
    { "type": "sell_the_role", "enabled": true },
    { "type": "time_management", "config": { "max_min": 30, "warn_min": 23 } },
    { "type": "proper_opening", "enabled": true },
    { "type": "proper_closing", "enabled": true },
    { "type": "legal_compliance", "enabled": true }
  ]
}
```

### 7.2 Technical Deep-Dive (60 min)
```json
{
  "goals": [
    { "type": "assess_hard_skills_deep", "enabled": true },
    { "type": "assess_problem_solving", "enabled": true },
    { "type": "verify_resume", "enabled": true },
    { "type": "show_competence", "enabled": true },
    { "type": "time_management", "config": { "max_min": 60, "warn_min": 50 } },
    { "type": "pacing_control", "config": { "max_min_per_section": 15 } },
    { "type": "capture_scorecard", "enabled": true },
    { "type": "proper_closing", "enabled": true }
  ]
}
```

### 7.3 Cultural Fit / Hiring Manager (45 min)
```json
{
  "goals": [
    { "type": "assess_cultural_fit", "enabled": true },
    { "type": "assess_soft_skills", "config": { "style": "STAR" } },
    { "type": "assess_leadership", "enabled": true },
    { "type": "assess_motivation", "enabled": true },
    { "type": "sell_the_role", "enabled": true },
    { "type": "build_rapport", "enabled": true },
    { "type": "candidate_experience", "enabled": true },
    { "type": "time_management", "config": { "max_min": 45, "warn_min": 35 } },
    { "type": "bias_mitigation", "enabled": true }
  ]
}
```

### 7.4 Final Round / Closing (45 min)
```json
{
  "goals": [
    { "type": "decision_criteria", "enabled": true },
    { "type": "counter_offer_risk", "enabled": true },
    { "type": "pipeline_status", "enabled": true },
    { "type": "collect_logistics", "enabled": true },
    { "type": "sell_the_role", "enabled": true },
    { "type": "represent_values", "enabled": true },
    { "type": "candidate_experience", "enabled": true },
    { "type": "proper_closing", "enabled": true },
    { "type": "time_management", "config": { "max_min": 45, "warn_min": 35 } }
  ]
}
```

### 7.5 Recruiter Screening (Russian market, 30 min)
```json
{
  "goals": [
    { "type": "assess_hard_skills_screening", "enabled": true },
    { "type": "assess_motivation", "enabled": true },
    { "type": "collect_logistics", "config": { "items": ["salary", "notice_period", "english_level", "work_format"] } },
    { "type": "detect_red_flags", "config": { "watch": ["overemployment", "job_hopping"] } },
    { "type": "competitor_intel", "enabled": true },
    { "type": "sell_the_role", "enabled": true },
    { "type": "show_competence", "enabled": true },
    { "type": "time_management", "config": { "max_min": 30, "warn_min": 23 } },
    { "type": "legal_compliance", "config": { "jurisdiction": "RU" } },
    { "type": "data_privacy", "config": { "requires_consent": true } }
  ]
}
```

---

## 8. MAPPING: Current Engine Goal Types -> New Catalog

| Current `type` in code | Maps to catalog goal | Status |
|---|---|---|
| `hard_skills` | `assess_hard_skills_deep` + `assess_hard_skills_screening` | Split into two levels |
| `soft_skills` | `assess_soft_skills` | Same, enhanced config |
| `competitor_research` | `competitor_intel` | Renamed, expanded |
| `time_saving` | `time_management` | Renamed, same logic |
| `overemployment` | `detect_red_flags` (subtype) | Merged into broader goal |
| `show_competence` | `show_competence` | Same |
| `checklist` | `collect_logistics` / generic checklist | Specialized into typed goals |
| -- | `assess_cultural_fit` | **NEW** |
| -- | `assess_motivation` | **NEW** |
| -- | `assess_leadership` | **NEW** |
| -- | `assess_problem_solving` | **NEW** |
| -- | `assess_communication` | **NEW** |
| -- | `verify_resume` | **NEW** |
| -- | `sell_the_role` | **NEW** |
| -- | `candidate_experience` | **NEW** |
| -- | `build_rapport` | **NEW** |
| -- | `represent_values` | **NEW** |
| -- | `understand_current_situation` | **NEW** |
| -- | `map_career_trajectory` | **NEW** |
| -- | `counter_offer_risk` | **NEW** |
| -- | `decision_criteria` | **NEW** |
| -- | `pipeline_status` | **NEW** |
| -- | `legal_compliance` | **NEW** |
| -- | `process_consistency` | **NEW** |
| -- | `bias_mitigation` | **NEW** |
| -- | `documentation` | **NEW** |
| -- | `data_privacy` | **NEW** |
| -- | `structured_format` | **NEW** |
| -- | `pacing_control` | **NEW** |
| -- | `capture_scorecard` | **NEW** |
| -- | `proper_opening` | **NEW** |
| -- | `proper_closing` | **NEW** |

---

## 9. PRIORITY / COMPLEXITY MATRIX

For implementation planning — which goals deliver the most value and are easiest to implement.

| Goal | Value | Complexity | Implement |
|---|---|---|---|
| `time_management` | HIGH | LOW | Already exists |
| `assess_hard_skills_deep` | HIGH | LOW | Already exists |
| `show_competence` | HIGH | LOW | Already exists |
| `detect_red_flags` | HIGH | MEDIUM | Partially exists |
| `collect_logistics` | HIGH | LOW | Checklist variant exists |
| `assess_soft_skills` | HIGH | LOW | Already exists |
| `legal_compliance` | HIGH | MEDIUM | Pattern matching on recruiter speech |
| `sell_the_role` | HIGH | LOW | Checklist + reminders |
| `proper_opening` | MEDIUM | LOW | Timed checklist |
| `proper_closing` | MEDIUM | LOW | Timed checklist |
| `assess_motivation` | HIGH | MEDIUM | Keyword detection + LLM analysis |
| `competitor_intel` | MEDIUM | LOW | Already exists |
| `pacing_control` | MEDIUM | MEDIUM | Requires section time tracking |
| `verify_resume` | HIGH | HIGH | Needs CV parsing + question generation |
| `candidate_experience` | MEDIUM | HIGH | Needs talk ratio analysis + tone detection |
| `assess_cultural_fit` | MEDIUM | HIGH | Needs LLM for nuanced evaluation |
| `bias_mitigation` | MEDIUM | HIGH | Needs sophisticated pattern detection |
| `counter_offer_risk` | MEDIUM | MEDIUM | Keyword + sentiment analysis |
| `capture_scorecard` | MEDIUM | MEDIUM | UI + scoring integration |

---

## Sources

- [SHRM: Transform Interviewing into Strategic Talent Selection](https://www.shrm.org/topics-tools/tools/toolkits/transform-interviewing-into-strategic-talent-selection)
- [Recruiterflow: Candidate Assessment in 2026](https://recruiterflow.com/blog/candidate-assessment/)
- [Metaview: Assessing Candidate Responses](https://www.metaview.ai/resources/blog/assess-candidate-responses)
- [Metaview: Interview Rubrics](https://www.metaview.ai/resources/blog/interview-rubrics)
- [Criteria Corp: Complete Guide to Structured Interviews](https://www.criteriacorp.com/resources/complete-guide-to-structured-interviews)
- [EEOC: Prohibited Employment Policies/Practices](https://www.eeoc.gov/prohibited-employment-policiespractices)
- [EEOC: What Shouldn't I Ask When Hiring](https://www.eeoc.gov/employers/small-business/what-shouldnt-i-ask-when-hiring)
- [MIT CAPD: STAR Method for Behavioral Interviews](https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/)
- [Goldbeck: The Job Interview Process Structure](https://goldbeck.com/blog/the-job-interview-process-structure-stages-and-best-practices/)
- [DDI: How to Interview for Motivational Fit](https://www.ddi.com/blog/motivational-fit)
- [Talogy: What is Motivational Fit](https://talogy.com/en/blog/what-is-motivational-fit-and-is-it-really-important-in-hiring/)
- [Recruiting Toolbox: How to Assess If a Candidate Is Actually Motivated](https://blog.recruitingtoolbox.com/blog/how-to-assess-if-a-candidate-is-actually-motivated-to-do-a-great-job)
- [Adaface: Topgrading Interview Guide](https://www.adaface.com/blog/topgrading-interview/)
- [Top Stack: How Interview Practices Shape Employer Brand](https://topstackgroup.com/how-interview-practices-shape-employer-brand/)
- [AIHR: Interview Rubric](https://www.aihr.com/blog/interview-rubric/)
- [Indeed: Interview Rubrics](https://www.indeed.com/hire/c/info/interview-rubrics)
- [VidCruiter: Illegal Interview Questions](https://vidcruiter.com/interview/structured/scorecard/)
- [JobTwine: DEI in Hiring Strategies](https://www.jobtwine.com/blog/dei-in-hiring-strategies/)
- [Diversio: DEI Recruiting Strategy](https://diversio.com/dei-recruiting-strategy/)
