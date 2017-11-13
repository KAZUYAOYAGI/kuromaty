import { ChartDimensions, Overlay } from "../Overlay";
import { BarColumn, ColorOption } from "../kuromaty";
import { Chart } from "../kuromaty";

export class SMA implements Overlay {
    minPeriod = 1;

    options: Config = {
        period: 10,
        colorKey: "lineMA1"
    };

    constructor(options: Options = {}) {
        Object.assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, color: ColorOption) {

        const options = this.options;
        const ctx = chart.context;
        const barX = dimensions.width - dimensions.rightMargin - 0.5;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barCount = dimensions.barCount;

        SMA._drawSMA(ctx, barX, barW, chart, barCount, options.period, color[options.colorKey]);
    }

    private static _drawSMA(ctx: CanvasRenderingContext2D,
        x: number, barW: number, chart: Chart, count: number, periodLength: number, color: string) {

        x = x + barW;

        ctx.save();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
        ctx.beginPath();

        let i = 0,
            j,
            p = 0,
            y = 0;
        for (; i < count; i++) {
            if (!chart._bars[i] || !chart._bars[i + periodLength]) {
                break;
            }
            x -= barW;

            p = 0;
            for (j = 0; j < periodLength; j++) {
                p += chart._bars[i + j][BarColumn.Close];
            }
            p /= periodLength;
            y = Math.round((chart.highest - p) * chart.ratio) + 0.5;

            if (i === 0) {
                ctx.moveTo(x, y);
            }
            ctx.lineTo(x, y);
        }

        ctx.stroke();

        ctx.restore();
    }
}

export interface Config {
    period: number;
    colorKey: string;
}

export type Options = Partial<Config>;
