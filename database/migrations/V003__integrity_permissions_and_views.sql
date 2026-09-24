BEGIN;
SET ROLE colheita_owner;
SET search_path TO colheita, public;

INSERT INTO roles (code, name, description) VALUES
  ('ADMIN', 'Administrador', 'Acesso completo e gestão de usuários'),
  ('OPERADOR', 'Operador', 'Executa o ciclo operacional e financeiro'),
  ('CONSULTA', 'Consulta', 'Visualização sem alterações')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
  ('users.read', 'Consultar usuários'), ('users.manage', 'Criar, editar, bloquear e redefinir usuários'),
  ('catalogs.read', 'Consultar cadastros'), ('catalogs.write', 'Alterar cadastros'),
  ('weeks.read', 'Consultar semanas'), ('weeks.write', 'Criar e editar semanas'),
  ('weeks.close', 'Fechar semanas'), ('weeks.reopen', 'Reabrir semanas'),
  ('operations.read', 'Consultar pedidos, entregas e devoluções'),
  ('operations.write', 'Alterar pedidos, entregas e devoluções'),
  ('finance.read', 'Consultar valores e custos'), ('finance.write', 'Alterar custos e preços'),
  ('audit.read', 'Consultar auditoria'), ('reports.read', 'Consultar relatórios')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'OPERADOR' AND p.code IN (
  'catalogs.read','catalogs.write','weeks.read','weeks.write','weeks.close','weeks.reopen',
  'operations.read','operations.write','finance.read','finance.write','audit.read','reports.read'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'CONSULTA' AND p.code IN (
  'catalogs.read','weeks.read','operations.read','finance.read','reports.read'
) ON CONFLICT DO NOTHING;

ALTER TABLE prices ADD CONSTRAINT uq_prices_org_id UNIQUE (organization_id, id);
ALTER TABLE school_orders ADD CONSTRAINT fk_school_order_price_org FOREIGN KEY (organization_id, price_id) REFERENCES prices(organization_id, id);
ALTER TABLE producer_orders ADD CONSTRAINT fk_producer_order_price_org FOREIGN KEY (organization_id, price_id) REFERENCES prices(organization_id, id);
ALTER TABLE producer_deliveries ADD CONSTRAINT fk_producer_delivery_price_org FOREIGN KEY (organization_id, price_id) REFERENCES prices(organization_id, id);
ALTER TABLE weeks ADD CONSTRAINT fk_week_closed_by_membership FOREIGN KEY (organization_id, closed_by_id) REFERENCES organization_members(organization_id, user_id);
ALTER TABLE week_reopenings ADD CONSTRAINT fk_week_reopening_membership FOREIGN KEY (organization_id, user_id) REFERENCES organization_members(organization_id, user_id);
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_membership FOREIGN KEY (organization_id, user_id) REFERENCES organization_members(organization_id, user_id);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations','users','organization_members','settings','products','schools','producers',
    'return_reasons','production_map_entries','school_orders','school_deliveries','school_returns',
    'producer_allocations','producer_orders','producer_deliveries','producer_returns','weekly_costs'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', table_name, table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION reject_closed_week_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_week uuid := COALESCE(NEW.week_id, OLD.week_id); current_status week_status;
BEGIN
  SELECT status INTO current_status FROM weeks WHERE id = target_week FOR UPDATE;
  IF current_status = 'FECHADA' THEN
    RAISE EXCEPTION 'Semana fechada não pode receber alterações' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'school_orders','school_deliveries','school_returns','producer_allocations',
    'producer_orders','producer_deliveries','producer_returns','weekly_costs'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_open_week BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_closed_week_mutation()', table_name, table_name);
  END LOOP;
END $$;

CREATE VIEW v_week_financial_summary AS
SELECT w.organization_id, w.id AS week_id, w.number,
  COALESCE((SELECT sum((so.ordered_qty - COALESCE(sr.returned_qty,0)) * p.price)
            FROM school_orders so JOIN prices p ON p.id=so.price_id
            LEFT JOIN school_returns sr ON sr.organization_id=so.organization_id AND sr.week_id=so.week_id AND sr.school_id=so.school_id AND sr.product_id=so.product_id
            WHERE so.organization_id=w.organization_id AND so.week_id=w.id),0) AS receivable,
  COALESCE((SELECT sum((pd.delivered_qty - COALESCE(pr.returned_qty,0)) * (p.price - pd.logistics_deduction_snapshot))
            FROM producer_deliveries pd JOIN prices p ON p.id=pd.price_id
            LEFT JOIN producer_returns pr ON pr.organization_id=pd.organization_id AND pr.week_id=pd.week_id AND pr.producer_id=pd.producer_id AND pr.product_id=pd.product_id
            WHERE pd.organization_id=w.organization_id AND pd.week_id=w.id),0) AS payable,
  COALESCE((SELECT sum(wc.amount) FROM weekly_costs wc WHERE wc.organization_id=w.organization_id AND wc.week_id=w.id),0) AS costs
FROM weeks w;

CREATE VIEW v_user_authorities AS
SELECT om.organization_id, u.id AS user_id, u.email, u.name, u.active AS user_active,
       om.active AS membership_active, r.code AS role, p.code AS permission
FROM organization_members om
JOIN users u ON u.id=om.user_id JOIN roles r ON r.id=om.role_id
JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id;

ALTER SCHEMA colheita OWNER TO colheita_owner;
GRANT USAGE ON SCHEMA colheita TO colheita_runtime, colheita_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA colheita TO colheita_runtime;
REVOKE DELETE ON weeks, audit_logs, organizations, users FROM colheita_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA colheita TO colheita_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA colheita TO colheita_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE colheita_owner IN SCHEMA colheita GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO colheita_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE colheita_owner IN SCHEMA colheita GRANT SELECT ON TABLES TO colheita_readonly;

COMMIT;
