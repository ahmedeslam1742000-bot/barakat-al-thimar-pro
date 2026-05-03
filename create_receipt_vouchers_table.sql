-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/byrdvzxkotgkznbtkueu/sql/new

CREATE TABLE IF NOT EXISTS public.receipt_vouchers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date text NOT NULL,
  rep_name text NOT NULL,
  customer_name text NOT NULL,
  voucher_no text NOT NULL,
  invoice_no text DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'نقدي',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.receipt_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all for authenticated"
  ON public.receipt_vouchers FOR ALL
  USING (true) WITH CHECK (true);
