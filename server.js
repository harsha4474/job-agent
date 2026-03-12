const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

const { runJobAgent } = require('./agent');
const { updateSheet } = require('./sheets');
const { sendEmailDigest } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Persistent dedup ─────────────────────────────────────
const SEEN_FILE = path.join(__dirname, 'seen_jobs.json');

function loadSeenJobs() {
  try {
    if (fs.existsSync(SEEN_FILE)) {
      var data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
      return new Set(data);
    }
  } catch (e) {
    console.error('Could not load seen_jobs.json:', e.message);
  }
  return new Set();
}

function saveSeenJobs(seenSet) {
  try {
    fs.writeFileSync(SEEN_FILE, JSON.stringify(Array.from(seenSet)), 'utf8');
  } catch (e) {
    console.error('Could not save seen_jobs.json:', e.message);
  }
}

function pruneSeenJobs(seenSet, maxSize) {
  if (seenSet.size > maxSize) {
    var arr = Array.from(seenSet);
    var trimmed = arr.slice(arr.length - maxSize);
    return new Set(trimmed);
  }
  return seenSet;
}

// ─── Core agent runner ────────────────────────────────────
async function runAgent() {
  try {
    console.log('\n🚀 Starting job search agent run...');
    console.log('⏰ Time: ' + new Date().toLocaleString());

    var allJobs = await runJobAgent();

    var seenKeys = loadSeenJobs();
    var beforeCount = seenKeys.size;

    var newJobs = allJobs.filter(function(job) {
      var key = job.title.toLowerCase().trim() + '||' + job.company.toLowerCase().trim();
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    console.log('🔎 Seen jobs tracked: ' + beforeCount);
    console.log('🆕 New jobs this run: ' + newJobs.length);

    seenKeys = pruneSeenJobs(seenKeys, 2000);
    saveSeenJobs(seenKeys);

    if (newJobs.length === 0) {
      console.log('✅ No new jobs found — skipping sheet + email.');
      return;
    }

    var sheetUrl = await updateSheet(newJobs);
    await sendEmailDigest(newJobs, sheetUrl);

    console.log('✅ Agent run complete!');
    console.log('📊 Sheet: ' + sheetUrl);
    console.log('📧 Email sent to: ' + process.env.RECIPIENT_EMAIL);

  } catch (err) {
    console.error('❌ Agent run failed:', err.message);
  }
}

// ─── Cron: every day at 6 PM EST ─────────────────────────
cron.schedule('0 18 * * *', function() {
  console.log('\n⏰ Cron triggered — 6 PM EST');
  runAgent();
}, { timezone: 'America/New_York' });

console.log('✅ Scheduler running — fires every day at 6:00 PM EST');

// ─── Routes ───────────────────────────────────────────────
app.get('/health', function(req, res) {
  var seen = loadSeenJobs();
  res.json({ status: 'running', time: new Date().toISOString(), seenJobsTracked: seen.size });
});

app.post('/run-agent', async function(req, res) {
  res.json({ message: 'Agent started! Check your email and Google Sheet in a few minutes.' });
  runAgent();
});

app.post('/tailor-resume', async function(req, res) {
  try {
    var jobDescription = req.body.jobDescription;
    var jobTitle = req.body.jobTitle;
    var company = req.body.company;
    if (!jobDescription) return res.status(400).json({ error: 'Job description required' });

    var OpenAI = require('openai');
    var RESUME = require('./resume');
    var openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    var prompt = 'You are an expert PM resume writer.\n\nCANDIDATE RESUME:\n' + JSON.stringify(RESUME) + '\n\nJOB TITLE: ' + (jobTitle || 'Product Manager') + '\nCOMPANY: ' + (company || 'Unknown') + '\nJOB DESCRIPTION:\n' + jobDescription + '\n\nRewrite the resume to strongly match this specific role. Return ONLY these 4 sections:\n\n## PROFESSIONAL SUMMARY\n[3-4 sentences tailored to this role]\n\n## KEY EXPERIENCE HIGHLIGHTS\n[5-6 bullet points from experience most relevant to this JD]\n\n## RELEVANT SKILLS\n[Skills grouped by category, prioritized for this role]\n\n## WHY I AM A STRONG FIT\n[3 specific reasons connecting candidate background to this role]\n\nBe specific, use metrics, mirror the JD language naturally.';

    var response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1500
    });

    res.json({ tailoredResume: response.choices[0].message.content });
  } catch (err) {
    console.error('Tailor error:', err.message);
    res.status(500).json({ error: 'Failed to tailor resume: ' + err.message });
  }
});

app.post('/reset-seen', function(req, res) {
  try {
    fs.writeFileSync(SEEN_FILE, '[]', 'utf8');
    res.json({ message: 'Seen jobs reset. Next run will fetch all jobs fresh.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, function() {
  console.log('✅ Job Agent server running at http://localhost:' + PORT);
});