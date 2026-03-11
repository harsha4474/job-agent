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

async function fetchJSearchJobs(keyword) {
  try {
    var response = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: { query: keyword + ' USA', page: '1', num_pages: '2', date_posted: 'today' },
      headers: { 'X-RapidAPI-Key': process.env.JSEARCH_API_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }
    });
    return (response.data.data || []).map(function(job) {
      return {
        title: job.job_title || '',
        company: job.employer_name || '',
        location: job.job_city ? job.job_city + ', ' + job.job_state : (job.job_is_remote ? 'Remote' : 'USA'),
        salary: job.job_min_salary ? '$' + Math.round(job.job_min_salary/1000) + 'K - $' + Math.round(job.job_max_salary/1000) + 'K' : 'Not listed',
        description: (job.job_description || '').substring(0, 500),
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

async function fetchRemotiveJobs() {
  try {
    var response = await axios.get('https://remotive.com/api/remote-jobs', { params: { category: 'product-management', limit: 50 } });
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

async function fetchJobicyJobs() {
  try {
    var response = await axios.get('https://jobicy.com/api/v2/remote-jobs', { params: { count: 50, tag: 'product manager' } });
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

function deduplicateJobs(jobs) {
  var seen = new Set();
  return jobs.filter(function(job) {
    var key = job.title.toLowerCase().trim() + '||' + job.company.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterRelevantJobs(jobs) {
  var excludeKeywords = [
    'marketing manager', 'sales manager', 'account manager', 'project manager',
    'hr manager', 'office manager', 'store manager', 'supply chain',
    'logistics', 'warehouse', 'driver', 'nurse', 'teacher',
    'data engineer', 'software engineer', 'devops', 'designer', 'actuary'
  ];
  return jobs.filter(function(job) {
    var titleLower = job.title.toLowerCase();
    return !excludeKeywords.some(function(k) { return titleLower.includes(k); });
  });
}

async function scoreJobs(jobs) {
  var resumeSummary = [
    'Candidate: ' + RESUME.name,
    'Experience: 7+ years B2B SaaS Product Management',
    'Achievements: $580K revenue, 40% MAU growth, 18pt NPS improvement, 0-to-1 launches',
    'AI: Built OpenAI API products, agentic workflows, LLM product dev',
    'Skills: Roadmap, PLG, GTM, agile, user research, A/B testing, stakeholder mgmt',
    'Tech: REST APIs, SQL, Jira, Figma, Next.js, Supabase, OpenAI API',
    'Certs: CSPO, PMI, Pendo, Aha!',
    'Education: MS Information Studies (Trine University)',
    'Target: PM at B2B SaaS, AI startups, enterprise software in USA'
  ].join('\n');

  var scoredJobs = [];
  var batchSize = 10;

  for (var i = 0; i < jobs.length; i += batchSize) {
    var batch = jobs.slice(i, i + batchSize);
    var jobList = batch.map(function(job, idx) {
      return 'Job ' + (idx+1) + ': "' + job.title + '" at ' + job.company + ' (' + job.location + ')\n' + job.description.substring(0, 300);
    }).join('\n\n');

    try {
      var response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Score each job 0-100 match for this candidate.\n\nCANDIDATE:\n' + resumeSummary + '\n\nSCORING: 85-100=Perfect, 70-84=Strong, 55-69=Decent, 40-54=Weak, 0-39=Poor\n\nJOBS:\n' + jobList + '\n\nReturn ONLY a JSON array like: [85, 72, 90]\nNo explanation, just the array.' }],
        temperature: 0.2,
        max_tokens: 100
      });
      var text = response.choices[0].message.content.trim();
      var match = text.match(/\[[\d,\s]+\]/);
      if (match) {
        var scores = JSON.parse(match[0]);
        batch.forEach(function(job, idx) {
          scoredJobs.push(Object.assign({}, job, { matchScore: scores[idx] || 50 }));
        });
      } else {
        batch.forEach(function(job) { scoredJobs.push(Object.assign({}, job, { matchScore: 50 })); });
      }
    } catch (err) {
      console.error('Scoring error:', err.message);
      batch.forEach(function(job) { scoredJobs.push(Object.assign({}, job, { matchScore: 50 })); });
    }

    if (i + batchSize < jobs.length) {
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
  }
  return scoredJobs;
}

async function runJobAgent() {
  console.log('🤖 Job Agent starting...');
  console.log('📡 Fetching jobs from all sources...');

  var jsearchResults = [];
  for (var i = 0; i < SEARCH_KEYWORDS.length; i++) {
    var results = await fetchJSearchJobs(SEARCH_KEYWORDS[i]);
    jsearchResults = jsearchResults.concat(results);
    console.log('  ✓ JSearch "' + SEARCH_KEYWORDS[i] + '": ' + results.length + ' jobs');
    await new Promise(function(r) { setTimeout(r, 5000); });
  }

  var remotiveResults = await fetchRemotiveJobs();
  console.log('  ✓ Remotive: ' + remotiveResults.length + ' jobs');

  var jobicyResults = await fetchJobicyJobs();
  console.log('  ✓ Jobicy: ' + jobicyResults.length + ' jobs');

  var allJobs = jsearchResults.concat(remotiveResults).concat(jobicyResults);
  console.log('📦 Total fetched: ' + allJobs.length);

  var filtered = filterRelevantJobs(allJobs);
  console.log('🔍 After filter: ' + filtered.length);

  var unique = deduplicateJobs(filtered);
  console.log('🔄 After dedup: ' + unique.length);

  var valid = unique.filter(function(j) { return j.applyLink && j.title; });
  console.log('✅ Valid jobs: ' + valid.length);

  console.log('🧠 Scoring jobs...');
  var scored = await scoreJobs(valid);

  var top50 = scored.sort(function(a, b) { return b.matchScore - a.matchScore; }).slice(0, 50);
  console.log('🏆 Top 50. Score range: ' + top50[top50.length-1].matchScore + ' - ' + top50[0].matchScore);

  return top50;
}

module.exports = { runJobAgent };
