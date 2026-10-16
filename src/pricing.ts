export type PricingRule = {
  method: 'markup' | 'margin';
  rate: number;
  taxes: { name: string; rate: number }[];
};

export function calculatePrice(cost: number, rule: PricingRule) {
  if (!Number.isFinite(cost) || cost < 0) throw new Error('El costo debe ser un número no negativo');
  if (!['markup', 'margin'].includes(rule.method) || !Number.isFinite(rule.rate) || rule.rate < 0 || rule.rate >= 1) {
    throw new Error('Regla de ganancia inválida');
  }
  if (!Array.isArray(rule.taxes) || rule.taxes.some(t => !t.name || !Number.isFinite(t.rate) || t.rate < 0 || t.rate > 1)) {
    throw new Error('Impuestos inválidos');
  }
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = round(rule.method === 'markup' ? cost * (1 + rule.rate) : cost / (1 - rule.rate));
  const taxes = rule.taxes.map(tax => ({ name: tax.name, rate: tax.rate, amount: round(subtotal * tax.rate) }));
  return {
    cost: round(cost), method: rule.method, rate: rule.rate,
    profit: round(subtotal - cost), subtotal, taxes,
    finalPrice: round(subtotal + taxes.reduce((sum, tax) => sum + tax.amount, 0)),
  };
}
