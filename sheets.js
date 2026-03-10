const { google } = require('googleapis');
require('dotenv').config();

async function getSheetClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function updateSheet(jobs) {
  try {
    const sheets = await getSheetClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    const excellentMatches = jobs.filter(j => j.matchScore >= 85).length;
    const goodMatches = jobs.filter(j => j.matchScore >= 70 && j.matchScore < 85).length;
    const topScore = jobs[0]?.matchScore || 0;

    // ── Get existing data to find last row ──────────────────────────────────
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:A'
    });
    const lastRow = existing.data.values ? existing.data.values.length : 0;

    // ── Summary row (always row 1) ──────────────────────────────────────────
    const summaryRow = [
      `📊 Last Updated: ${today}`,
      `Total Jobs (all time): ${lastRow === 0 ? jobs.length : lastRow - 1 + jobs.length}`,
      `🔥 Excellent (85%+): ${excellentMatches}`,
      `✅ Good (70-84%): ${goodMatches}`,
      `🏆 Top Score Today: ${topScore}%`,
      '', '', '', '', '', ''
    ];

    // ── Headers ─────────────────────────────────────────────────────────────
    const headers = [
      '#', 'Job Title', 'Company', 'Location', 'Match Score',
      'Salary', 'Source', 'Posted', 'Apply Link', 'Tailor Resume', 'Status'
    ];

    // ── Job rows ─────────────────────────────────────────────────────────────
    const rows = jobs.map((job, idx) => [
      idx + 1,
      job.title,
      job.company,
      job.location,
      `${job.matchScore}%`,
      job.salary,
      job.source,
      job.postedDate ? new Date(job.postedDate).toLocaleDateString() : today,
      job.applyLink,
`http://localhost:3001/tailor?job=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`,
      'Not Applied'
    ]);

    // ── Separator row ────────────────────────────────────────────────────────
    const separatorRow = [
      `📅 BATCH: ${today}   |   Jobs Found: ${jobs.length}   |   🔥 Excellent: ${excellentMatches}   |   ✅ Good: ${goodMatches}   |   🏆 Top Score: ${topScore}%`,
      '', '', '', '', '', '', '', '', '', ''
    ];

    // ── If first time: write summary + headers ───────────────────────────────
    if (lastRow === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [summaryRow, headers] }
      });
    }

    // ── Append separator + new jobs after existing rows ──────────────────────
    const appendRow = lastRow === 0 ? 3 : lastRow + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!A${appendRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [separatorRow, ...rows] }
    });

    // ── Always update summary row ─────────────────────────────────────────────
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [summaryRow] }
    });

    // ── Formatting ────────────────────────────────────────────────────────────
    const totalRowsNow = appendRow + rows.length;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Summary row - dark blue background, cyan text
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.05, green: 0.08, blue: 0.15 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 0.0, green: 0.83, blue: 1.0 },
                    fontSize: 10
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Header row - dark background, white bold text
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 1, endRowIndex: 2 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.08, green: 0.10, blue: 0.13 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    fontSize: 11
                  },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
          },
          // Separator row - purple tint
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: appendRow - 1,
                endRowIndex: appendRow
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.10, green: 0.06, blue: 0.20 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 0.8, green: 0.6, blue: 1.0 },
                    fontSize: 10
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Freeze top 2 rows
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: { frozenRowCount: 2 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          },
          // Auto resize all columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 11
              }
            }
          },
          // Status dropdown for new rows
          {
            setDataValidation: {
              range: {
                sheetId: 0,
                startRowIndex: appendRow,
                endRowIndex: totalRowsNow,
                startColumnIndex: 10,
                endColumnIndex: 11
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: [
                    { userEnteredValue: 'Not Applied' },
                    { userEnteredValue: '⭐ Interested' },
                    { userEnteredValue: '📤 Applied' },
                    { userEnteredValue: '📞 Interview' },
                    { userEnteredValue: '🎉 Offer' },
                    { userEnteredValue: '❌ Skip' }
                  ]
                },
                showCustomUi: true,
                strict: true
              }
            }
          }
        ]
      }
    });

    console.log(`✅ Google Sheet updated with ${jobs.length} new jobs`);
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  } catch (err) {
    console.error('Google Sheets error:', err.message);
    throw err;
  }
}

module.exports = { updateSheet };