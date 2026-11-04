export const entryPaymentRelease={available:true};
export async function listEntryPayments(){return [];}
export async function recoverPendingCreates(){return [];}
export async function recordEntryPayment(){throw new Error("Fixture: no se guardan pagos");}
export async function ensureTournamentEntry(){throw new Error("Fixture: no se crean inscripciones");}
export async function createEntryResource(){throw new Error("Fixture: no se crean registros");}
export type EntryPayment=import("../lib/entry-payment-service").EntryPayment;
export type IndividualEntryRecord=import("../lib/entry-payment-service").IndividualEntryRecord;
