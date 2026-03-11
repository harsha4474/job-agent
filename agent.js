const axios = require('axios');
const OpenAI = require('openai');
const RESUME = require('./resume');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Keywords to search ───────────────────────────────────────────────────────
const SEARCH_KEYWORDS = [
  'Product Manager B2B SaaS',
  'AI Product Manager',
  'Senior Product Manager SaaS',
  'Associate Product Manager',
  'Product Manager Growth',
  'Technical Product Manager',
  'Product Manager remote',
  'Product Manager AI ML',
  // Broader searches that match your background
  'Product Lead SaaS',
  'Product Owner agile',
  'Growth Product Manager',
  'Platform Product Manager',
  'Product Manager fintech',
  'Product Manager startup',
  'Product Manager OpenAI',
  'Product Manager LLM AI'
];

// ─── Fetch from JSearch ───────────────────────────────────────────────────────
async function fetchJSearchJobs(keyword) {
  try {
    const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query: `${keyword} USA`,
        page: '1',
        num_pages: '2',
        date_posted: 'today'
      },
      headers: {
        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });
    return (response.data.data || []).map(job => ({
      title: job.job_title || '',
      company: job.employer_name || '',
      location: job.job_city ? `${job.job_city}, ${job.job_state}` : (job.job_is_remote ? 'Remote' : 'USA'),
      salary: job.job_min_salary ? `$${Math.round(job.job_min_salary/1000)}K - $${Math.round(job.job_max_salary/1000)}K` : 'Not listed',
      description: job.job_description || '',
      applyLink: job.job_apply_link || job.job_google_link || '',
      source: 'JSearch',
      postedDate: job.job_posted_at_datetime_utc || ''
    }));
  } catch (err) {
    console.error(`JSearch error for "${keyword}":`, err.message);
    return [];
  }
}

// ─── Fetch from Remotive ──────────────────────────────────────────────────────
async function fetchRemotiveJobs() {
  try {
    const response = await axios.get('https://remotive.com/api/remote-jobs', {
      params: { category: 'product-management', limit: 50 }
    });
    return (response.data.jobs || []).map(job => ({
      title: job.title || '',
      company: job.company_name || '',
      location: 'Remote',
      salary: job.salary || 'Not listed',
      description: job.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
      applyLink: job.url || '',
      source: 'Remotive',
      postedDate: job.publication_date || ''
    }));
  } catch (err) {
    console.error('Remotive error:', err.message);
    return [];
  }
}

// ─── Deduplicate ──────────────────────────────────────────────────────────────
function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Filter out irrelevant roles ──────────────────────────────────────────────
function filterRelevantJobs(jobs) {
  const includeKeywords = [
  const SEARCH_KEYWORDS = [
  'AI Product Manager',
  'Associate Product Manager',
  'Product Manager Growth',
  'Technical Product Manager',
  'Product Manager AI ML',
  'Product Owner agile',
  'Growth Product Manager',
  'Platform Product Manager'
];
];
  const excludeKeywords = [
    'marketing manager', 'sales manager', 'account manager', 'project manager',
    'hr manager', 'operations manager', 'office manager', 'store manager',
    'supply chain', 'logistics', 'warehouse', 'driver', 'nurse', 'teacher'
  ];

  return jobs.filter(job => {
    const titleLower = job.title.toLowerCase();
    const hasInclude = includeKeywords.some(k => titleLower.includes(k));
    const hasExclude = excludeKeywords.some(k => titleLower.includes(k));
    return hasInclude && !hasExclude;
  });
}

// ─── Score jobs with GPT-4o ───────────────────────────────────────────────────
async function scoreJobs(jobs) {
  const resumeSummary = `
    Candidate: ${RESUME.name}
    Experience: 7+ years in B2B SaaS Product Management
    Current Level: Senior PM / PM
    Key Achievements: $580K revenue growth, 40% MAU growth, 18-point NPS improvement, 0-to-1 product launches
    AI Experience: Built OpenAI API-integrated products, AI agent architecture, LLM product development
    Core Skills: Product roadmap, PLG, GTM strategy, agile, user research, stakeholder management, A/B testing, funnel optimization
    Technical: REST APIs, SQL, Jira, Figma, Next.js, Supabase, OpenAI API
    Certifications: CSPO, PMI, Pendo, Aha!
    Education: MS Information Studies (Trine University)
    Target: PM roles at B2B SaaS, AI startups, scaleups, enterprise software companies in USA
  `;

  const batchSize = 10;
  const scoredJobs = [];

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const jobList = batch.map((job, idx) =>
      `Job ${idx + 1}: "${job.title}" at ${job.company} (${job.location})\nDescription: ${job.description.substring(0, 300)}`
    ).join('\n\n');

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `You are an expert PM recruiter. Score how well each job matches this candidate on a scale of 0-100.

CANDIDATE:
${resumeSummary}

SCORING CRITERIA:
- 85-100: Perfect match — PM role at AI/SaaS company, matches seniority, relevant domain
- 70-84: Strong match — PM role, most skills align, good company type
- 55-69: Decent match — PM role but some gaps (wrong industry, level mismatch)
- 40-54: Weak match — tangentially related role
- 0-39: Poor match — not relevant

JOBS:
${jobList}

Return ONLY a JSON array of scores like: [85, 72, 90, 65, 78, 55, 88, 70, 60, 82]
No explanation, just the array.`
        }],
        temperature: 0.2,
        max_tokens: 100
      });

      const text = response.choices[0].message.content.trim();
      const scoresMatch = text.match(/\[[\d,\s]+\]/);
      if (scoresMatch) {
        const scores = JSON.parse(scoresMatch[0]);
        batch.forEach((job, idx) => {
          scoredJobs.push({ ...job, matchScore: scores[idx] || 50 });
        });
      } else {
        batch.forEach(job => scoredJobs.push({ ...job, matchScore: 50 }));
      }
    } catch (err) {
      console.error('Scoring error:', err.message);
      batch.forEach(job => scoredJobs.push({ ...job, matchScore: 50 }));
    }

    if (i + batchSize < jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return scoredJobs;
}

// ─── Main agent function ──────────────────────────────────────────────────────
async function runJobAgent() {
  console.log('🤖 Job Agent starting...');
  console.log('📡 Fetching jobs from all sources...');

  // Sequential JSearch calls to avoid rate limiting
  const jsearchResults = [];
  for (const keyword of SEARCH_KEYWORDS) {
    const results = await fetchJSearchJobs(keyword);
    jsearchResults.push(...results);
    console.log(`  ✓ "${keyword}": ${results.length} jobs`);
    await new Promise(r => setTimeout(r, 2000));
  }

  // Remotive (free, no rate limit)
  const remotiveResults = await fetchRemotiveJobs();
  console.log(`  ✓ Remotive: ${remotiveResults.length} jobs`);

  const allJobs = [...jsearchResults, ...remotiveResults];
  console.log(`📦 Total fetched: ${allJobs.length}`);

  // Filter to PM roles only
  const filteredJobs = filterRelevantJobs(allJobs);
  console.log(`🔍 After PM filter: ${filteredJobs.length} jobs`);

  // Deduplicate
  const uniqueJobs = deduplicateJobs(filteredJobs);
  console.log(`🔄 After dedup: ${uniqueJobs.length} unique jobs`);

  // Keep only jobs with apply links
  const validJobs = uniqueJobs.filter(j => j.applyLink && j.title);
  console.log(`✅ Valid jobs: ${validJobs.length}`);

  // Score against resume
  console.log('🧠 Scoring jobs against your resume...');
  const scoredJobs = await scoreJobs(validJobs);

  // Sort and take top 50
  const top50 = scoredJobs
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 50);

  console.log(`🏆 Top 50 selected. Score range: ${top50[top50.length-1]?.matchScore} - ${top50[0]?.matchScore}`);
  return top50;
}

module.exports = { runJobAgent };