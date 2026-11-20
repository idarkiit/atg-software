'use server';

import {can, requireUser} from '@/lib/auth';
import {openDocsOf, partyEntries, stockCard, type OpenDoc, type PartyEntries, type StockCard} from './reports';
import type {DebtParty} from './debt';

/** Detail lookups used by the report dialogs (thẻ kho, sổ công nợ, phiếu còn nợ). */

export async function stockCardAction(input: {productId: number; warehouseId: number | null; tu: string; den: string}): Promise<StockCard | null> {
  const user = await requireUser();
  if (!can(user, 'xuat-nhap/ton-kho', 'view')) return null;
  return stockCard(user, input);
}

const featureOf = (party: DebtParty) => (party === 'customer' ? 'xuat-nhap/cong-no-kh' : 'xuat-nhap/cong-no-ncc');

export async function partyEntriesAction(input: {party: DebtParty; partyId: number; tu: string; den: string}): Promise<PartyEntries | null> {
  const user = await requireUser();
  if (!can(user, featureOf(input.party), 'view') && !(input.party === 'customer' && can(user, 'xuat-nhap/no-qua-han', 'view'))) return null;
  return partyEntries(user, input.party, input.partyId, {tu: input.tu, den: input.den});
}

export async function openDocsAction(input: {party: DebtParty; partyId: number}): Promise<OpenDoc[]> {
  const user = await requireUser();
  if (!can(user, featureOf(input.party), 'view') && !(input.party === 'customer' && can(user, 'xuat-nhap/no-qua-han', 'view'))) return [];
  return openDocsOf(user, input.party, input.partyId);
}
