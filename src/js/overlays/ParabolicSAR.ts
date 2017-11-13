"use strict";
import {BarColumn, ColorOption} from "../kuromaty";
import {Chart} from "../kuromaty";
import {ChartDimensions, Overlay} from "../Overlay";

export class ParabolicSAR implements Overlay {
    minPeriod: number = 1;
    public options: Config = {
        afStep: 0.02,
        maxAf: 0.2,
    };

    constructor(options: Options = {}) {
        Object.assign(this.options, options);
    }

    draw(chart: Chart, dimensions: ChartDimensions, colors: ColorOption) {
        const {maxAf, afStep} = this.options;
        const ctx = chart.context;
        const barW = dimensions.barMargin + dimensions.barWidth;
        const barX = dimensions.width - dimensions.rightMargin - Math.ceil(barW/2) + 2;
        const barCount = dimensions.barCount;
        const bars = chart._bars;

        if (bars.length < 2) {
            return;
        }

        const oldestBarIndex = bars.length - 1;
        let af = afStep;
        let isUpTrend = false;
        let ep = bars[oldestBarIndex -1][BarColumn.Low];
        let sar = Math.max(bars[oldestBarIndex][BarColumn.High], bars[oldestBarIndex- 1][BarColumn.High]);
        let x = barX - Math.min(barCount, oldestBarIndex) * barW;

        ctx.save();

        ctx.fillStyle = colors.text;
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
                ctx.beginPath();
                ctx.arc(x, (chart.highest - sar) * chart.ratio, 1,0, 2 * Math.PI);
                ctx.fill();
                x += barW;
            }

            if (prevIsUpTrend === isUpTrend) {
                if (isUpTrend) {
                    ep = Math.max(bar[BarColumn.High], prevEp);
                } else {
                    ep = Math.min(bar[BarColumn.Low], prevEp);
                }

                if (prevEp != ep) {
                    af = Math.min(af + afStep, maxAf);
                }
            }

            sar = sar + af * (ep - sar);
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
}

export type Options = Partial<Config>;
