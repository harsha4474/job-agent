const sgMail = require('@sendgrid/mail');
require('dotenv').config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmailDigest(jobs, sheetUrl) {
  var today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  var topJobs = jobs.slice(0, 50);
  var excellent = topJobs.filter(function(j) { return j.matchScore >= 85; }).length;
  var good = topJobs.filter(function(j) { return j.matchScore >= 70 && j.matchScore < 85; }).length;
  var topScore = topJobs[0] ? topJobs[0].matchScore : 0;

  function scoreColor(s) {
    if (s >= 85) return '#10e8a0';
    if (s >= 70) return '#38bdf8';
    if (s >= 55) return '#f59e0b';
    return '#6b7280';
  }

  function scoreBg(s) {
    if (s >= 85) return '#052a1e';
    if (s >= 70) return '#051a2a';
    if (s >= 55) return '#2a1a05';
    return '#1a1a1a';
  }

  function scoreLabel(s) {
    if (s >= 85) return '🔥 Excellent';
    if (s >= 70) return '✅ Strong';
    if (s >= 55) return '👀 Potential';
    return '📌 Low';
  }

  var jobRows = topJobs.map(function(job, idx) {
    return '<tr style="border-bottom:1px solid #1e2535;">' +
      '<td style="padding:14px 10px;color:#4a5568;font-size:12px;font-family:monospace;vertical-align:top;">' + (idx+1) + '</td>' +
      '<td style="padding:14px 10px;vertical-align:top;">' +
        '<div style="color:#f0f4f8;font-weight:600;font-size:13px;margin-bottom:3px;">' + job.title + '</div>' +
        '<div style="color:#64748b;font-size:11px;">' + job.company + ' &nbsp;·&nbsp; ' + job.location + '</div>' +
      '</td>' +
      '<td style="padding:14px 10px;vertical-align:top;">' +
        '<div style="background:' + scoreBg(job.matchScore) + ';border:1px solid ' + scoreColor(job.matchScore) + '33;border-radius:20px;padding:4px 10px;display:inline-block;">' +
          '<span style="color:' + scoreColor(job.matchScore) + ';font-size:12px;font-weight:700;font-family:monospace;">' + job.matchScore + '%</span>' +
          '<span style="color:' + scoreColor(job.matchScore) + '99;font-size:10px;margin-left:5px;">' + scoreLabel(job.matchScore) + '</span>' +
        '</div>' +
      '</td>' +
      '<td style="padding:14px 10px;color:#64748b;font-size:11px;vertical-align:top;">' + (job.salary !== 'Not listed' ? job.salary : '—') + '</td>' +
      '<td style="padding:14px 10px;vertical-align:top;">' +
        '<a href="' + job.applyLink + '" style="background:#10e8a0;color:#020f0a;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;display:inline-block;margin-bottom:4px;">Apply →</a><br>' +
        '<a href="https://job-agent-6clk.onrender.com/tailor.html?job=' + encodeURIComponent(job.title) + '&company=' + encodeURIComponent(job.company) + '" style="color:#38bdf8;font-size:10px;text-decoration:none;">✨ Tailor Resume</a>' +
      '</td>' +
    '</tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
  '<body style="margin:0;padding:0;background:#080c14;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
  '<div style="max-width:860px;margin:0 auto;padding:32px 16px;">' +

  // Header
  '<div style="background:linear-gradient(135deg,#0d1117 0%,#0a1628 100%);border:1px solid #1e2d40;border-radius:20px;padding:36px 40px;margin-bottom:20px;position:relative;overflow:hidden;">' +
    '<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,#10e8a022,transparent 70%);pointer-events:none;"></div>' +
    '<div style="font-size:11px;color:#38bdf8;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;font-weight:600;">JOB SEARCH AGENT</div>' +
    '<div style="font-size:28px;font-weight:800;color:#f0f4f8;margin-bottom:6px;letter-spacing:-0.5px;">Daily Job Digest</div>' +
    '<div style="font-size:13px;color:#475569;font-family:monospace;">' + today + '</div>' +

    // Stats
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px;">' +
      '<div style="background:#0d1520;border:1px solid #1e2d40;border-radius:12px;padding:16px 22px;flex:1;min-width:110px;">' +
        '<div style="font-size:28px;font-weight:800;color:#10e8a0;font-family:monospace;">' + topJobs.length + '</div>' +
        '<div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">New Jobs</div>' +
      '</div>' +
      '<div style="background:#0d1520;border:1px solid #1e2d40;border-radius:12px;padding:16px 22px;flex:1;min-width:110px;">' +
        '<div style="font-size:28px;font-weight:800;color:#10e8a0;font-family:monospace;">' + excellent + '</div>' +
        '<div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Excellent 85%+</div>' +
      '</div>' +
      '<div style="background:#0d1520;border:1px solid #1e2d40;border-radius:12px;padding:16px 22px;flex:1;min-width:110px;">' +
        '<div style="font-size:28px;font-weight:800;color:#38bdf8;font-family:monospace;">' + good + '</div>' +
        '<div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Strong 70%+</div>' +
      '</div>' +
      '<div style="background:#0d1520;border:1px solid #1e2d40;border-radius:12px;padding:16px 22px;flex:1;min-width:110px;">' +
        '<div style="font-size:28px;font-weight:800;color:#f0f4f8;font-family:monospace;">' + topScore + '%</div>' +
        '<div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Top Score</div>' +
      '</div>' +
    '</div>' +
  '</div>' +

  // Sheet CTA
  '<div style="background:#0d1520;border:1px solid #1e3a5f;border-radius:14px;padding:20px 28px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
    '<div>' +
      '<div style="color:#f0f4f8;font-weight:600;font-size:14px;">View Full Tracker</div>' +
      '<div style="color:#475569;font-size:12px;margin-top:2px;">All jobs, status tracking, history</div>' +
    '</div>' +
    '<a href="' + sheetUrl + '" style="background:linear-gradient(135deg,#0ea5e9,#10e8a0);color:#020f0a;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">Open Google Sheet →</a>' +
  '</div>' +

  // Jobs table
  '<div style="background:#0a0f1a;border:1px solid #1e2535;border-radius:16px;overflow:hidden;">' +
    '<div style="padding:20px 24px;border-bottom:1px solid #1e2535;display:flex;align-items:center;justify-content:space-between;">' +
      '<div>' +
        '<div style="color:#f0f4f8;font-size:15px;font-weight:700;">Top Matched Jobs</div>' +
        '<div style="color:#475569;font-size:11px;margin-top:2px;font-family:monospace;">Ranked by GPT-4o match score against your resume</div>' +
      '</div>' +
    '</div>' +
    '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#0d1117;">' +
          '<th style="padding:10px;color:#334155;font-size:10px;text-align:left;font-family:monospace;letter-spacing:1px;">#</th>' +
          '<th style="padding:10px;color:#334155;font-size:10px;text-align:left;font-family:monospace;letter-spacing:1px;">ROLE</th>' +
          '<th style="padding:10px;color:#334155;font-size:10px;text-align:left;font-family:monospace;letter-spacing:1px;">MATCH</th>' +
          '<th style="padding:10px;color:#334155;font-size:10px;text-align:left;font-family:monospace;letter-spacing:1px;">SALARY</th>' +
          '<th style="padding:10px;color:#334155;font-size:10px;text-align:left;font-family:monospace;letter-spacing:1px;">ACTIONS</th>' +
        '</tr></thead>' +
        '<tbody>' + jobRows + '</tbody>' +
      '</table>' +
    '</div>' +
  '</div>' +

  // Footer
  '<div style="text-align:center;margin-top:24px;color:#334155;font-size:11px;font-family:monospace;">' +
    'Job Search Agent &nbsp;·&nbsp; A.V.S Sri Harsha &nbsp;·&nbsp; ' + today +
  '</div>' +

  '</div></body></html>';

  await sgMail.send({
    from: process.env.GMAIL_USER,
    to: process.env.RECIPIENT_EMAIL,
    subject: topJobs.length + ' New PM Jobs — ' + excellent + ' Excellent Matches · ' + today,
    html: html
  });

  console.log('📧 Email digest sent to ' + process.env.RECIPIENT_EMAIL);
}

module.exports = { sendEmailDigest };
