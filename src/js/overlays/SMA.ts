import { ChartDimensions, Overlay } from "../Overlay";
import { BarColumn, ColorOption } from "../kuromaty";
import { Chart } from "../kuromaty";
import assign from "object.assign";

export class SMA implements Overlay {
    minPeriod = 1;

    get requiredBackCount(): number {
        return this.options.period - 1;
    }

    options: Config = {
        period: 10,
        colorKey: "lineMA1"
    };

    constructor(options: Options = {}) {
        assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, colorOption: ColorOption) {

        const options = this.options;
        const ctx = chart.context;
        const barX = dimensions.width - dimensions.rightMargin - 0.5;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barCount = dimensions.barCount;
        const color = colorOption[options.colorKey];
        const period = options.period;

        ctx.save();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
        ctx.beginPath();

        let i = 0;
        let j;
        let p = 0;
        let y = 0;
        let x = barX + barW;

        for (; i < barCount; i++) {
            if (!chart._bars[i] || !chart._bars[i + period]) {
                break;
            }
            x -= barW;

            p = 0;
            for (j = 0; j < period; j++) {
                p += chart._bars[i + j][BarColumn.Close];
            }
            p /= period;
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
