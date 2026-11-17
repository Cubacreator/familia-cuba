-- CUBA • registrar valor perdido em ações com resultado RED.
-- Execute no SQL Editor do Supabase antes de salvar novos Reds com perdas.
-- Mantém os registros antigos e não altera a distribuição das recompensas.
ALTER TABLE public.cuba2_acoes
  ADD COLUMN IF NOT EXISTS valor_perdido numeric(18,2);
ALTER TABLE public.cuba2_acoes
  DROP CONSTRAINT IF EXISTS cuba2_acao_valor_perdido_check;
ALTER TABLE public.cuba2_acoes
  ADD CONSTRAINT cuba2_acao_valor_perdido_check
  CHECK (valor_perdido IS NULL OR (resultado = 'red' AND valor_perdido >= 0));
COMMENT ON COLUMN public.cuba2_acoes.valor_perdido IS
'Perda financeira opcional registrada em Red, na moeda da ação. NULL significa não informado. Nunca é receita ou distribuição.';
