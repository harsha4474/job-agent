const nodemailer = require('nodemailer');
require('dotenv').config();

function getScoreColor(score) {
  if (score >= 85) return '#00e5a0';
  if (score >= 70) return '#00d4ff';
  if (score >= 55) return '#f59e0b';
  return '#6b7280';
}

function getScoreLabel(score) {
  if (score >= 85) return '🔥 Excellent Match';
  if (score >= 70) return '✅ Good Match';
  if (score >= 55) return '👀 Potential Match';
  return '📌 Low Match';
}

async function sendEmailDigest(jobs, sheetUrl) {
  const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const topJobs = jobs.slice(0, 50);
  const excellentMatches = topJobs.filter(j => j.matchScore >= 85).length;
  const goodMatches = topJobs.filter(j => j.matchScore >= 70 && j.matchScore < 85).length;

  // Build job rows HTML
  const jobRows = topJobs.map((job, idx) => `
    <tr style="border-bottom: 1px solid #1e2830;">
      <td style="padding: 12px 8px; color: #4a5a6a; font-size: 12px; font-family: monospace;">${idx + 1}</td>
      <td style="padding: 12px 8px;">
        <div style="color: #e8edf2; font-weight: 600; font-size: 13px;">${job.title}</div>
        <div style="color: #8899aa; font-size: 11px; margin-top: 2px;">${job.company}</div>
      </td>
      <td style="padding: 12px 8px; color: #8899aa; font-size: 12px;">${job.location}</td>
      <td style="padding: 12px 8px;">
        <span style="background: ${getScoreColor(job.matchScore)}22; color: ${getScoreColor(job.matchScore)}; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; font-family: monospace;">${job.matchScore}%</span>
      </td>
      <td style="padding: 12px 8px; color: #8899aa; font-size: 11px;">${job.salary}</td>
      <td style="padding: 12px 8px;">
        <a href="${job.applyLink}" style="background: #00d4ff; color: #080b0f; padding: 5px 12px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: 700;">Apply →</a>
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #080b0f; font-family: 'Segoe UI', sans-serif;">
  <div style="max-width: 900px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="background: #0e1318; border: 1px solid #1e2830; border-radius: 16px; padding: 28px 32px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="background: linear-gradient(135deg, #00d4ff, #00e5a0); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px;">⚡</div>
        <div>
          <div style="color: #e8edf2; font-size: 20px; font-weight: 700;">Daily Job Digest</div>
          <div style="color: #4a5a6a; font-size: 12px; font-family: monospace;">${today}</div>
        </div>
      </div>

      <!-- Stats -->
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <div style="background: #141a22; border: 1px solid #1e2830; border-radius: 10px; padding: 14px 20px; flex: 1; min-width: 120px;">
          <div style="color: #00e5a0; font-size: 24px; font-weight: 800; font-family: monospace;">${topJobs.length}</div>
          <div style="color: #8899aa; font-size: 11px; margin-top: 2px;">Total Jobs</div>
        </div>
        <div style="background: #141a22; border: 1px solid #1e2830; border-radius: 10px; padding: 14px 20px; flex: 1; min-width: 120px;">
          <div style="color: #00e5a0; font-size: 24px; font-weight: 800; font-family: monospace;">${excellentMatches}</div>
          <div style="color: #8899aa; font-size: 11px; margin-top: 2px;">Excellent Matches (85%+)</div>
        </div>
        <div style="background: #141a22; border: 1px solid #1e2830; border-radius: 10px; padding: 14px 20px; flex: 1; min-width: 120px;">
          <div style="color: #00d4ff; font-size: 24px; font-weight: 800; font-family: monospace;">${goodMatches}</div>
          <div style="color: #8899aa; font-size: 11px; margin-top: 2px;">Good Matches (70%+)</div>
        </div>
        <div style="background: #141a22; border: 1px solid #1e2830; border-radius: 10px; padding: 14px 20px; flex: 1; min-width: 120px;">
          <div style="color: #8899aa; font-size: 24px; font-weight: 800; font-family: monospace;">${topJobs[0]?.matchScore || 0}%</div>
          <div style="color: #8899aa; font-size: 11px; margin-top: 2px;">Top Match Score</div>
        </div>
      </div>
    </div>

    <!-- Sheet Link -->
    <div style="background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.2); border-radius: 12px; padding: 16px 24px; margin-bottom: 24px; text-align: center;">
      <div style="color: #8899aa; font-size: 12px; margin-bottom: 8px;">View all jobs in your tracker</div>
      <a href="${sheetUrl}" style="background: #00d4ff; color: #080b0f; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px;">📊 Open Google Sheet →</a>
    </div>

    <!-- Jobs Table -->
    <div style="background: #0e1318; border: 1px solid #1e2830; border-radius: 16px; overflow: hidden;">
      <div style="padding: 20px 24px; border-bottom: 1px solid #1e2830;">
        <div style="color: #e8edf2; font-size: 14px; font-weight: 700;">Top 50 Matched Jobs</div>
        <div style="color: #4a5a6a; font-size: 11px; font-family: monospace; margin-top: 2px;">Ranked by AI match score against your resume</div>
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #141a22;">
              <th style="padding: 10px 8px; color: #4a5a6a; font-size: 10px; text-align: left; font-family: monospace; letter-spacing: 1px;">#</th>
              <th style="padding: 10px 8px; color: #4a5a6a; font-size: 10px; text-align: left; font-family: monospace; letter-spacing: 1px;">ROLE</th>
              <th style="padding: 10px 8px; color: #4a5a6a; font-size: 10px; text-align: left; font-family: monospace; letter-spacing: 1px;">LOCATION</th>
              <th style="padding: 10px 8px; color: #4a5a6a; font-size: 10px; text-align: left; font-family: monospace; letter-spacing: 1px;">MATCH</th>
              <th style="padding: 10px 8px; color: #4a5a6a; font-size: 10px; text-align: left; font-family: monospace; letter-spacing: 1px;">SALARY</th>
              <th style="padding: 10px 8px; color: #4a5a6a; font-size: 10px; text-align: left; font-family: monospace; letter-spacing: 1px;">APPLY</th>
            </tr>
          </thead>
          <tbody>${jobRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px; color: #4a5a6a; font-size: 11px; font-family: monospace;">
      Generated by Job Search Agent · A.V.S Sri Harsha · ${today}
    </div>

  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"Job Search Agent ⚡" <${process.env.GMAIL_USER}>`,
    to: process.env.RECIPIENT_EMAIL,
    subject: `⚡ ${topJobs.length} Jobs Found — ${excellentMatches} Excellent Matches · ${today}`,
    html
  });

  console.log(`📧 Email digest sent to ${process.env.RECIPIENT_EMAIL}`);
}

module.exports = { sendEmailDigest };