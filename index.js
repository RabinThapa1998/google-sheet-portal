require('dotenv').config();

const NodeCache = require('node-cache');
const path = require('path');
const google = require('googleapis').google;
const express = require('express');
const app = express();
const port = 3000;

const cache = new NodeCache();

async function fetchDataFromGoogleSheets(spreadsheetId) {
    const filePath = path.join(process.cwd(), 'sheet.json');

    const auth = new google.auth.GoogleAuth({
        keyFile: filePath,
        scopes: 'https://www.googleapis.com/auth/spreadsheets',
    });
    const client = await auth.getClient();
    const googleSheets = google.sheets({
        version: 'v4',
        auth: client,
    });

    const metaData = await googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
    });

    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: 'Sheet1!A1:Z',
    });
    const rows = getRows?.data?.values ?? [];

    let headerRow = rows[0];
    //trim the header row item to remove any extra spaces
    headerRow = headerRow.map((item) => item.trim());

    const rowObjects = rows?.slice(1).map((row) => {
        const rowObject = {};
        for (let i = 0; i < row.length; i++) {
            const columnName = headerRow[i];
            rowObject[columnName] = row[i];
        }
        return rowObject;
    });

    // Return the fetched data
    return { data: rowObjects };
}

async function getCachedData(cacheKey, spreadsheetId) {
    let cachedData = cache.get(cacheKey);

    if (!cachedData) {
        cachedData = await fetchDataFromGoogleSheets(spreadsheetId);
        cache.set(cacheKey, cachedData, 300);
    }
    return cachedData;
}

async function handler(req, res, spreadsheetId) {
    const key = req.url.split('/')[1];
    try {
        const cachedData = await getCachedData(key, spreadsheetId);
        res.status(200).json(cachedData);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

app.get('/united-school', (req, res) =>
    handler(req, res, process.env.UNITED_SCHOOL)
);
app.get('/st-mary', (req, res) => handler(req, res, process.env.ST_MARY));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
