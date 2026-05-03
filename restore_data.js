const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://byrdvzxkotgkznbtkueu.supabase.co',
  'sb_publishable_QdOjXlGj3vtWVhQYc_fupw_S_EcSa2r'
);

async function restore() {
  console.log("Restoration starting...");
  const { data: archives, error: fetchErr } = await supabase.from('daily_archives').select('*');
  if (fetchErr) {
    console.error("Error fetching archives:", fetchErr);
    process.exit(1);
  }

  let total = 0;
  for (const archive of archives) {
    const txs = [
      ...(archive.inbound || []),
      ...(archive.outbound || []),
      ...(archive.returns || [])
    ];
    if (txs.length === 0) continue;

    const cleanTxs = txs.map(t => {
      const { group, image, ...rest } = t;
      return {
        ...rest,
        qty: Number(rest.qty || 0),
        item_id: rest.item_id || rest.itemId || null
      };
    });

    const { error: upsertErr } = await supabase.from('transactions').upsert(cleanTxs, { onConflict: 'id' });
    if (upsertErr) {
      console.error(`Error upserting archive ${archive.id}:`, upsertErr);
    } else {
      total += cleanTxs.length;
      console.log(`Restored ${cleanTxs.length} from archive ${archive.date_key}`);
    }
  }

  console.log(`Finished! Total restored: ${total}`);
  process.exit(0);
}

restore();
