import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://byrdvzxkotgkznbtkueu.supabase.co';
const supabaseAnonKey = 'sb_publishable_QdOjXlGj3vtWVhQYc_fupw_S_EcSa2r';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    fs.writeFileSync('db_check.txt', JSON.stringify(error, null, 2));
  } else {
    const keys = data && data.length > 0 ? Object.keys(data[0]) : ["TABLE IS EMPTY"];
    fs.writeFileSync('db_check.txt', JSON.stringify(keys, null, 2));
  }
}

check();
