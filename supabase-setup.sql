-- ============================================================
-- Setup Supabase — Entrega Futura (Agroquima)
-- Execute no Supabase → SQL Editor
-- ============================================================

-- 1. Tabela principal de sincronização
CREATE TABLE IF NOT EXISTS ef_sync (
  key        TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de configuração (guarda a senha de sync)
CREATE TABLE IF NOT EXISTS ef_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 3. RLS: leitura pública para ef_sync
ALTER TABLE ef_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica" ON ef_sync
  FOR SELECT USING (true);

-- Sem política de escrita direta (apenas via função abaixo)

-- 4. RLS: ef_config não acessível pelo cliente
ALTER TABLE ef_config ENABLE ROW LEVEL SECURITY;
-- (sem políticas = nenhum acesso pelo cliente)

-- 5. Função de upsert com validação de senha
--    Chame com: SELECT ef_sync_upsert('historico', 'SUA-SENHA', '{}');
CREATE OR REPLACE FUNCTION ef_sync_upsert(
  p_key      TEXT,
  p_password TEXT,
  p_data     JSONB
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_stored_pw TEXT;
BEGIN
  SELECT value INTO v_stored_pw FROM ef_config WHERE key = 'sync_password';

  IF v_stored_pw IS NULL OR p_password != v_stored_pw THEN
    RAISE EXCEPTION 'Senha de sincronização incorreta';
  END IF;

  INSERT INTO ef_sync (key, data, updated_at)
  VALUES (p_key, p_data, now())
  ON CONFLICT (key) DO UPDATE SET
    data       = p_data,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'key', p_key, 'updated_at', now());
END;
$$;

-- 6. Definir a senha de sync
--    TROQUE 'SUA-SENHA-AQUI' pela senha desejada antes de executar
INSERT INTO ef_config (key, value)
VALUES ('sync_password', 'SUA-SENHA-AQUI')
ON CONFLICT (key) DO UPDATE SET value = 'SUA-SENHA-AQUI';

-- 7. Verificação: leitura pública deve funcionar sem autenticação
-- SELECT * FROM ef_sync;
