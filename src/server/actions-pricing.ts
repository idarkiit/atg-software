'use server';

import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth';
import {
  approveProposal,
  createProposal,
  deleteSupplierPrice,
  getPriceHistory,
  rejectProposal,
  saveAvgCost,
  saveSupplierPrice,
  withdrawProposal,
  type ApproveInput,
  type PriceHistoryRow,
  type ProposalInput,
  type Result,
  type SupplierPriceInput,
} from './pricing';

/** Server actions of the "Quản lý bảng giá" module. Permission checks live in pricing.ts. */

function done(result: Result): Result {
  if (result.ok) revalidatePath('/bang-gia', 'layout');
  return result;
}

export async function saveSupplierPriceAction(input: SupplierPriceInput): Promise<Result> {
  return done(await saveSupplierPrice(await requireUser(), input));
}

export async function deleteSupplierPriceAction(id: number): Promise<Result> {
  return done(await deleteSupplierPrice(await requireUser(), id));
}

export async function saveAvgCostAction(input: {
  productId: number;
  avgCost: number | null;
  extraCost: number | null;
  note: string;
}): Promise<Result> {
  return done(await saveAvgCost(await requireUser(), input));
}

export async function createProposalAction(input: ProposalInput): Promise<Result> {
  return done(await createProposal(await requireUser(), input));
}

export async function withdrawProposalAction(id: number): Promise<Result> {
  return done(await withdrawProposal(await requireUser(), id));
}

export async function approveProposalAction(input: ApproveInput): Promise<Result> {
  const result = done(await approveProposal(await requireUser(), input));
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function rejectProposalAction(id: number, note: string): Promise<Result> {
  const result = done(await rejectProposal(await requireUser(), id, note));
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function getPriceHistoryAction(productId: number): Promise<PriceHistoryRow[]> {
  return getPriceHistory(await requireUser(), productId);
}
