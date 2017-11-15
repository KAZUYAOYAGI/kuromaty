import { BarColumn, ColorOption } from "../kuromaty";
import { Chart } from "../kuromaty";
import { ChartDimensions, Overlay } from "../Overlay";
import assign from "object.assign";

export class BollingerBand implements Overlay {
    minPeriod: number = 1;

    get requiredBackCount(): number {
        return this.options.periodLength - 1;
    }

    options: Config = {
        periodLength: 20,
        factor: 2,
        colorKey: "grid"
    };

    constructor(options: Options = {}) {
        assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, color: ColorOption) {

        const options = this.options;
        const ctx = chart.context;
        const barX = dimensions.width - dimensions.rightMargin - 0.5;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barCount = dimensions.barCount;
        const band = this.calculateBollingerBand(chart, barCount);
        const bandLength = band.length;
        const factor = options.factor;

        if (band.length === 0) {
            return;
        }

        ctx.save();

        ctx.strokeStyle = color[this.options.colorKey];
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);

        // 上の線
        ctx.beginPath();
        ctx.moveTo(barX, pointToY(band[0], 1));
        for (let i = 1, x = barX; i < bandLength; i++) {
            x -= barW;
            ctx.lineTo(x, pointToY(band[i], 1));
        }

        // 下の線
        ctx.moveTo(barX, pointToY(band[0], -1));
        for (let i = 1, x = barX; i < bandLength; i++) {
            x -= barW;
            ctx.lineTo(x, pointToY(band[i], -1));
        }
        ctx.stroke();

        ctx.restore();

        function pointToY(point: BandPoint, sign: number) {
            const p = point.average + (sign * factor * point.sigma);
            return Math.round((chart.highest - p) * chart.ratio) + 0.5;
        }
    }

    private calculateBollingerBand(chart: Chart, count: number) {

        const periodLength = this.options.periodLength;
        const band: BandPoint[] = [];

        for (let i = 0; i < count; i++) {
            if (!chart._bars[i] || !chart._bars[i + periodLength]) {
                break;
            }

            let sum = 0;
            for (let j = 0; j < periodLength; j++) {
                sum += chart._bars[i + j][BarColumn.Close];
            }

            const mean = sum / periodLength;

            let variance = 0;
            for (let j = 0; j < periodLength; j++) {
                const diff = chart._bars[i + j][BarColumn.Close] - mean;
                variance += diff * diff;
            }

            variance /= periodLength - 1;

            band.push({
                average: mean,
                sigma: Math.sqrt(variance)
            });
        }

        return band;
    }
}

export interface Config {
    periodLength: number;
    factor: number;
    colorKey: string;
}

export type Options = Partial<Config>;

interface BandPoint {
    average: number;
    sigma: number;
}
