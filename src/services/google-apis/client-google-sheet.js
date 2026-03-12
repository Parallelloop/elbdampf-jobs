import { google } from 'googleapis';
import moment from "moment";
const { SPREADSHEET_ID, SHEET_NAME, GOOGLE_SERVICE_ACCOUNT } = process.env;

const getGoogleSheetsClient = async () => {
	const auth = new google.auth.GoogleAuth({
		credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT),
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});
	const authClient = await auth.getClient();
	return google.sheets({ version: "v4", auth: authClient });
}

const appendCustomersToSheet = async (coilCount) => {
  try {
    const sheets = await getGoogleSheetsClient();
    const today = moment().format("DD.MM.YYYY");
    console.log(`🔢 Coil orders count today: ${coilCount}`);

    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = existingData.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === today);

    if (rowIndex !== -1) {
      const rowNumber = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!G${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[coilCount]] },
      });
      console.log(`📊 Updated Coil orders (${coilCount}) in row ${rowNumber} for ${today}`);
    } else {
      console.log(`➕ No row found for ${today} — creating new row`);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:G`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[today, "", "", "", "", "", coilCount]],
        },
      });
      console.log(`📊 Created new row for ${today} with Coil orders: ${coilCount}`);
    }

  } catch (error) {
    console.error("❌ Error updating Google Sheet:", error);
  }
};

export { appendCustomersToSheet };