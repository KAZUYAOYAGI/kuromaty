import { ChartDimensions, Overlay } from "../Overlay";
import { Bar, BarColumn, Chart, ColorOption } from "../kuromaty";
import assign from "object.assign";

export class ChandelierExit implements Overlay {
    minPeriod: number = 1;

    get requiredBackCount() {
        return Math.max(this.options.backCount, this.options.period);
    }

    options: Config = {
        period: 23,
        factor: 1,
        backCount: 40,
        colorKey: "lineMA2"
    };

    constructor(options: Options = {}) {
        assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, color: ColorOption) {
        const bars = chart._bars;
        const { period, factor } = this.options;
        const barX = dimensions.width - dimensions.rightMargin - Math.ceil(dimensions.barWidth / 2) + 0.5 /* hige width */;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barCount = dimensions.barCount;
        const atrs = this.calculateATR(bars, barCount);
        const ctx = chart.context;
        const maxIndex = atrs.length - period;

        if (maxIndex < 0) {
            return;
        }

        ctx.save();

        ctx.strokeStyle = color[this.options.colorKey];
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);

        ctx.beginPath();

        let highest = -Infinity;
        let highestIndex = Infinity;
        let lowest = Infinity;
        let lowestIndex = Infinity;

        let x = barX - maxIndex * barW;
        let periodEnd = maxIndex + period - 1;
        let isUpTrend = bars[periodEnd][BarColumn.Close] >= bars[periodEnd][BarColumn.Open];
        let isNewTrend = true;
        for (let i = maxIndex; i >= 0; i-- , periodEnd-- , x += barW) {
            const bar = bars[i];
            if (highestIndex > periodEnd) {
                // update highest
                highest = bar[BarColumn.High];
                highestIndex = i;
                for (let j = i + 1; j <= periodEnd; j++) {
                    if (highest < bars[j][BarColumn.High]) {
                        highest = bars[j][BarColumn.High];
                        highestIndex = j;
                    }
                }
            }

            if (lowestIndex > periodEnd) {
                // update lowest
                lowest = bar[BarColumn.Low];
                lowestIndex = i;
                for (let j = i + 1; j <= periodEnd; j++) {
                    if (lowest > bars[j][BarColumn.Low]) {
                        lowest = bars[j][BarColumn.Low];
                        lowestIndex = j;
                    }
                }
            }

            const downTrendChandelier = highest - factor * atrs[i];
            const upTrendChandelier = lowest + factor * atrs[i];

            if (i < barCount) {
                const price = isUpTrend ? upTrendChandelier : downTrendChandelier;
                const y = Math.round((chart.highest - price) * chart.ratio) + 0.5;
                if (isNewTrend) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            const prevIsUpTrend = isUpTrend;
            if (downTrendChandelier > bar[BarColumn.High] && upTrendChandelier >= bar[BarColumn.Low]) {
                isUpTrend = false;
            } else if (downTrendChandelier <= bar[BarColumn.High] && upTrendChandelier < bar[BarColumn.Low]) {
                isUpTrend = true;
            }

            isNewTrend = prevIsUpTrend !== isUpTrend;

            if (highest <= bar[BarColumn.High]) {
                highest = bar[BarColumn.High];
                highestIndex = i;
            }

            if (lowest >= bar[BarColumn.Low]) {
                lowest = bar[BarColumn.Low];
                lowestIndex = i;
            }
        }

        ctx.stroke();
        ctx.restore();
    }

    private calculateATR(bars: Bar[], barCount): number[] {
        const period = this.options.period;
        const maxIndex = Math.min(bars.length - period, barCount + this.options.backCount);

        if (bars.length < period) {
            return [];
        }

        const atrs: number[] = [];
        let atr = 0;

        // 初期値を計算
        for (let i = 0; i < period; i++) {
            atr += tr(maxIndex + i);
        }
        atr /= period;

        atrs.unshift(atr);

        const weight = 2 / (period + 1);
        const weight2 = 1 - weight;
        for (let i = maxIndex - 1; i >= 0; i--) {
            atr = weight * tr(i) + weight2 * atr;
            atrs.unshift(atr);
        }

        return atrs;

        function tr(i: number) {
            const bar = bars[i];
            const prevBar = bars[i + 1];
            if (prevBar) {
                return Math.max(
                    Math.abs(bar[BarColumn.High] - bar[BarColumn.Low]),
                    Math.abs(bar[BarColumn.High] - prevBar[BarColumn.Close]),
                    Math.abs(bar[BarColumn.Low] - prevBar[BarColumn.Close])
                );
            }

            return Math.abs(bar[BarColumn.High] - bar[BarColumn.Low]);
        }
    }
}

export interface Config {
    period: number;
    factor: number;
    backCount: number;
    colorKey: string;
}

export type Options = Partial<Config>;
