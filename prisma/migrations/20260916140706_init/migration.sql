-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('TRANSPORTE', 'MONTAGEM', 'ADMINISTRATIVO', 'EMBALAGENS_MATERIAL_LIMPEZA', 'MATERIAL_ESCRITORIO', 'IMPOSTOS', 'SERVICO_CONTABILIDADE', 'AJUDA_CUSTO_CONSELHO');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "neighborhood" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producers" (
    "id" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_reasons" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_map_entries" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "out" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nov" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dez" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "jan" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fev" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mar" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "abr" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mai" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "jun" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "jul" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ago" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "set" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "production_map_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "logisticsDeductionPerKg" DECIMAL(10,2) NOT NULL DEFAULT 3.67,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_orders" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderedQty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "returnedQty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "returnReasonId" TEXT,
    "pricePerKgSnapshot" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producer_orders" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderedQty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deliveredQty" DECIMAL(10,2),
    "returnedQty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "returnReasonId" TEXT,
    "pricePerKgSnapshot" DECIMAL(10,2) NOT NULL,
    "logisticsDeductionSnapshot" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_costs" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "weekly_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");

-- CreateIndex
CREATE UNIQUE INDEX "producers_internalId_key" ON "producers"("internalId");

-- CreateIndex
CREATE UNIQUE INDEX "return_reasons_code_key" ON "return_reasons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "production_map_entries_productId_producerId_key" ON "production_map_entries"("productId", "producerId");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_number_key" ON "weeks"("number");

-- CreateIndex
CREATE INDEX "school_orders_weekId_idx" ON "school_orders"("weekId");

-- CreateIndex
CREATE INDEX "school_orders_schoolId_idx" ON "school_orders"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "school_orders_weekId_schoolId_productId_key" ON "school_orders"("weekId", "schoolId", "productId");

-- CreateIndex
CREATE INDEX "producer_orders_weekId_idx" ON "producer_orders"("weekId");

-- CreateIndex
CREATE INDEX "producer_orders_producerId_idx" ON "producer_orders"("producerId");

-- CreateIndex
CREATE UNIQUE INDEX "producer_orders_weekId_producerId_productId_key" ON "producer_orders"("weekId", "producerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_costs_weekId_category_key" ON "weekly_costs"("weekId", "category");

-- AddForeignKey
ALTER TABLE "production_map_entries" ADD CONSTRAINT "production_map_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_map_entries" ADD CONSTRAINT "production_map_entries_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_orders" ADD CONSTRAINT "school_orders_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_orders" ADD CONSTRAINT "school_orders_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_orders" ADD CONSTRAINT "school_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_orders" ADD CONSTRAINT "school_orders_returnReasonId_fkey" FOREIGN KEY ("returnReasonId") REFERENCES "return_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer_orders" ADD CONSTRAINT "producer_orders_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer_orders" ADD CONSTRAINT "producer_orders_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer_orders" ADD CONSTRAINT "producer_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer_orders" ADD CONSTRAINT "producer_orders_returnReasonId_fkey" FOREIGN KEY ("returnReasonId") REFERENCES "return_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_costs" ADD CONSTRAINT "weekly_costs_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
