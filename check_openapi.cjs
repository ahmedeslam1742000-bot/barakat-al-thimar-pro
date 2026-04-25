const https = require('https');

const url = 'https://byrdvzxkotgkznbtkueu.supabase.co/rest/v1/';
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
    console.log(data);
  });
}).on('error', (e) => {
  console.log('Error:', e);
});
