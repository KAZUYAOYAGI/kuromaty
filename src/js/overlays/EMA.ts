import { BarColumn, ColorOption } from "../kuromaty";
import { Chart } from "../kuromaty";
import { ChartDimensions, Overlay } from "../Overlay";
import assign from "object.assign";

export class EMA implements Overlay {
    minPeriod: number = 1;

    get requiredBackCount(): number {
        return this.options.backCount;
    }

    options = {
        period: 20,
        backCount: 40,
        colorKey: "lineMA1"
    };

    constructor(options: Options = {}) {
        assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, colors: ColorOption) {

        const ctx = chart.context;
        const barX = dimensions.width - dimensions.rightMargin - 0.5;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barCount = dimensions.barCount;
        const ema = this.calculateEMA(chart, barCount);

        if (ema.length === 0) {
            return;
        }

        ctx.save();

        ctx.strokeStyle = colors[this.options.colorKey];
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(barX, pointToY(ema[0]));
        const emaLength = Math.min(ema.length, barCount);
        for (let i = 0, x = barX; i < emaLength; i++) {
            x -= barW;
            ctx.lineTo(x, pointToY(ema[i]));
        }

        ctx.stroke();
        ctx.restore();

        function pointToY(price: number) {
            return Math.round((chart.highest - price) * chart.ratio) + 0.5;
        }
    }

    private calculateEMA(chart: Chart, barCount) {

        const ema: number[] = [];
        const period = this.options.period;
        const bars = chart._bars;
        const maxIndex = Math.min(bars.length - period, barCount + this.options.backCount);

        if (bars.length < period) {
            return [];
        }

        let mean;

        {
            // 初期値を計算
            let sum = 0;
            for (let i = 0; i < period; i++) {
                sum += bars[maxIndex + i][BarColumn.Close];
            }
            mean = sum / period;
        }
        ema.unshift(mean);

        const weight = 2 / (period + 1);
        const weight2 = 1 - weight;
        for (let i = maxIndex - 1; i >= 0; i--) {
            mean = weight * bars[i][BarColumn.Close] + weight2 * mean;
            ema.unshift(mean);
        }

        return ema;
    }
}

export interface Config {
    period: number;
    backCount: number;
    colorKey: string;
}

export type Options = Partial<Config>;
