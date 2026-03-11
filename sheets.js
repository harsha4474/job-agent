const { google } = require('googleapis');
require('dotenv').config();

async function getSheetClient() {
  var auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    var credentials = JSON.parse(JSON.parse(process.env.GOOGLE_CREDENTIALS));
    auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  } else {
    auth = new google.auth.GoogleAuth({ keyFile: './credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  }
  var client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function updateSheet(jobs) {
  try {
    var sheets = await getSheetClient();
    var spreadsheetId = process.env.GOOGLE_SHEET_ID;
    var today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    var excellentMatches = jobs.filter(function(j) { return j.matchScore >= 85; }).length;
    var goodMatches = jobs.filter(function(j) { return j.matchScore >= 70 && j.matchScore < 85; }).length;
    var topScore = jobs[0] ? jobs[0].matchScore : 0;

    var existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A:A' });
    var lastRow = existing.data.values ? existing.data.values.length : 0;
    var isFirstRun = lastRow === 0;

    var summaryRow = ['Last Updated: ' + today, 'New Jobs This Run: ' + jobs.length, 'Excellent (85%+): ' + excellentMatches, 'Good (70-84%): ' + goodMatches, 'Top Score: ' + topScore + '%', '', '', '', '', '', ''];
    var headers = ['#', 'Job Title', 'Company', 'Location', 'Match Score', 'Salary', 'Source', 'Posted', 'Apply Link', 'Tailor Resume', 'Status'];

    var rows = jobs.map(function(job, idx) {
      return [
        idx + 1,
        job.title,
        job.company,
        job.location,
        job.matchScore + '%',
        job.salary,
        job.source,
        job.postedDate ? new Date(job.postedDate).toLocaleDateString() : today,
        job.applyLink,
        'https://job-agent-6clk.onrender.com/tailor.html?job=' + encodeURIComponent(job.title) + '&company=' + encodeURIComponent(job.company),
        'Not Applied'
      ];
    });

    var separatorRow = ['── BATCH: ' + today + '   |   New: ' + jobs.length + '   |   Excellent: ' + excellentMatches + '   |   Good: ' + goodMatches + '   |   Top: ' + topScore + '%', '', '', '', '', '', '', '', '', '', ''];

    if (isFirstRun) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [summaryRow, headers] }
      });
    }

    var appendRow = isFirstRun ? 3 : lastRow + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId, range: 'Sheet1!A' + appendRow,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [separatorRow].concat(rows) }
    });

    // Always refresh summary
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [summaryRow] }
    });

    var totalRowsNow = appendRow + rows.length;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Summary row style
          { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.05, green: 0.05, blue: 0.12 }, textFormat: { bold: true, foregroundColor: { red: 0.4, green: 0.8, blue: 1.0 }, fontSize: 10 } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
          // Header row style
          { repeatCell: { range: { sheetId: 0, startRowIndex: 1, endRowIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.1, green: 0.1, blue: 0.15 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 }, horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)' } },
          // Separator row style
          { repeatCell: { range: { sheetId: 0, startRowIndex: appendRow - 1, endRowIndex: appendRow }, cell: { userEnteredFormat: { backgroundColor: { red: 0.08, green: 0.05, blue: 0.18 }, textFormat: { bold: true, foregroundColor: { red: 0.75, green: 0.55, blue: 1.0 }, fontSize: 10 } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
          // Freeze top 2 rows
          { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } },
          // Auto resize
          { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 11 } } },
          // Status dropdown
          { setDataValidation: { range: { sheetId: 0, startRowIndex: appendRow, endRowIndex: totalRowsNow, startColumnIndex: 10, endColumnIndex: 11 }, rule: { condition: { type: 'ONE_OF_LIST', values: [ { userEnteredValue: 'Not Applied' }, { userEnteredValue: 'Interested' }, { userEnteredValue: 'Applied' }, { userEnteredValue: 'Interview' }, { userEnteredValue: 'Offer' }, { userEnteredValue: 'Skip' } ] }, showCustomUi: true, strict: true } } }
        ]
      }
    });

    console.log('Google Sheet updated with ' + jobs.length + ' new jobs');
    return 'https://docs.google.com/spreadsheets/d/' + spreadsheetId;
  } catch (err) {
    console.error('Google Sheets error:', err.message);
    throw err;
  }
}

module.exports = { updateSheet };
