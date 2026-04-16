-- ==============================================================================
-- Barakat Al-Thimar - Supabase SQL Schema Migration
-- ==============================================================================

-- Enable the uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLES CREATION
-- ==========================================

-- Table: products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    company TEXT,
    cat TEXT,
    unit TEXT,
    stock_qty INTEGER DEFAULT 0,
    search_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- e.g., 'in', 'out', 'Issue'
    item TEXT, -- Product Name (Auto-filled by Trigger)
    company TEXT, -- Company Name (Auto-filled by Trigger)
    qty INTEGER DEFAULT 0,
    unit TEXT,
    cat TEXT,
    date DATE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location TEXT,
    rep TEXT,
    supplier TEXT,
    invoice TEXT,
    notes TEXT,
    source_voucher_id TEXT,
    batch_id TEXT,
    expiry_date TEXT,
    invoiced BOOLEAN DEFAULT false
);

-- Table: categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. TRIGGER: AUTO-NAME TRANSACTIONS
-- ==========================================

-- Function to fetch product details and update transaction
CREATE OR REPLACE FUNCTION public.sync_transaction_item_details()
RETURNS TRIGGER AS $$
DECLARE
    fetched_name TEXT;
    fetched_company TEXT;
BEGIN
    -- Only run if an item_id is provided
    IF NEW.item_id IS NOT NULL THEN
        SELECT name, COALESCE(NULLIF(TRIM(company), ''), 'بدون شركة') 
        INTO fetched_name, fetched_company
        FROM public.products 
        WHERE id = NEW.item_id;

        -- Update the transaction rows explicitly ensuring flawless combination
        NEW.item := format('%s - %s', fetched_name, fetched_company);
        NEW.company := fetched_company;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger firing before insert or update
DROP TRIGGER IF EXISTS trg_sync_transaction_item ON public.transactions;
CREATE TRIGGER trg_sync_transaction_item
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_item_details();


-- ==========================================
-- 3. STORED PRECEDURES (RPC) FOR STOCK
-- ==========================================

-- RPC: Increment Stock (For Purchases / Stock In)
CREATE OR REPLACE FUNCTION public.increment_stock(product_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET stock_qty = stock_qty + amount
    WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Decrement Stock (For Sales / Stock Out)
CREATE OR REPLACE FUNCTION public.decrement_stock(product_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET stock_qty = GREATEST(0, stock_qty - amount) -- Prevent negative stock
    WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Global Policy: Allow Authenticated Users Full Access to Products
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.products;
CREATE POLICY "Enable full access for authenticated users" 
ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Global Policy: Allow Authenticated Users Full Access to Transactions
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.transactions;
CREATE POLICY "Enable full access for authenticated users" 
ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Global Policy: Allow Authenticated Users Full Access to Categories
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.categories;
CREATE POLICY "Enable full access for authenticated users" 
ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Global Policy: Allow Authenticated Users Full Access to Settings
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.system_settings;
CREATE POLICY "Enable full access for authenticated users" 
ON public.system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ==========================================
-- 5. REALTIME REPLICATION CONFIGURATION
-- ==========================================

-- Enable realtime streaming for all core tables to allow live Dashboard updates
begin;
  -- Remove publications if they exist to prevent duplication
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.system_settings;

-- SQL Script complete 🚀
