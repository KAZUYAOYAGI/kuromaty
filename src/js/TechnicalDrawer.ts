"use strict";
import {Chart, ColorOption} from "./kuromaty";
import {JSONSchema4} from "json-schema";

export interface TechnicalDrawer {
    /**
     * テクニカル指標を描画します
     *
     * @param {Chart} chart
     * @param {ChartDimensions} dimensions
     * @param period
     * @param {ColorOption} colors
     */
    draw(chart: Chart, dimensions: ChartDimensions, period: number, colors: ColorOption);
}

export interface ChartDimensions {
    readonly width: number;
    readonly height: number;
    readonly rightMargin: number;
    readonly firstBarIndex: number;
    readonly barCount: number;
    readonly barWidth: number;
    readonly barMargin: number;
}
