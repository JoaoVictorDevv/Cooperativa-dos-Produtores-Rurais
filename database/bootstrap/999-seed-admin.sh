#!/bin/sh
set -eu

if [ "${#COLHEITA_ADMIN_PASSWORD}" -lt 12 ]; then
  echo "COLHEITA_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres." >&2
  exit 1
fi

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=admin_email="$COLHEITA_ADMIN_EMAIL" \
  --set=admin_password="$COLHEITA_ADMIN_PASSWORD" <<'SQL'
WITH organization AS (
  INSERT INTO colheita.organizations (legal_name, trade_name, slug)
  VALUES ('Cooperativa dos Produtores Rurais de Petrópolis', 'Colheita', 'colheita-petropolis')
  ON CONFLICT (slug) DO UPDATE SET updated_at = now()
  RETURNING id
), created_user AS (
  INSERT INTO colheita.users (name, email, password_hash, email_verified_at)
  VALUES ('Administrador', lower(:'admin_email'), crypt(:'admin_password', gen_salt('bf', 12)), now())
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true, updated_at = now()
  RETURNING id
)
INSERT INTO colheita.organization_members (organization_id, user_id, role_id)
SELECT organization.id, created_user.id, roles.id
FROM organization
CROSS JOIN created_user
CROSS JOIN colheita.roles AS roles
WHERE roles.code = 'ADMIN'
ON CONFLICT (organization_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id, active = true, updated_at = now();
SQL
