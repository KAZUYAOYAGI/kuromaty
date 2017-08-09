/*!
    Copyright 2017 Kuromatch
*/

export function zeroPadding(number: number, length: number): string {
    return (Array(length).join("0") + number).slice(-length);
}

export function fixedDecimal(number: number, length: number): string {
    // 仮
    if (length === 0) {
        return number.toString(10);
    } else {
        return (number + Array(length).join("0")).slice(0, 2 + length);
    }
}

export function toStringWithSign(number: number): string {
   return (number > 0 ? "+" : "") + number.toString(10);
}
