const cron = require('node-cron');
const { runJobAgent } = require('./agent');
const { updateSheet } = require('./sheets');
const { sendEmailDigest } = require('./mailer');

async function runFullAgent() {
  console.log('\n🚀 Starting full job search agent run...');
  console.log('⏰ Time:', new Date().toLocaleString());

  try {
    // Step 1: Search and rank jobs
    const jobs = await runJobAgent();

    // Step 2: Update Google Sheet
    console.log('📊 Updating Google Sheet...');
    const sheetUrl = await updateSheet(jobs);

    // Step 3: Send email digest
    console.log('📧 Sending email digest...');
    await sendEmailDigest(jobs, sheetUrl);

    console.log('\n✅ Agent run complete!');
    console.log(`📊 Sheet: ${sheetUrl}`);
    console.log(`📧 Email sent to: ${process.env.RECIPIENT_EMAIL}`);

  } catch (err) {
    console.error('❌ Agent run failed:', err.message);
  }
}

// Run every day at 6 PM EST
// Cron format: minute hour * * *
cron.schedule('0 18 * * *', () => {
  console.log('⏰ Scheduled trigger: 6 PM EST');
  runFullAgent();
}, {
  timezone: 'America/New_York'
});

console.log('✅ Job Search Agent scheduler started');
console.log('⏰ Runs every day at 6:00 PM EST');
console.log('💡 Type "test" and press Enter to run immediately\n');

// Allow manual trigger from terminal
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (input) => {
  if (input.trim().toLowerCase() === 'test') {
    console.log('🧪 Manual test triggered...');
    await runFullAgent();
  }
});

module.exports = { runFullAgent };