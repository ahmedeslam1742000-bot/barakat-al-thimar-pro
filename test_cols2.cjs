const https = require('https');

const apikey = 'sb_publishable_QdOjXlGj3vtWVhQYc_fupw_S_EcSa2r';
const options = {
  headers: {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`
  }
};

const checkColumn = (col) => {
  return new Promise((resolve) => {
    const url = `https://byrdvzxkotgkznbtkueu.supabase.co/rest/v1/transactions?select=${col}&limit=1`;
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve(!data.includes('does not exist'));
      });
    });
  });
};

(async () => {
  const cols = ['isFunctional', 'voucherGroupId', 'line_note', 'lineNote', 'note', 'supplyNotes', 'voucherSupplyNotes'];
  for (const col of cols) {
    const exists = await checkColumn(col);
    console.log(`${col}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }
})();
