import { isSamePrice } from "./update-pricing.js";

test('isSamePrice', () => {
    expect(isSamePrice('12.99', '12.99', 'EUR')).toBe(true);
    expect(isSamePrice('12,99', '12.99', 'EUR')).toBe(true);
    expect(isSamePrice('12.99', '12,99', 'EUR')).toBe(true);
    expect(isSamePrice('13', '13.00', 'USD')).toBe(true);
    expect(isSamePrice('12,99', '12.98', 'EUR')).toBe(false);
    expect(isSamePrice('', '0', 'USD')).toBe(false);
    expect(isSamePrice('', '', 'USD')).toBe(true);
    expect(isSamePrice('abc', 'abc', 'USD')).toBe(true);
    expect(isSamePrice('abc', 'abd', 'USD')).toBe(false);
});

test('isSamePrice yen', () => {
    expect(isSamePrice('1,500', '1500', 'JPY')).toBe(true);
    expect(isSamePrice('1500', '1,500', 'JPY')).toBe(true);
    expect(isSamePrice('12,500', '12500', 'JPY')).toBe(true);
    expect(isSamePrice('1,500', '1.5', 'JPY')).toBe(false);
    expect(isSamePrice('1,500', '1600', 'JPY')).toBe(false);
});
