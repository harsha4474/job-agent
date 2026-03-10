const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const { runFullAgent } = require('./scheduler');
const RESUME = require('./resume');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.get('/tailor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tailor.html'));
});

// ─── Resume Tailor Endpoint ───────────────────────────────────────────────────
app.post('/tailor-resume', async (req, res) => {
  const { jobDescription, jobTitle, company } = req.body;

  if (!jobDescription) {
    return res.status(400).json({ error: 'Job description is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `You are an expert resume writer for Product Managers. Tailor this resume for the specific job below.

ORIGINAL RESUME:
Name: ${RESUME.name}
Summary: ${RESUME.summary}

Experience:
${RESUME.experience.map(exp => `
${exp.title} at ${exp.company} (${exp.duration})
${exp.bullets.map(b => `• ${b}`).join('\n')}
`).join('\n')}

Skills: ${Object.values(RESUME.skills).flat().join(', ')}
Certifications: ${RESUME.certifications.join(', ')}

TARGET JOB:
Title: ${jobTitle || 'Product Manager'}
Company: ${company || 'Company'}
Job Description: ${jobDescription}

INSTRUCTIONS:
1. Rewrite the summary (3-4 sentences) to directly match this role
2. Reorder and rewrite the top 5-6 bullet points from experience to match the JD keywords
3. Highlight the most relevant skills for this specific role
4. Keep all metrics and numbers intact
5. Do NOT fabricate any experience or metrics
6. Return as clean formatted text with sections clearly labeled

Format:
SUMMARY:
[tailored summary]

KEY EXPERIENCE HIGHLIGHTS:
[top 6 most relevant bullets]

RELEVANT SKILLS:
[skills matching this JD]

WHY I'M A STRONG FIT:
[2-3 sentences explaining the match]`
      }],
      temperature: 0.5,
      max_tokens: 1500
    });

    const tailoredContent = response.choices[0].message.content;
    res.json({ tailoredResume: tailoredContent });

  } catch (err) {
    console.error('Resume tailor error:', err.message);
    res.status(500).json({ error: 'Failed to tailor resume' });
  }
});

// ─── Manual trigger endpoint ──────────────────────────────────────────────────
app.post('/run-agent', async (req, res) => {
  res.json({ message: 'Agent started! Check your email and Google Sheet in a few minutes.' });
  runFullAgent();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'running', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Job Agent server running at http://localhost:${PORT}`);
});