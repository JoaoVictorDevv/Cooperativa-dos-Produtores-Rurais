export interface WarehouseReceipt {
  grossQty: number | null;
  rejectedQty: number;
  price: number;
  logisticsDeduction: number;
}

export interface SchoolDelivery {
  presentedQty: number | null;
  rejectedQty: number;
  lossBeforeSchoolQty: number;
  sameTrip: boolean;
}

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function acceptedAtWarehouse(receipt: WarehouseReceipt): number | null {
  if (receipt.grossQty === null) return null;
  if (receipt.grossQty < 0 || receipt.rejectedQty < 0 || receipt.rejectedQty > receipt.grossQty) {
    throw new Error("Rejeição no galpão não pode superar a entrega bruta.");
  }
  return round2(receipt.grossQty - receipt.rejectedQty);
}

export function producerPayable(receipt: WarehouseReceipt): number | null {
  const accepted = acceptedAtWarehouse(receipt);
  if (accepted === null) return null;
  return round2(accepted * round2(receipt.price - receipt.logisticsDeduction));
}

export function acceptedAtSchool(events: SchoolDelivery[]): number | null {
  const physicalEvents = events.filter((event) => !event.sameTrip);
  if (physicalEvents.some((event) => event.presentedQty === null)) return null;
  return round2(physicalEvents.reduce((total, event) => {
    const presented = event.presentedQty ?? 0;
    if (presented < 0 || event.rejectedQty < 0 || event.rejectedQty > presented || event.lossBeforeSchoolQty < 0) {
      throw new Error("Quantidades da entrega escolar são inválidas.");
    }
    return total + presented - event.rejectedQty;
  }, 0));
}

export function schoolLineSummary(orderedQty: number, price: number, events: SchoolDelivery[]) {
  const acceptedQty = acceptedAtSchool(events);
  const rejectedQty = round2(events.filter((event) => !event.sameTrip).reduce((sum, event) => sum + event.rejectedQty, 0));
  const lossBeforeSchoolQty = round2(events.filter((event) => !event.sameTrip).reduce((sum, event) => sum + event.lossBeforeSchoolQty, 0));
  return {
    acceptedQty,
    rejectedQty,
    lossBeforeSchoolQty,
    shortageQty: acceptedQty === null ? null : round2(Math.max(orderedQty - acceptedQty, 0)),
    excessQty: acceptedQty === null ? null : round2(Math.max(acceptedQty - orderedQty, 0)),
    receivable: acceptedQty === null ? null : round2(acceptedQty * price),
  };
}
