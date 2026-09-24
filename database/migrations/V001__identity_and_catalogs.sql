BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS colheita AUTHORIZATION colheita_owner;
SET ROLE colheita_owner;
SET search_path TO colheita, public;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name varchar(180) NOT NULL,
  trade_name varchar(120) NOT NULL,
  slug varchar(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  document varchar(18),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(140) NOT NULL,
  email citext NOT NULL UNIQUE,
  password_hash varchar(100) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  failed_login_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id smallserial PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE,
  name varchar(80) NOT NULL,
  description varchar(240),
  system_role boolean NOT NULL DEFAULT true
);

CREATE TABLE permissions (
  id smallserial PRIMARY KEY,
  code varchar(80) NOT NULL UNIQUE,
  description varchar(240) NOT NULL
);

CREATE TABLE role_permissions (
  role_id smallint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id smallint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id smallint NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id),
  user_agent varchar(300),
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, user_id) REFERENCES organization_members(organization_id, user_id) ON DELETE CASCADE,
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_members_user ON organization_members(user_id) WHERE active;

CREATE TABLE settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  logistics_deduction_per_kg numeric(10,2) NOT NULL DEFAULT 3.67 CHECK (logistics_deduction_per_kg >= 0),
  pnae_annual_limit numeric(14,2) NOT NULL DEFAULT 40000 CHECK (pnae_annual_limit > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  slug varchar(100) NOT NULL,
  name varchar(140) NOT NULL,
  unit varchar(12) NOT NULL DEFAULT 'KG',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id)
);

CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code varchar(40) NOT NULL,
  name varchar(180) NOT NULL,
  neighborhood varchar(120),
  address varchar(240),
  phone varchar(30),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, id)
);

CREATE TABLE producers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  internal_id varchar(40) NOT NULL,
  name varchar(180) NOT NULL,
  document varchar(18),
  phone varchar(30),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, internal_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE return_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code integer NOT NULL CHECK (code > 0),
  description varchar(180) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, id)
);

CREATE TABLE prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (
    organization_id WITH =,
    product_id WITH =,
    tstzrange(valid_from, COALESCE(valid_to, 'infinity'), '[)') WITH &&
  )
);

CREATE INDEX idx_prices_current ON prices(organization_id, product_id) WHERE valid_to IS NULL;

CREATE TABLE production_map_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  producer_id uuid NOT NULL,
  cycle_year smallint NOT NULL CHECK (cycle_year BETWEEN 2020 AND 2200),
  oct_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (oct_qty >= 0),
  nov_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (nov_qty >= 0),
  dec_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (dec_qty >= 0),
  jan_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (jan_qty >= 0),
  feb_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (feb_qty >= 0),
  mar_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (mar_qty >= 0),
  apr_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (apr_qty >= 0),
  may_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (may_qty >= 0),
  jun_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (jun_qty >= 0),
  jul_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (jul_qty >= 0),
  aug_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (aug_qty >= 0),
  sep_qty numeric(10,2) NOT NULL DEFAULT 0 CHECK (sep_qty >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, producer_id) REFERENCES producers(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, cycle_year, product_id, producer_id)
);

COMMIT;
