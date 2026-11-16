-- CUBA: tabela oficial de preços, sem descontos ou brindes.
-- Execute no SQL Editor do mesmo Supabase da operação.
-- Pré-requisito: operacao/01-schema.sql e operacao/sql-04-moeda-vendas.sql executados.
-- Não remove vendas históricas, membros nem outros produtos.
INSERT INTO public.cuba2_produtos (nome,categoria,preco_padrao,ativo)
VALUES
 ('Micro SMG','Armamento RP',35000,true),
 ('MTAR','Armamento RP',60000,true),
 ('MP7','Armamento RP',55000,true),
 ('Lançador de granadas','Armamento RP',30000,true)
ON CONFLICT (nome) DO UPDATE
SET categoria=EXCLUDED.categoria,
    preco_padrao=EXCLUDED.preco_padrao,
    ativo=true;

-- Regras aplicadas a novas vendas e alterações futuras.
-- Evita que outra tela ou cliente altere valor unitário/desconto.
CREATE OR REPLACE FUNCTION public.cuba2_validar_preco_oficial()
RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  nome_produto text;
  preco_correto numeric(18,2);
BEGIN
  SELECT lower(trim(translate(nome,'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc')))
    INTO nome_produto
  FROM public.cuba2_produtos
  WHERE id=NEW.produto_id;
  preco_correto:=CASE
    WHEN nome_produto='micro smg' AND NEW.moeda='real' THEN 35000
    WHEN nome_produto='micro smg' AND NEW.moeda='dolar' THEN 31000
    WHEN nome_produto='mtar' AND NEW.moeda='real' THEN 60000
    WHEN nome_produto='mtar' AND NEW.moeda='dolar' THEN 54500
    WHEN nome_produto='mp7' AND NEW.moeda='real' THEN 55000
    WHEN nome_produto='mp7' AND NEW.moeda='dolar' THEN 50000
    WHEN nome_produto='lancador de granadas' AND NEW.moeda='real' THEN 30000
    WHEN nome_produto='lancador de granadas' AND NEW.moeda='dolar' THEN 27000
    ELSE NULL
  END;
  IF preco_correto IS NULL THEN
    RAISE EXCEPTION 'Armamento/moeda sem preço oficial autorizado.';
  END IF;
  IF NEW.preco_unitario<>preco_correto OR NEW.desconto<>0 THEN
    RAISE EXCEPTION 'Preço oficial obrigatório: % %. Descontos não são permitidos.',
       NEW.moeda,preco_correto;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cuba2_preco_oficial ON public.cuba2_vendas;
CREATE TRIGGER cuba2_preco_oficial
BEFORE INSERT OR UPDATE OF produto_id, moeda, preco_unitario, desconto
ON public.cuba2_vendas
FOR EACH ROW EXECUTE FUNCTION public.cuba2_validar_preco_oficial();
