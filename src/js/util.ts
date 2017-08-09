/*!
    Copyright 2017 Kuromatch
*/

export function zeroPadding(number: number, length: number) {
    return (Array(length).join("0") + number).slice(-length);
}

export function toStringWithSign(number: number): string {
    return (number > 0 ? "+" : "") + number.toString(10);
}
