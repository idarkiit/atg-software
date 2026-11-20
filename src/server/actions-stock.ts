'use server';

import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth';
import {cancelDoc, createDoc, type DocInput, type DocResult} from './stock';
import {recordPayment, type PaymentInput} from './debt';

/** Server actions for warehouse vouchers (phiếu) and debt payments. */

export async function createDocAction(input: DocInput): Promise<DocResult> {
  const user = await requireUser();
  const result = await createDoc(user, input);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function cancelDocAction(id: number, reason: string): Promise<DocResult> {
  const user = await requireUser();
  const result = await cancelDoc(user, id, reason);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function recordPaymentAction(input: PaymentInput) {
  const user = await requireUser();
  const result = await recordPayment(user, input);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

