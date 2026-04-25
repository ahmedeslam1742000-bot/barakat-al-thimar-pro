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
  const cols = ['receipt_number', 'voucher_code', 'reference_number', 'source_voucher_id', 'receipt_type', 'voucher_kind', 'voucher_group_id', 'items_summary', 'is_functional', 'invoiced', 'location', 'note', 'documentary', 'is_invoice', 'deducted', 'status', 'total_qty', 'batch_id', 'beneficiary', 'recipient', 'receipt_image'];
  for (const col of cols) {
    const exists = await checkColumn(col);
    console.log(`${col}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }
})();
