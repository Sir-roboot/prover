import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice } from '../src/pricing';

test('recargo sobre costo con impuesto configurado', () => {
  assert.deepEqual(calculatePrice(100, { method: 'markup', rate: 0.30, taxes: [{ name: 'Ejemplo', rate: 0.16 }] }), {
    cost: 100, method: 'markup', rate: 0.30, profit: 30, subtotal: 130,
    taxes: [{ name: 'Ejemplo', rate: 0.16, amount: 20.8 }], finalPrice: 150.8,
  });
});

test('margen sobre precio de venta', () => {
  assert.equal(calculatePrice(100, { method: 'margin', rate: 0.30, taxes: [] }).subtotal, 142.86);
});
