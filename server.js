const express = require('express');
const path = require('path');
require('dotenv').config();

const { runJobAgent } = require('./agent');
const { updateSheet } = require('./sheets');
const { sendEmailDigest } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cross-batch dedup (resets on server restart)
const seenJobKeys = new Set();

app.get('/health', (req, res) => {
  res.json({ status: 'running', time: new Date().toISOString() });
});

app.post('/run-agent', async (req, res) => {
  res.json({ message: 'Agent started! Check your email and Google Sheet in a few minutes.' });
  try {
    console.log('\n🚀 Starting job search agent run...');
    console.log('⏰ Time: ' + new Date().toLocaleString());

    const allJobs = await runJobAgent();

    // Deduplicate against previously seen jobs this session
    const newJobs = allJobs.filter(function(job) {
      var key = job.title.toLowerCase().trim() + '||' + job.company.toLowerCase().trim();
      if (seenJobKeys.has(key)) return false;
      seenJobKeys.add(key);
      return true;
    });

    console.log('🆕 New jobs (cross-batch dedup): ' + newJobs.length);

    if (newJobs.length === 0) {
      console.log('✅ No new jobs — all already tracked.');
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
});

app.post('/tailor-resume', async (req, res) => {
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

app.listen(PORT, function() {
  console.log('✅ Job Agent server running at http://localhost:' + PORT);
});
