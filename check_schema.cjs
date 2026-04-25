const https = require('https');

const url = 'https://byrdvzxkotgkznbtkueu.supabase.co/rest/v1/transactions?limit=1';
const apikey = 'sb_publishable_QdOjXlGj3vtWVhQYc_fupw_S_EcSa2r';

const options = {
  headers: {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.length > 0) {
        console.log('Columns:', Object.keys(parsed[0]).join(', '));
      } else {
        console.log('No data found.');
      }
    } catch (e) {
      console.log('Error parsing:', e);
    }
  });
}).on('error', (e) => {
  console.log('Error:', e);
});
