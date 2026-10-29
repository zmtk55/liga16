/** Parse manually entered MXN without rounding extra precision or accepting exponents. */
export function parsePaymentCents(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Escribe un importe válido, sin negativos y con máximo dos decimales.');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 2147483647) throw new Error('El importe excede el límite permitido.');
  return cents;
}
