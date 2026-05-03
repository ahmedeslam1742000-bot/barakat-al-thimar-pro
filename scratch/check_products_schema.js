const https = require('https');

const apikey = 'sb_publishable_QdOjXlGj3vtWVhQYc_fupw_S_EcSa2r';

const check = (col) => {
  return new Promise((resolve) => {
    const url = `https://byrdvzxkotgkznbtkueu.supabase.co/rest/v1/products?select=${col}&limit=1`;
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
        resolve(!data.includes('does not exist'));
      });
    });
  });
};

(async () => {
  const priceExists = await check('price');
  const oldPriceExists = await check('old_price');
  console.log(`price: ${priceExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`old_price: ${oldPriceExists ? 'EXISTS' : 'MISSING'}`);
})();
