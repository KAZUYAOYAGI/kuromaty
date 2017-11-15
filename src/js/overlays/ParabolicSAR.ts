import { BarColumn, ColorOption } from "../kuromaty";
import { Chart } from "../kuromaty";
import { ChartDimensions, Overlay } from "../Overlay";
import assign from "object.assign";

export class ParabolicSAR implements Overlay {
    minPeriod: number = 1;

    readonly requiredBackCount: number = 1;

    options: Config = {
        afStep: 0.025,
        maxAf: 0.050,
        colorKey: "textWeak"
    };

    constructor(options: Options = {}) {
        assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, color: ColorOption) {

        const { maxAf, afStep } = this.options;
        const ctx = chart.context;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barX = dimensions.width - dimensions.rightMargin - Math.ceil(dimensions.barWidth / 2) + 0.5 /* hige width */;
        const barCount = dimensions.barCount;
        const bars = chart._bars;

        if (bars.length < 2) {
            return;
        }

        const oldestBarIndex = bars.length - 1;
        let af = afStep;
        let isUpTrend = false;
        let ep = bars[oldestBarIndex - 1][BarColumn.Low];
        let sar = Math.max(bars[oldestBarIndex][BarColumn.High], bars[oldestBarIndex - 1][BarColumn.High]);
        let x = barX - Math.min(barCount, oldestBarIndex) * barW;

        ctx.save();

        ctx.fillStyle = color[this.options.colorKey];
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);

        for (let i = oldestBarIndex - 1; i >= 0; i--) {
            const bar = bars[i];
            const prevBar = bars[i + 1];
            const prevEp = ep;
            const prevIsUpTrend = isUpTrend;

            // trend switch check
            if (isUpTrend) {
                if (sar > bar[BarColumn.Low]) {
                    isUpTrend = false;
                    sar = ep;
                    ep = bar[BarColumn.Low];
                    af = afStep;
                }
            } else {
                if (sar < bar[BarColumn.High]) {
                    isUpTrend = true;
                    sar = ep;
                    ep = bar[BarColumn.High];
                    af = afStep;
                }
            }

            if (i < barCount) {
                x += barW;
                ctx.beginPath();
                ctx.arc(x, (chart.highest - sar) * chart.ratio, 1, 0, 2 * Math.PI);
                ctx.fill();
            }

            if (prevIsUpTrend === isUpTrend) {
                if (isUpTrend) {
                    ep = Math.max(bar[BarColumn.High], prevEp);
                } else {
                    ep = Math.min(bar[BarColumn.Low], prevEp);
                }

                if (prevEp !== ep) {
                    af = Math.min(af + afStep, maxAf);
                }
            }

            sar = sar * (1 - af) + af * ep;
            if (isUpTrend) {
                if (sar > bar[BarColumn.Low] || sar > prevBar[BarColumn.Low]) {
                    sar = Math.min(bar[BarColumn.Low], prevBar[BarColumn.Low]);
                }
            } else {
                if (sar < bar[BarColumn.High] || sar < prevBar[BarColumn.High]) {
                    sar = Math.max(bar[BarColumn.High], prevBar[BarColumn.High]);
                }
            }
        }

        ctx.restore();
    }
}

export interface Config {
    afStep: number;
    maxAf: number;
    colorKey: string;
}

export type Options = Partial<Config>;
