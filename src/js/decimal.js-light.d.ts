declare module "decimal.js-light" {
    export class Decimal {
        constructor(value: AcceptableValue)
        plus(value: AcceptableValue): Decimal;
        minus(value: AcceptableValue): Decimal;
        equals(value: AcceptableValue): boolean;
        mul(value: AcceptableValue): Decimal;

        toNumber(): number;
        toString(): string;
    }

    export type AcceptableValue = string|number|Decimal;
}
