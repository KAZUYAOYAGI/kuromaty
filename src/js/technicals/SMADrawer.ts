"use strict";
import {ChartDimensions, TechnicalDrawer} from "../TechnicalDrawer";
import {BarColumn, ColorOption} from "../kuromaty";
import {Chart} from "../kuromaty";

export class SMADrawer implements TechnicalDrawer {
    public options = {
        shortPeriod: 10,
        middlePeriod: 21,
        longPeriod: 34
    };

    constructor(options: Options = {}) {
        Object.assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, period: number, colors: ColorOption) {
        const options = this.options;
        const ctx = chart.context;
        const barX = dimensions.width - dimensions.rightMargin - 0.5;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barCount = dimensions.barCount;

        if (period === 0) {
            // tick (special)
            SMADrawer._drawSMA(ctx, barX, barW, chart, barCount, 1, colors.text);
        } else {
            SMADrawer._drawSMA(ctx, barX, barW, chart, barCount, options.shortPeriod, colors.lineMA1);
            SMADrawer._drawSMA(ctx, barX, barW, chart, barCount, options.middlePeriod, colors.lineMA2);
            SMADrawer._drawSMA(ctx, barX, barW, chart, barCount, options.longPeriod, colors.lineMA3);
        }
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

export interface Options {
    shortPeriod?: number;
    middlePeriod?: number;
    longPeriod?: number;
}
