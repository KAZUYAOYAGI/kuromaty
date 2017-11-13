import { BarColumn, ColorOption } from "../kuromaty";
import { Chart } from "../kuromaty";
import { ChartDimensions, Overlay } from "../Overlay";

export class EMA implements Overlay {
    minPeriod: number = 1;

    public options = {
        period: 20,
        colorKey: "lineMA1"
    };

    constructor(options: Options = {}) {
        Object.assign(this.options, options);
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
        const maxIndex = Math.min(bars.length - period, barCount);

        if (bars.length < period) {
            return [];
        }

        let avg;

        {
            // 初期値を計算
            let sum = 0;
            for (let i = 0; i < period; i++) {
                sum += bars[maxIndex + i][BarColumn.Close];
            }
            avg = sum / period;
        }
        ema.unshift(avg);

        for (let i = maxIndex - 1; i >= 0; i--) {
            avg = avg + 2 * (bars[i][BarColumn.Close] - avg) / (period + 1);
            ema.unshift(avg)
        }

        return ema;
    }
}

export interface Config {
    period: number;
    colorKey: string;
}

export type Options = Partial<Config>;
