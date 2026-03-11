# AI Job Search Agent

An autonomous AI agent that searches job boards daily, scores every listing against your resume using GPT-4o, updates a Google Sheet tracker, sends a ranked email digest, and lets you tailor your resume to any job on demand.

**Live → [job-agent-6clk.onrender.com](https://job-agent-6clk.onrender.com)**  
**Resume Tailor → [job-agent-6clk.onrender.com/tailor.html](https://job-agent-6clk.onrender.com/tailor.html)**

---

## The Problem

Job searching is a full-time job. Finding relevant roles across multiple boards, ranking them, and tailoring a resume for each application takes 2–3 hours daily. Most of that is repetitive.

This agent automates all of it.

---

## What It Does

**Every day at 6 PM EST, automatically:**

1. Searches JSearch (LinkedIn, Indeed, ZipRecruiter, Glassdoor), Remotive, and Jobicy for PM roles
2. Filters out irrelevant listings (engineering, sales, operations)
3. Deduplicates across all previous runs — never shows the same job twice
4. Scores every job 0–100 against your resume using GPT-4o
5. Selects top 50 ranked matches
6. Appends them to a Google Sheet with status tracking
7. Sends an email digest with apply links and match scores

**On demand via Resume Tailor:**

1. Paste any job description
2. GPT-4o rewrites your resume sections to match the role
3. Download as PDF

---

## Screenshots

| Google Sheet Tracker | Email Digest | Resume Tailor |
|---|---|---|
| Daily batches with scores | Ranked job cards | Light editorial UI |

---

## Architecture

```
node-cron (6 PM EST daily)
         │
         ▼
   Job Fetcher
   ├── JSearch API (LinkedIn, Indeed, ZipRecruiter, Glassdoor)
   ├── Remotive API (remote PM roles)
   └── Jobicy API (remote roles)
         │
         ▼
   Filter + Dedup
   ├── PM role filter (exclude non-PM titles)
   └── Persistent dedup (seen_jobs.json — never repeats)
         │
         ▼
   GPT-4o Scorer
   └── Scores each job 0-100 vs resume
         │
         ▼
   Top 50 Selected
         │
    ┌────┴────┐
    ▼         ▼
Google     SendGrid
Sheets     Email
Tracker    Digest
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| AI Scoring | OpenAI GPT-4o |
| Job Sources | JSearch API (RapidAPI), Remotive, Jobicy |
| Sheet Integration | Google Sheets API v4 |
| Email | SendGrid |
| Scheduler | node-cron |
| Deduplication | Persistent JSON file (seen_jobs.json) |
| Deploy | Render |

---

## Google Sheet Features

- Frozen header row
- Batch separator rows with run stats
- Status dropdown per job: `Not Applied / Interested / Applied / Interview / Offer / Skip`
- One-click Tailor Resume link per job
- Append-only — full history preserved

---

## Running Locally

```bash
git clone https://github.com/harsha4474/job-agent
cd job-agent
npm install
```

Create `.env`:
```
OPENAI_API_KEY=
JSEARCH_API_KEY=
SENDGRID_API_KEY=
GMAIL_USER=
RECIPIENT_EMAIL=
GOOGLE_SHEET_ID=
GOOGLE_CREDENTIALS=   # only needed on Render — locally use credentials.json
```

Add your Google Service Account `credentials.json` to the project root.

**Start scheduler (runs daily at 6 PM, type "test" to trigger manually):**
```bash
node scheduler.js
```

**Start web server (Resume Tailor UI):**
```bash
node server.js
```

Open [http://localhost:3001/tailor.html](http://localhost:3001/tailor.html)

**Trigger manually via API:**
```bash
curl -X POST http://localhost:3001/run-agent
```

**Reset seen jobs (fresh start):**
```bash
curl -X POST http://localhost:3001/reset-seen
```

---

## Deploying to Render

1. Push to GitHub
2. Create a new Web Service on Render connected to this repo
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add all environment variables in the Render dashboard
6. For `GOOGLE_CREDENTIALS`: run `node -e "console.log(JSON.stringify(fs.readFileSync('./credentials.json','utf8')))"` and paste the output

---

## Key Design Decisions

**Why GPT-4o for scoring instead of keyword matching?**  
Keyword matching misses context. GPT-4o understands that "0-to-1 product experience" is relevant to a "Founding PM" role even if the words don't match exactly.

**Why persistent file-based dedup instead of database?**  
Simplicity. A JSON file on Render's filesystem survives restarts, requires zero infrastructure, and handles 2000+ job keys with negligible overhead.

**Why SendGrid instead of Gmail SMTP?**  
Gmail blocks SMTP from cloud servers due to DMARC policy. SendGrid routes around this reliably.

---

## What's Next

- [ ] Slack notification option
- [ ] Target company watchlist (monitor specific company career pages)
- [ ] Weekly application tracker summary
- [ ] Interview prep generator per job

---

**Built by A.V.S Sri Harsha** — AI PM | [LinkedIn](https://www.linkedin.com/in/avs-sri-harsha) | [PRD Generator →](https://github.com/harsha4474/prd-generator)
