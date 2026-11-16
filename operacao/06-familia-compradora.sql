-- Execute no Supabase SQL Editor antes de registrar novas vendas.
-- Preserva todas as vendas anteriores; nome da família fica opcional para registros antigos.
ALTER TABLE public.cuba2_vendas
  ADD COLUMN IF NOT EXISTS familia_compradora text;
ALTER TABLE public.cuba2_vendas
  DROP CONSTRAINT IF EXISTS cuba2_familia_compradora_tamanho;
ALTER TABLE public.cuba2_vendas
  ADD CONSTRAINT cuba2_familia_compradora_tamanho
  CHECK (familia_compradora IS NULL OR char_length(trim(familia_compradora)) BETWEEN 1 AND 120);
COMMENT ON COLUMN public.cuba2_vendas.familia_compradora IS
  'Nome da família compradora do armamento no RP. O valor registrado utiliza apenas a moeda paga.';
