-- SPEC-001 CA-02: consolida eventuais duplicatas legadas antes de aplicar
-- a garantia de uma devolucao por origem/produto/semana.
WITH aggregated AS (
  SELECT
    MIN("id") AS keep_id,
    "weekId",
    "schoolId",
    "productId",
    SUM("returnedQty") AS total_qty
  FROM "school_returns"
  GROUP BY "weekId", "schoolId", "productId"
), updated AS (
  UPDATE "school_returns" AS target
  SET "returnedQty" = aggregated.total_qty
  FROM aggregated
  WHERE target."id" = aggregated.keep_id
  RETURNING target."id"
)
DELETE FROM "school_returns" AS duplicate
USING aggregated
WHERE duplicate."weekId" = aggregated."weekId"
  AND duplicate."schoolId" = aggregated."schoolId"
  AND duplicate."productId" = aggregated."productId"
  AND duplicate."id" <> aggregated.keep_id;

WITH aggregated AS (
  SELECT
    MIN("id") AS keep_id,
    "weekId",
    "producerId",
    "productId",
    SUM("returnedQty") AS total_qty
  FROM "producer_returns"
  GROUP BY "weekId", "producerId", "productId"
), updated AS (
  UPDATE "producer_returns" AS target
  SET "returnedQty" = aggregated.total_qty
  FROM aggregated
  WHERE target."id" = aggregated.keep_id
  RETURNING target."id"
)
DELETE FROM "producer_returns" AS duplicate
USING aggregated
WHERE duplicate."weekId" = aggregated."weekId"
  AND duplicate."producerId" = aggregated."producerId"
  AND duplicate."productId" = aggregated."productId"
  AND duplicate."id" <> aggregated.keep_id;

CREATE UNIQUE INDEX "school_returns_weekId_schoolId_productId_key"
ON "school_returns"("weekId", "schoolId", "productId");

CREATE UNIQUE INDEX "producer_returns_weekId_producerId_productId_key"
ON "producer_returns"("weekId", "producerId", "productId");

-- SPEC-001 CA-01.3: o indice parcial cobre concorrencia entre requisicoes.
-- Se houver duas semanas abertas, esta instrucao falha para exigir revisao
-- humana em vez de fechar uma semana arbitrariamente.
CREATE UNIQUE INDEX "weeks_single_open_key"
ON "weeks" ((1))
WHERE "status" = 'ABERTA';

-- SPEC-001 CA-03.5: toda escrita operacional bloqueia a linha da semana
-- durante a instrucao e falha se ela ja estiver fechada. O mesmo lock e
-- usado pelo fechamento para eliminar a janela de concorrencia.
CREATE OR REPLACE FUNCTION "assert_operational_week_open"()
RETURNS TRIGGER AS $$
DECLARE
  target_week_id TEXT;
  target_status "WeekStatus";
BEGIN
  target_week_id := NEW."weekId";

  SELECT "status" INTO target_status
  FROM "weeks"
  WHERE "id" = target_week_id
  FOR UPDATE;

  IF target_status IS NULL THEN
    RAISE EXCEPTION 'Semana operacional inexistente: %', target_week_id;
  END IF;

  IF target_status <> 'ABERTA' THEN
    RAISE EXCEPTION 'Semana fechada nao pode receber alteracoes: %', target_week_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "school_orders_require_open_week"
BEFORE INSERT OR UPDATE ON "school_orders"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();

CREATE TRIGGER "school_deliveries_require_open_week"
BEFORE INSERT OR UPDATE ON "school_deliveries"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();

CREATE TRIGGER "school_returns_require_open_week"
BEFORE INSERT OR UPDATE ON "school_returns"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();

CREATE TRIGGER "producer_allocations_require_open_week"
BEFORE INSERT OR UPDATE ON "producer_allocations"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();

CREATE TRIGGER "producer_orders_require_open_week"
BEFORE INSERT OR UPDATE ON "producer_orders"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();

CREATE TRIGGER "producer_deliveries_require_open_week"
BEFORE INSERT OR UPDATE ON "producer_deliveries"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();

CREATE TRIGGER "producer_returns_require_open_week"
BEFORE INSERT OR UPDATE ON "producer_returns"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();

CREATE TRIGGER "weekly_costs_require_open_week"
BEFORE INSERT OR UPDATE ON "weekly_costs"
FOR EACH ROW EXECUTE FUNCTION "assert_operational_week_open"();
