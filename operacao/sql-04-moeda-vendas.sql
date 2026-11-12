-- Execute no SQL Editor do Supabase para habilitar vendas em reais e dólares.
-- A moeda da venda é preservada para relatórios e totalizadores independentes.
ALTER TABLE public.cuba2_vendas
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'real';
ALTER TABLE public.cuba2_vendas
  DROP CONSTRAINT IF EXISTS cuba2_vendas_moeda_check;
ALTER TABLE public.cuba2_vendas
  ADD CONSTRAINT cuba2_vendas_moeda_check CHECK (moeda IN ('real','dolar'));
COMMENT ON COLUMN public.cuba2_vendas.moeda IS 'Moeda da venda RP: real ou dolar. Receita sempre limpa.';
