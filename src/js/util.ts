/*!
    Copyright 2017 Kuromatch
*/
import flagrate from "flagrate/lib/es6/flagrate";

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

export function generatePriceGrouping(decimal, groupSize: number): (price: number) => number {
    if (decimal === 1) {
        return (price) => Math.round(price / groupSize) * groupSize;
    }

    return (price) => Math.round(price * (decimal / groupSize)) / (decimal / groupSize);
}

export function toStringWithSign(number: number): string {
    return (number > 0 ? "+" : "") + number.toString(10);
}

export function copyTextToClipboard(text: string): void {

    const span = flagrate.createElement("span")
        .insertText(text)
        .insertTo(document.body);

    const range = document.createRange();
    range.selectNode(span);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand("copy");

    span.remove();
}
