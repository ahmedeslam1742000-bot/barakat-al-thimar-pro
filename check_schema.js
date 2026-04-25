import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    if (data && data.length > 0) {
      console.log('Columns in transactions table:', Object.keys(data[0]).join(', '));
    } else {
      console.log('Table is empty, cannot infer schema from data.');
    }
  }
}

checkSchema();
