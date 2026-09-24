BEGIN;
SET ROLE colheita_owner;
SET search_path TO colheita, public;

CREATE TYPE week_status AS ENUM ('ABERTA', 'FECHADA');
CREATE TYPE delivery_weekday AS ENUM ('SEGUNDA', 'TERCA', 'EXCEPCIONAL');
CREATE TYPE cost_category AS ENUM (
  'TRANSPORTE', 'MONTAGEM', 'ADMINISTRATIVO', 'EMBALAGENS_MATERIAL_LIMPEZA',
  'MATERIAL_ESCRITORIO', 'IMPOSTOS', 'SERVICO_CONTABILIDADE', 'AJUDA_CUSTO_CONSELHO'
);

CREATE TABLE weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  number bigint GENERATED ALWAYS AS IDENTITY,
  reference_date date NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status week_status NOT NULL DEFAULT 'ABERTA',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (organization_id, number),
  UNIQUE (organization_id, id),
  CHECK (start_date <= reference_date AND reference_date <= end_date),
  CHECK ((status = 'ABERTA' AND closed_at IS NULL AND closed_by_id IS NULL) OR
         (status = 'FECHADA' AND closed_at IS NOT NULL AND closed_by_id IS NOT NULL))
);

CREATE UNIQUE INDEX ux_one_open_week_per_org ON weeks(organization_id) WHERE status = 'ABERTA';

CREATE TABLE week_reopenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  week_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason varchar(500) NOT NULL CHECK (length(trim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE school_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  school_id uuid NOT NULL, product_id uuid NOT NULL, ordered_qty numeric(10,2) NOT NULL CHECK (ordered_qty >= 0),
  price_id uuid NOT NULL REFERENCES prices(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id) REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, school_id, product_id)
);

CREATE TABLE school_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  school_id uuid NOT NULL, weekday delivery_weekday NOT NULL, delivered_at timestamptz NOT NULL, note varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id) REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, school_id)
);

CREATE TABLE school_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  school_id uuid NOT NULL, product_id uuid NOT NULL, returned_qty numeric(10,2) NOT NULL CHECK (returned_qty >= 0),
  return_reason_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, school_id) REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, return_reason_id) REFERENCES return_reasons(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, school_id, product_id)
);

CREATE TABLE producer_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  producer_id uuid NOT NULL, product_id uuid NOT NULL, allocated_qty numeric(10,2) NOT NULL CHECK (allocated_qty >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, producer_id) REFERENCES producers(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, producer_id, product_id)
);

CREATE TABLE producer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  producer_id uuid NOT NULL, product_id uuid NOT NULL, ordered_qty numeric(10,2) NOT NULL CHECK (ordered_qty >= 0),
  price_id uuid NOT NULL REFERENCES prices(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, producer_id) REFERENCES producers(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, producer_id, product_id)
);

CREATE TABLE producer_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  producer_id uuid NOT NULL, product_id uuid NOT NULL, delivered_qty numeric(10,2) NOT NULL CHECK (delivered_qty >= 0),
  delivered_at timestamptz NOT NULL, price_id uuid NOT NULL REFERENCES prices(id) ON DELETE RESTRICT,
  logistics_deduction_snapshot numeric(10,2) NOT NULL CHECK (logistics_deduction_snapshot >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, producer_id) REFERENCES producers(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, producer_id, product_id)
);

CREATE TABLE producer_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  producer_id uuid NOT NULL, product_id uuid NOT NULL, returned_qty numeric(10,2) NOT NULL CHECK (returned_qty >= 0),
  return_reason_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, producer_id) REFERENCES producers(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, return_reason_id) REFERENCES return_reasons(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, producer_id, product_id)
);

CREATE TABLE weekly_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, week_id uuid NOT NULL,
  category cost_category NOT NULL, amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, week_id) REFERENCES weeks(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, week_id, category)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL, action varchar(80) NOT NULL, entity_type varchar(80) NOT NULL,
  entity_id uuid, before_data jsonb, after_data jsonb, reason varchar(500), request_id uuid,
  ip_address inet, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_orders_week ON school_orders(organization_id, week_id);
CREATE INDEX idx_producer_orders_week ON producer_orders(organization_id, week_id);
CREATE INDEX idx_producer_deliveries_week ON producer_deliveries(organization_id, week_id);
CREATE INDEX idx_audit_entity ON audit_logs(organization_id, entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(organization_id, created_at DESC);

COMMIT;
