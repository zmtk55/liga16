export interface PaymentOperation {requestId: string; expectedRevision: number}
export interface PendingPaymentOperation extends PaymentOperation {signature: string}
/** Keep the same operation after an unknown network result. Never silently replace it. */
export function preparePaymentOperation(
 pending: {current: PendingPaymentOperation | null}, expectedRevision: number | undefined,
 payload: unknown, newId: () => string = () => crypto.randomUUID(),
): PaymentOperation {
 if (!Number.isInteger(expectedRevision) || expectedRevision! < 0) throw new Error('Falta la revisión del pago. Recarga cuando esté habilitada la actualización segura.');
 const signature=JSON.stringify({expectedRevision,payload});
 if (pending.current && pending.current.signature!==signature) throw new Error('Hay un guardado con resultado sin confirmar. Reintenta los mismos datos o recarga para revisar el estado antes de cambiar el importe.');
 if (!pending.current) pending.current={requestId:newId(),expectedRevision:expectedRevision!,signature};
 return {requestId:pending.current.requestId,expectedRevision:pending.current.expectedRevision};
}
