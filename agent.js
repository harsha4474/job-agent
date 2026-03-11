const axios = require('axios');
const OpenAI = require('openai');
const RESUME = require('./resume');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// ─── Fetch from JSearch ───────────────────────────────────────────────────────
async function fetchJSearchJobs(keyword) {
  try {
    const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query: keyword + ' USA',
        page: '1',
        num_pages: '2',
        date_posted: 'today'
      },
      headers: {
        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });
    return (response.data.data || []).map(function(job) {
      return {
        title: job.job_title || '',
        company: job.employer_name || '',
        location: job.job_city ? job.job_city + ', ' + job.job_state : (job.job_is_remote ? 'Remote' : 'USA'),
        salary: job.job_min_salary ? '$' + Math.round(job.job_min_salary/1000) + 'K - $' + Math.round(job.job_max_salary/1000) + 'K' : 'Not listed',
        description: job.job_description || '',
        applyLink: job.job_apply_link || job.job_google_link || '',
        source: 'JSearch',
        postedDate: job.job_posted_at_datetime_utc || ''
      };
    });
  } catch (err) {
    console.error('JSearch error for "' + keyword + '":', err.message);
    return [];
  }
}

// ─── Fetch from Remotive ──────────────────────────────────────────────────────
async function fetchRemotiveJobs() {
  try {
    const response = await axios.get('https://remotive.com/api/remote-jobs', {
      params: { category: 'product-management', limit: 50 }
    });
    return (response.data.jobs || []).map(function(job) {
      return {
        title: job.title || '',
        company: job.company_name || '',
        location: 'Remote',
        salary: job.salary || 'Not listed',
        description: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 500),
        applyLink: job.url || '',
        source: 'Remotive',
        postedDate: job.publication_date || ''
      };
    });
  } catch (err) {
    console.error('Remotive error:', err.message);
    return [];
  }
}

// ─── Fetch from Jobicy ────────────────────────────────────────────────────────
async function fetchJobicyJobs() {
  try {
    const response = await axios.get('https://jobicy.com/api/v2/remote-jobs', {
      params: { count: 50, tag: 'product manager' }
    });
    return (response.data.jobs || []).map(function(job) {
      return {
        title: job.jobTitle || '',
        company: job.companyName || '',
        location: 'Remote',
        salary: job.annualSalaryMin ? '$' + Math.round(job.annualSalaryMin/1000) + 'K - $' + Math.round(job.annualSalaryMax/1000) + 'K' : 'Not listed',
        description: (job.jobDescription || '').replace(/<[^>]*>/g, '').substring(0, 500),
        applyLink: job.url || '',
        source: 'Jobicy',
        postedDate: job.pubDate || ''
      };
    });
  } catch (err) {
    console.error('Jobicy error:', err.message);
    return [];
  }
}

// ─── Deduplicate ──────────────────────────────────────────────────────────────
function deduplicateJobs(jobs) {
  var seen = new Set();
  return jobs.filter(function(job) {
    var key = job.title.toLowerCase().trim() + '-' + job.company.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Filter to PM roles only ──────────────────────────────────────────────────
function filterRelevantJobs(jobs) {
  var includeKeywords = [
    'product manager', 'product management', 'associate pm', 'apm',
    'senior pm', 'technical pm', 'product lead', 'group product manager',
    'director of product', 'vp product', 'head of product',
    'product owner', 'growth manager', 'platform manager',
    'product strategist', 'product operations'
  ];
  var excludeKeywords = [
    'marketing manager', 'sales manager', 'account manager', 'project manager',
    'hr manager', 'operations manager', 'office manager', 'store manager',
    'supply chain', 'logistics', 'warehouse', 'driver', 'nurse', 'teacher'
  ];

  return jobs.filter(function(job) {
    var titleLower = job.title.toLowerCase();
    var hasInclude = includeKeywords.some(function(k) { return titleLower.includes(k); });
    var hasExclude = excludeKeywords.some(function(k) { return titleLower.includes(k); });
    return hasInclude && !hasExclude;
  });
}

// ─── Score jobs with GPT-4o ───────────────────────────────────────────────────
async function scoreJobs(jobs) {
  var resumeSummary = [
    'Candidate: ' + RESUME.name,
    'Experience: 7+ years in B2B SaaS Product Management',
    'Key Achievements: $580K revenue growth, 40% MAU growth, 18-point NPS improvement, 0-to-1 product launches',
    'AI Experience: Built OpenAI API-integrated products, AI agent architecture, LLM product development',
    'Core Skills: Product roadmap, PLG, GTM strategy, agile, user research, stakeholder management, A/B testing',
    'Technical: REST APIs, SQL, Jira, Figma, Next.js, Supabase, OpenAI API',
    'Certifications: CSPO, PMI, Pendo, Aha!',
    'Education: MS Information Studies (Trine University)',
    'Target: PM roles at B2B SaaS, AI startups, scaleups, enterprise software companies in USA'
  ].join('\n');

  var batchSize = 10;
  var scoredJobs = [];

  for (var i = 0; i < jobs.length; i += batchSize) {
    var batch = jobs.slice(i, i + batchSize);
    var jobList = batch.map(function(job, idx) {
      return 'Job ' + (idx + 1) + ': "' + job.title + '" at ' + job.company + ' (' + job.location + ')\nDescription: ' + job.description.substring(0, 300);
    }).join('\n\n');

    try {
      var response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: 'You are an expert PM recruiter. Score how well each job matches this candidate on a scale of 0-100.\n\nCANDIDATE:\n' + resumeSummary + '\n\nSCORING:\n85-100: Perfect match\n70-84: Strong match\n55-69: Decent match\n40-54: Weak match\n0-39: Poor match\n\nJOBS:\n' + jobList + '\n\nReturn ONLY a JSON array like: [85, 72, 90, 65]\nNo explanation, just the array.'
        }],
        temperature: 0.2,
        max_tokens: 100
      });

      var text = response.choices[0].message.content.trim();
      var scoresMatch = text.match(/\[[\d,\s]+\]/);
      if (scoresMatch) {
        var scores = JSON.parse(scoresMatch[0]);
        batch.forEach(function(job, idx) {
          scoredJobs.push(Object.assign({}, job, { matchScore: scores[idx] || 50 }));
        });
      } else {
        batch.forEach(function(job) {
          scoredJobs.push(Object.assign({}, job, { matchScore: 50 }));
        });
      }
    } catch (err) {
      console.error('Scoring error:', err.message);
      batch.forEach(function(job) {
        scoredJobs.push(Object.assign({}, job, { matchScore: 50 }));
      });
    }

    if (i + batchSize < jobs.length) {
      await new Promise(function(resolve) { setTimeout(resolve, 1000); });
    }
  }

  return scoredJobs;
}

// ─── Main agent function ──────────────────────────────────────────────────────
async function runJobAgent() {
  console.log('Job Agent starting...');
  console.log('Fetching jobs from all sources...');

  // Sequential JSearch calls to avoid rate limiting
  var jsearchResults = [];
  for (var i = 0; i < SEARCH_KEYWORDS.length; i++) {
    var keyword = SEARCH_KEYWORDS[i];
    var results = await fetchJSearchJobs(keyword);
    jsearchResults = jsearchResults.concat(results);
    console.log('  JSearch "' + keyword + '": ' + results.length + ' jobs');
    await new Promise(function(resolve) { setTimeout(resolve, 3000); });
  }

  var remotiveResults = await fetchRemotiveJobs();
  console.log('  Remotive: ' + remotiveResults.length + ' jobs');

  var jobicyResults = await fetchJobicyJobs();
  console.log('  Jobicy: ' + jobicyResults.length + ' jobs');

  var allJobs = jsearchResults.concat(remotiveResults).concat(jobicyResults);
  console.log('Total fetched: ' + allJobs.length);

  var filteredJobs = filterRelevantJobs(allJobs);
  console.log('After PM filter: ' + filteredJobs.length + ' jobs');

  var uniqueJobs = deduplicateJobs(filteredJobs);
  console.log('After dedup: ' + uniqueJobs.length + ' unique jobs');

  var validJobs = uniqueJobs.filter(function(j) { return j.applyLink && j.title; });
  console.log('Valid jobs: ' + validJobs.length);

  console.log('Scoring jobs against your resume...');
  var scoredJobs = await scoreJobs(validJobs);

  var top50 = scoredJobs
    .sort(function(a, b) { return b.matchScore - a.matchScore; })
    .slice(0, 50);

  console.log('Top 50 selected. Score range: ' + top50[top50.length-1].matchScore + ' - ' + top50[0].matchScore);
  return top50;
}

module.exports = { runJobAgent };