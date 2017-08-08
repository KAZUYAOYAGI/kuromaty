/*!
    Copyright 2017 Kuromatch
*/

export function zeroPadding(number: number, length: number) {
    return (Array(length).join("0") + number).slice(-length);
}
