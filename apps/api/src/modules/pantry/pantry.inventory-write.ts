import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface InventoryConsumptionCandidate {
  id: number;
  exactQuantity: Prisma.Decimal | number | string | null;
  exactUnitId: number | null;
  reservedQuantity: Prisma.Decimal | number | string | null;
  available: boolean;
  expireAt: Date | null;
  createdAt: Date;
  version: number;
}

export interface InventoryConsumptionAllocation {
  batchId: number;
  quantity: string;
  unitId: number;
}

export interface InventoryConsumptionPlan {
  allocations: InventoryConsumptionAllocation[];
}

export interface BestEffortInventoryConsumptionPlan extends InventoryConsumptionPlan {
  unfulfilledQuantity: string;
}

function decimal(value: Prisma.Decimal | number | string | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

function requestedDecimal(value: Prisma.Decimal | number | string) {
  try {
    const result = new Prisma.Decimal(value);
    if (!result.isFinite() || result.lte(0)) throw new Error();
    return result;
  } catch {
    throw new BadRequestException("扣减数量必须是大于 0 的有效数字");
  }
}

function compareCandidates(left: InventoryConsumptionCandidate, right: InventoryConsumptionCandidate) {
  if (left.expireAt === null && right.expireAt !== null) return 1;
  if (left.expireAt !== null && right.expireAt === null) return -1;
  if (left.expireAt !== null && right.expireAt !== null) {
    const expireDiff = left.expireAt.getTime() - right.expireAt.getTime();
    if (expireDiff !== 0) return expireDiff;
  }
  const createdDiff = left.createdAt.getTime() - right.createdAt.getTime();
  return createdDiff || left.id - right.id;
}

export function planInventoryConsumption(
  candidates: InventoryConsumptionCandidate[],
  requestedQuantity: Prisma.Decimal | number | string,
  requestedUnitId: number
): InventoryConsumptionPlan {
  const demand = requestedDecimal(requestedQuantity);

  const active = candidates.filter(candidate => candidate.available && decimal(candidate.exactQuantity)?.gt(0));
  const visibleActive = candidates.filter(candidate => candidate.available);
  const comparable = active.filter(candidate => candidate.exactUnitId === requestedUnitId);
  if (!comparable.length) {
    if (visibleActive.length) throw new ConflictException("数量待确认，暂时不能自动扣减");
    throw new ConflictException("库存不足");
  }

  const ordered = [...comparable].sort(compareCandidates);
  const remainingTotal = ordered.reduce((total, candidate) => {
    const quantity = decimal(candidate.exactQuantity)!;
    const reserved = decimal(candidate.reservedQuantity) ?? new Prisma.Decimal(0);
    return total.add(Prisma.Decimal.max(quantity.sub(reserved), 0));
  }, new Prisma.Decimal(0));
  if (remainingTotal.lt(demand)) throw new ConflictException("库存不足");

  let remainingDemand = demand;
  const allocations: InventoryConsumptionAllocation[] = [];
  for (const candidate of ordered) {
    if (remainingDemand.lte(0)) break;
    const quantity = decimal(candidate.exactQuantity)!;
    const reserved = decimal(candidate.reservedQuantity) ?? new Prisma.Decimal(0);
    const remaining = Prisma.Decimal.max(quantity.sub(reserved), 0);
    if (remaining.lte(0)) continue;
    const consumed = Prisma.Decimal.min(remaining, remainingDemand);
    allocations.push({
      batchId: candidate.id,
      quantity: consumed.toString(),
      unitId: requestedUnitId
    });
    remainingDemand = remainingDemand.sub(consumed);
  }

  return { allocations };
}

export function planBestEffortInventoryConsumption(
  candidates: InventoryConsumptionCandidate[],
  requestedQuantity: Prisma.Decimal | number | string,
  requestedUnitId: number
): BestEffortInventoryConsumptionPlan {
  const demand = requestedDecimal(requestedQuantity);

  const ordered = candidates
    .filter(candidate => candidate.available && decimal(candidate.exactQuantity)?.gt(0) && candidate.exactUnitId === requestedUnitId)
    .sort(compareCandidates);
  let remainingDemand = demand;
  const allocations: InventoryConsumptionAllocation[] = [];

  for (const candidate of ordered) {
    if (remainingDemand.lte(0)) break;
    const quantity = decimal(candidate.exactQuantity)!;
    const reserved = decimal(candidate.reservedQuantity) ?? new Prisma.Decimal(0);
    const remaining = Prisma.Decimal.max(quantity.sub(reserved), 0);
    if (remaining.lte(0)) continue;
    const consumed = Prisma.Decimal.min(remaining, remainingDemand);
    allocations.push({
      batchId: candidate.id,
      quantity: consumed.toString(),
      unitId: requestedUnitId
    });
    remainingDemand = remainingDemand.sub(consumed);
  }

  return {
    allocations,
    unfulfilledQuantity: Prisma.Decimal.max(remainingDemand, 0).toString()
  };
}
