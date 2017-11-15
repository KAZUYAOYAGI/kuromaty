import { Chart, ColorOption } from "./kuromaty";

export interface Overlay {
    minPeriod: number;
    readonly requiredBackCount: number;

    /**
     * Draws Overlay.
     *
     * @param {Chart} chart
     * @param {ChartDimensions} dimensions
     * @param {ColorOption} color
     */
    draw(chart: Chart, dimensions: ChartDimensions, color: ColorOption);
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
