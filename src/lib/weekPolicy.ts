export interface OperationalWeekDates {
  referenceDate: Date;
  startDate: Date;
  endDate: Date;
}

export interface OrderedProducerLine {
  producerId: string;
  productId: string;
  orderedQty: number;
}

export interface DeliveredProducerLine {
  producerId: string;
  productId: string;
}

export interface OrderedSchoolLine {
  schoolId: string;
  orderedQty: number;
}

export interface DeliveredSchoolLine {
  schoolId: string;
}

export interface WeekClosingBlockers {
  pendingProducerDeliveries: number;
  pendingSchoolDeliveries: number;
  total: number;
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

// SPEC-001 CA-01.1/01.2
export function validateOperationalWeekDates(dates: OperationalWeekDates): string | null {
  const { referenceDate, startDate, endDate } = dates;
  if (![referenceDate, startDate, endDate].every(isValidDate)) {
    return "Informe datas validas para a semana.";
  }
  if (startDate > endDate) {
    return "A data inicial nao pode ser posterior a data final.";
  }
  if (referenceDate < startDate || referenceDate > endDate) {
    return "A data de referencia precisa estar dentro do periodo da semana.";
  }
  return null;
}

// SPEC-001 CA-03.1/03.2. Recebe dados simples para manter a regra testavel
// sem depender do banco ou da interface.
export function getWeekClosingBlockers(input: {
  producerOrders: OrderedProducerLine[];
  producerDeliveries: DeliveredProducerLine[];
  schoolOrders: OrderedSchoolLine[];
  schoolDeliveries: DeliveredSchoolLine[];
}): WeekClosingBlockers {
  const deliveredProducerKeys = new Set(
    input.producerDeliveries.map((line) => `${line.producerId}:${line.productId}`),
  );
  const pendingProducerDeliveries = input.producerOrders.filter(
    (line) =>
      line.orderedQty > 0 &&
      !deliveredProducerKeys.has(`${line.producerId}:${line.productId}`),
  ).length;

  const schoolsWithOrders = new Set(
    input.schoolOrders.filter((line) => line.orderedQty > 0).map((line) => line.schoolId),
  );
  const schoolsWithDelivery = new Set(input.schoolDeliveries.map((line) => line.schoolId));
  const pendingSchoolDeliveries = [...schoolsWithOrders].filter(
    (schoolId) => !schoolsWithDelivery.has(schoolId),
  ).length;

  return {
    pendingProducerDeliveries,
    pendingSchoolDeliveries,
    total: pendingProducerDeliveries + pendingSchoolDeliveries,
  };
}

