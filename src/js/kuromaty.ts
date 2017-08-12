/*!
    Copyright 2017 Kuromatch
*/
import * as util from "./util";

export type PositionSide = "L" | "S";

/** time, open, high, low, close, volume, askDepth, bidDepth */
export type Bar = [number, number, number, number, number, number, number, number];

/** time, ltp, volume, askDepth, bidDepth */
export type Tick = [number, number, number, number, number];

export interface Options {
    chartCount?: number;
    chartTitles?: string[];
    chartOverlay?: boolean;
    barWidth?: number;
    barMargin?: number;
    decimalPower?: number;
}

export interface ColorOption {
    bg?: string;
    text?: string;
    textStrong?: string;
    textWeak?: string;
    short?: string;
    long?: string;
    askOrder?: string;
    bidOrder?: string;
    volume?: string;
    askDepth?: string;
    bidDepth?: string;
    askDepthLast?: string;
    bidDepthLast?: string;
    grid?: string;
    border?: string;
    borderText?: string;
    borderLTP?: string;
    borderLTPText?: string;
    lineMA1?: string;
    lineMA2?: string;
    lineMA3?: string;
}

export interface Board {
    asks: BoardItem[];
    bids: BoardItem[];
}

export interface BoardItem {
    price: number;
    size: number;
}

export interface Chart {
    title: string;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    bars: Bar[];
    _bars: Bar[];
    ticks: Tick[];
    board: Board;
    boardMaxSize: number;
    range: number;
    highest: number;
    highestPrice: number;
    highestPricePrinted: boolean;
    lowest: number;
    lowestPrice: number;
    lowestPricePrinted: boolean;
    askPrice: number;
    bidPrice: number;
    maxVolume: number;
    volumeRatio: number;
    maxDepth: number;
    minDepth: number;
    depthRatio: number;
    latest: number;
    ratio: number;
    tickDelta: number;
    selected: boolean;
}

export interface InLayer {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
}

export interface Position {
    price: number;
    size: number;
    side: PositionSide;
}

export class Kuromaty {

    timePeriod = 1;
    barIndex = 0;
    cursorPrice = 0;
    pinnedPrices: number[] = [];
    positions: Position[] = [];
    maxBarCount = 10000;
    hasDepleted = false;
    color: ColorOption = {
        bg: "#fafafa",
        text: "#333333",
        textStrong: "#111111",
        textWeak: "#777777",
        short: "#e9546b",
        long: "#3eb370",
        askOrder: "#ff303e",
        bidOrder: "#17cb00",
        volume: "#9b7cb6",
        askDepth: "rgba(210,179,189,0.21)",
        bidDepth: "rgba(201,210,179,0.25)",
        askDepthLast: "rgba(210,179,189,0.45)",
        bidDepthLast: "rgba(201,210,179,0.55)",
        grid: "#eeeeee",
        border: "#cccccc",
        borderText: "#111111",
        borderLTP: "rgba(255,150,25,0.6)",
        borderLTPText: "#ffffff",
        lineMA1: "#e9e7c6",
        lineMA2: "#c6e6e9",
        lineMA3: "#e9c6e8"
    };

    cursorX = -1;
    cursorY = -1;
    canvasW = 0;
    canvasH = 0;

    charts: Chart[];
    overlay: InLayer;
    grid: InLayer;
    canvases: HTMLCanvasElement[];
    contexts: CanvasRenderingContext2D[];

    private _rootContainer: HTMLDivElement;
    private _chartContainer: HTMLDivElement;
    private _hasUpdated = false;
    private _hasRemoved = true;
    private _afr: number;
    private _afs = 0;
    private _pricePops: [number, string, string, number, number, boolean][] = [];
    private _lastPointerdown: [number, number] = [0, 0];
    private _lastPointerButtons = 0;
    private _dragStartX: number;
    private _dragStartI: number;
    private _decimal: number;

    constructor(container?: Element, public options: Options = {}) {
        
        if (typeof options.chartCount !== "number") {
            options.chartCount = 1;
        }
        if (options.chartTitles === undefined) {
            options.chartTitles = [];
        }
        if (options.chartOverlay === undefined) {
            options.chartOverlay = false;
        }
        options.barWidth = options.barWidth || 5;
        options.barMargin = options.barMargin || 3;
        options.decimalPower = options.decimalPower || 0;
        this._decimal = parseInt("1" + Array(options.decimalPower + 1).join("0"), 10);

        this._create();

        if (container) {
            this.insertTo(container);
        }
    }

    insertTo(container: Element)  {

        container.appendChild(this._rootContainer);
        
        this.resize();
        this._hasRemoved = false;

        this._redraw();
    }

    remove() {
        
        this._rootContainer.parentNode.removeChild(this._rootContainer);

        this.canvasW = this.canvasH = 0;
        this._hasRemoved = true;

        cancelAnimationFrame(this._afr);
    }

    resize() {

        const w = this.canvasW = this._chartContainer.clientWidth;
        const h = this.canvasH = this._chartContainer.clientHeight;

        for (const canvas of this.canvases) {
            canvas.width = w;
            canvas.height = h;
        }

        this._hasUpdated = true;
    }

    zoom(delta: number) {

        this.options.barWidth = Math.min(11, Math.max(1, this.options.barWidth + delta));

        this._hasUpdated = true;
    }

    update(index: number, bars: Bar[]) {

        this.charts[index].bars = bars;

        this._hasUpdated = true;
    }

    tick(index: number, tick: Tick) {
    
        const chart = this.charts[index];

        chart.tickDelta = 0;
        if (chart.ticks[0] && chart.bars[0][4] !== tick[1]) {
            chart.tickDelta = tick[1] - chart.bars[0][4];
        }
        if (!chart.ticks[0] || 1000 < tick[0] - chart.ticks[0][0]) {
            chart.ticks.unshift(tick);
            if (chart.ticks.length > 250) {
                chart.ticks.pop();
            }
        }
        
        let lastTime = Date.now() - 1000 * 60;
        if (chart.bars.length > 0) {
            lastTime = chart.bars[0][0];
        }

        const bar = chart.bars[0];

        const time = tick[0];
        if (!bar || new Date(lastTime).getMinutes() !== new Date(time).getMinutes()) {
            const delta = Math.floor((time - lastTime) / 1000 / 60);
            for (let i = delta; i > 0; i--) {
                if (i === 1) {
                    chart.bars.unshift([
                        new Date(tick[0]).setSeconds(0, 0),
                        tick[1],
                        tick[1],
                        tick[1],
                        tick[1],
                        tick[2],
                        tick[3],
                        tick[4]
                    ]);
                } else {
                    chart.bars.unshift([
                        new Date(tick[0]).setSeconds(0, 0) - (1000 * 60 * (i - 1)),
                        chart.ticks[0][1],
                        chart.ticks[0][1],
                        chart.ticks[0][1],
                        chart.ticks[0][1],
                        chart.ticks[0][2],
                        chart.ticks[0][3],
                        chart.ticks[0][4]
                    ]);
                }

                if (chart.bars.length > this.maxBarCount) {
                    chart.bars.pop();
                }
            }
        } else {
            if (bar[2] < tick[1]) {
                bar[2] = tick[1];
            }
            if (bar[3] > tick[1]) {
                bar[3] = tick[1];
            }
            bar[4] = tick[1];
            bar[5] = tick[2];
            bar[6] = tick[3];
            bar[7] = tick[4];
        }

        this._hasUpdated = true;
    }

    updateBoard(index: number, board: Board) {

        const chart = this.charts[index];

        chart.boardMaxSize = 0;

        for (let i = 0; i < board.asks.length; i++) {
            if (board.asks[i].price > chart.highest) {
                board.asks.splice(i, board.asks.length - i);
                break;
            }
            if (chart.boardMaxSize < board.asks[i].size) {
                chart.boardMaxSize = board.asks[i].size;
            }
        }
        for (let i = 0; i < board.bids.length; i++) {
            if (board.bids[i].price < chart.lowest) {
                board.bids.splice(i, board.bids.length - i);
                break;
            }
            if (chart.boardMaxSize < board.bids[i].size) {
                chart.boardMaxSize = board.bids[i].size;
            }
        }

        chart.board = board;

        this._hasUpdated = true;
    }

    setColor(option: ColorOption) {

        for (const key in option) {
            this.color[key] = option[key];
        }

        this._chartContainer.style.borderColor = this.color.border;
    }

    private _create() {
        
        this._rootContainer = document.createElement("div");
        this._rootContainer.className = "kuromaty";
        this._chartContainer = document.createElement("div");
        this._chartContainer.className = "kuromaty-chart";
        this._chartContainer.style.borderColor = this.color.border;
        this._rootContainer.appendChild(this._chartContainer);

        this.charts = [];
        this.canvases = [];
        this.contexts = [];

        {
            this.overlay = {
                canvas: document.createElement("canvas"),
                context: null
            };
            this.overlay.context = this.overlay.canvas.getContext("2d");

            this.canvases.push(this.overlay.canvas);
            this.contexts.push(this.overlay.context);

            this.overlay.canvas.addEventListener("pointerdown", this._pointerdownHandler.bind(this));
            this.overlay.canvas.addEventListener("pointerup", this._pointerupHandler.bind(this));
            this.overlay.canvas.addEventListener("pointermove", this._pointermoveHandler.bind(this));
            this.overlay.canvas.addEventListener("pointerout", this._pointeroutHandler.bind(this));
            this.overlay.canvas.addEventListener("mousewheel", this._mousewheelHandler.bind(this)/* , { passive: true } */);
            this.overlay.canvas.addEventListener("contextmenu", this._contextmenuHandler.bind(this));
        }
        
        for (let i = 0; i < this.options.chartCount; i++) {
            const chart = {
                title: this.options.chartTitles[i] || "Untitled",
                canvas: document.createElement("canvas"),
                context: null,
                bars: [],
                _bars: [],
                ticks: [],
                board: null,
                boardMaxSize: 0,
                range: 0,
                highest: 0,
                highestPrice: 0,
                highestPricePrinted: false,
                lowest: 0,
                lowestPrice: 0,
                lowestPricePrinted: false,
                askPrice: 0,
                bidPrice: 0,
                maxVolume: 0,
                volumeRatio: 0,
                maxDepth: 0,
                minDepth: 0,
                depthRatio: 1,
                latest: 0,
                ratio: 1,
                tickDelta: 0,
                selected: i === 0
            };
            chart.context = chart.canvas.getContext("2d");

            this.charts.push(chart);
            this.canvases.push(chart.canvas);
            this.contexts.push(chart.context);
        }

        {
            this.grid = {
                canvas: document.createElement("canvas"),
                context: null
            };
            this.grid.context = this.grid.canvas.getContext("2d");

            this.canvases.push(this.grid.canvas);
            this.contexts.push(this.grid.context);
        }

        // insert all canvas
        this.canvases.reverse();
        this.contexts.reverse();
        this.canvases.forEach(canvas => {
            this._chartContainer.appendChild(canvas);
        });
    }

    private _redraw() {

        if (this._afr) {
            cancelAnimationFrame(this._afr);
        }

        const tick = () => {

            if (this._hasUpdated && this.canvasW > 40 && this.canvasH > 40) {
                this._hasUpdated = false;
                this._draw();
            }

            if (!this._hasRemoved) {
                this._afr = requestAnimationFrame(tick);
            }
        };

        this._afr = requestAnimationFrame(tick);
    }

    private _draw() {

        const canvasW = this.canvasW,
              canvasH = this.canvasH,
              barW = this.options.barWidth + this.options.barMargin,
              chartW = canvasW - 45,
              chartH = canvasH - 16,
              chartM = barW * Math.max(1, 4 - this.barIndex),
              chartI = Math.max(0, this.barIndex - 3),
              barCount = Math.round((chartW - chartM) / barW),
              decimal = this._decimal,
              decimalPower = this.options.decimalPower,
              period = this.timePeriod;

        let i = 0,
            j = 0,
            l = 0,
            m = this.charts.length,
            end = false,
            highest = 0,
            lowest = Infinity,
            maxVolume = 0,
            minVolume = Infinity,
            maxDepth = 0,
            minDepth = Infinity,
            bar: Bar,
            barH = 0,
            barDate: Date;

        this.hasDepleted = false;

        // pre
        for (j = 0; j < m; j++) {
            let chart = this.charts[j];

            chart.context.clearRect(0, 0, canvasW, canvasH);

            if (period === 0 && !chart.selected) {
                continue;
            }

            highest = 0;
            lowest = Infinity;
            maxVolume = 0;
            maxDepth = 0;
            minDepth = Infinity;

            if (period === 0) {
                chart._bars = this._getBars(j, chartI, barCount, 1);
                l = chart._bars.length - 1;
            } else {
                chart._bars = this._getBars(j, chartI, barCount, 25);
                l = chart._bars.length - 25;
            }
            
            if (chart.selected) {
                if (barCount > l && this.maxBarCount > chart.bars.length && chart._bars.length > 0) {
                    this.hasDepleted = true;
                }
            }

            for (i = 0; i < l; i++) {
                bar = chart._bars[i];
                if (!bar) {
                    break;
                }
                if (highest < bar[2]) {
                    highest = bar[2];
                }
                if (lowest > bar[3]) {
                    lowest = bar[3];
                }
                if (maxVolume < Math.abs(chart._bars[i + 1][5] - bar[5])) {
                    maxVolume = Math.abs(chart._bars[i + 1][5] - bar[5]);
                }
                if (maxDepth < bar[6]) {
                    maxDepth = bar[6];
                }
                if (minDepth > bar[6]) {
                    minDepth = bar[6];
                }
                if (maxDepth < bar[7]) {
                    maxDepth = bar[7];
                }
                if (minDepth > bar[7]) {
                    minDepth = bar[7];
                }
            }

            if (chart._bars.length === 0) {
                return;
            }

            chart.latest = chart.bars[0][4];
            chart.highestPrice = highest;
            chart.lowestPrice = lowest;
            chart.highestPricePrinted = false;
            chart.lowestPricePrinted = false;
            let priceRatio = chartH / (highest - lowest);
            chart.highest = highest + Math.round(((chartH / 3) / priceRatio) * decimal) / decimal;
            chart.lowest = lowest - Math.round(((chartH / 3) / priceRatio) * decimal) / decimal;
            chart.range = chart.highest - chart.lowest;
            chart.ratio = chartH / chart.range;
            chart.maxVolume = maxVolume;
            chart.volumeRatio = (chartH / 5) / maxVolume;
            chart.maxDepth = maxDepth;
            chart.minDepth = minDepth;
            chart.depthRatio = (chartH / 5) / (maxDepth - minDepth);

            chart.canvas.style.opacity = chart.selected ? "1" : "0.2";

            // border
            chart.context.fillStyle = this.color.border;
            chart.context.fillRect(chartW, 0, 1, chartH);
            chart.context.fillRect(0, chartH, chartW + 1, 1);

            //console.log(chart.title, chart);
        }// pre

        this.grid.context.clearRect(0, 0, canvasW, canvasH);
        this.grid.context.fillStyle = this.color.bg;
        this.grid.context.fillRect(0, 0, canvasW, canvasH);
        this.grid.context.textAlign = "center";

        this.overlay.context.clearRect(0, 0, canvasW, canvasH);

        // main
        for (j = 0; j < m; j++) {
            let chart = this.charts[j];
            let ctx = chart.context;
            let barX = chartW - chartM;

            if (period === 0 && !chart.selected) {
                continue;
            }

            // bars
            for (i = 0; i < l; i++) {
                bar = chart._bars[i];
                if (!bar || !chart._bars[i + 1]) {
                    break;
                }
                if (i !== 0) {
                    barX -= barW;
                }

                // ask/bid depth
                if (chart.selected) {
                    ctx.fillStyle = i === 0 && chartI < 1 ? this.color.askDepthLast : this.color.askDepth;
                    ctx.fillRect(
                        barX - this.options.barWidth,
                        0,
                        barW,
                        Math.round((bar[6] - chart.minDepth) * chart.depthRatio)
                    );

                    ctx.fillStyle = i === 0 && chartI < 1 ? this.color.bidDepthLast : this.color.bidDepth;
                    ctx.fillRect(
                        barX - this.options.barWidth,
                        chartH,
                        barW,
                        - Math.round((bar[7] - chart.minDepth) * chart.depthRatio)
                    );
                }

                // volume
                ctx.fillStyle = this.color.volume;
                ctx.fillRect(
                    barX - Math.ceil(this.options.barWidth / 2),
                    chartH,
                    1,
                    - Math.abs(Math.round((chart._bars[i + 1][5] - bar[5]) * chart.volumeRatio))
                );

                if (period !== 0) {
                    // bar height
                    barH = Math.round((bar[1] - bar[4]) * chart.ratio);

                    // candlestick
                    ctx.fillStyle = bar[1] > bar[4] ? this.color.short : this.color.long;
                    ctx.fillRect(
                        barX - this.options.barWidth,
                        Math.round((chart.highest - bar[1]) * chart.ratio),
                        this.options.barWidth,
                        barH === 0 ? 1 : barH
                    );
                    // candlestick (hige)
                    ctx.fillRect(
                        barX - Math.ceil(this.options.barWidth / 2),
                        Math.round((chart.highest - bar[2]) * chart.ratio),
                        1,
                        Math.round((bar[2] - bar[3]) * chart.ratio)
                    );
                }

                if (!chart.selected) {
                    continue;
                }

                // highest
                if (period !== 0 && bar[2] === chart.highestPrice) {
                    this.overlay.context.fillStyle = this.color.long;

                    let hpX = barX - this.options.barWidth / 2;
                    let hpY = Math.round((chart.highest - bar[2]) * chart.ratio);

                    this.overlay.context.beginPath();
                    this.overlay.context.moveTo(hpX, hpY - 2);
                    this.overlay.context.lineTo(hpX + 3, hpY - 5);
                    this.overlay.context.lineTo(hpX - 3, hpY - 5);
                    this.overlay.context.fill();

                    if (chart.highestPricePrinted === false) {
                        chart.highestPricePrinted = true;
                        
                        this.overlay.context.textAlign = (i < l / 2) ? "right" : "left";
                        this.overlay.context.fillText(
                            util.fixedDecimal(bar[2], decimalPower),
                            barX - ((i < l / 2) ? 0 : 5),
                            hpY - 8
                        );

                        this._drawBorder(
                            this.overlay.context,
                            0,
                            hpY - 0.5,
                            chartW,
                            this.color.long,
                            [1, 2]
                        );
                    }
                }
                // lowest
                if (period !== 0 && bar[3] === chart.lowestPrice) {
                    this.overlay.context.fillStyle = this.color.short;

                    let lpX = barX - this.options.barWidth / 2;
                    let lpY = Math.round((chart.highest - bar[3]) * chart.ratio);

                    this.overlay.context.beginPath();
                    this.overlay.context.moveTo(lpX, lpY + 2);
                    this.overlay.context.lineTo(lpX + 3, lpY + 5);
                    this.overlay.context.lineTo(lpX - 3, lpY + 5);
                    this.overlay.context.fill();

                    if (chart.lowestPricePrinted === false) {
                        chart.lowestPricePrinted = true;

                        this.overlay.context.textAlign = (i < l / 2) ? "right" : "left";
                        this.overlay.context.fillText(
                            util.fixedDecimal(bar[3], decimalPower),
                            barX - ((i < l / 2) ? 0 : 5),
                            lpY + 15
                        );

                        this._drawBorder(
                            this.overlay.context,
                            0,
                            lpY + 0.5,
                            chartW,
                            this.color.short,
                            [1, 2]
                        );
                    }
                }

                // bar date
                barDate = new Date(bar[0]);

                // datetime
                if (
                    (period === 0 && i % 10 === 0) ||
                    (period >= 1 && period < 3 && barDate.getMinutes() % 15 === 0) ||
                    (period >= 3 && period < 5 && barDate.getMinutes() % 30 === 0) ||
                    (period >= 5 && period < 10 && barDate.getMinutes() % 60 === 0) ||
                    (period >= 10 && period < 15 && barDate.getMinutes() % 60 === 0 && barDate.getHours() % 2 === 0) ||
                    (period >= 15 && period < 30 && barDate.getMinutes() % 60 === 0 && barDate.getHours() % 3 === 0) ||
                    (period >= 30 && period < 60 && barDate.getMinutes() % 60 === 0 && barDate.getHours() % 6 === 0) ||
                    (period >= 60 && period < 120 && barDate.getMinutes() % 60 === 0 && barDate.getHours() % 12 === 0) ||
                    (period >= 120 && barDate.getMinutes() % 60 === 0 && barDate.getHours() === 0)
                ) {
                    // vertical grid
                    this.grid.context.fillStyle = this.color.grid;
                    this.grid.context.fillRect(
                        barX - Math.ceil(this.options.barWidth / 2),
                        0,
                        1,
                        chartH
                    );

                    // time
                    let timeStr;
                    if (barDate.getHours() === 0) {
                        timeStr = `${barDate.getMonth() - 1}/${barDate.getDate()}'`;
                    } else {
                        timeStr = `${barDate.getHours()}:${util.zeroPadding(barDate.getMinutes(), 2)}`;
                    };
                    this.grid.context.fillStyle = this.color.text;
                    this.grid.context.fillText(
                        timeStr,
                        barX - Math.ceil(this.options.barWidth / 2),
                        canvasH - 4
                    );
                }
            }// bars

            if (chart.selected) {
                // horizontal grid (price)
                let lp = Infinity, cp = 0, add = decimal === 1 ? 1000 : 100 / decimal;
                if (period === 0) {
                    add /= 100;
                }
                for (i = chart.lowest - chart.lowest % add; i < chart.highest; i += add) {
                    cp = Math.round((chart.highest - i) * chart.ratio);
                    if (lp - cp < 80 || cp + 30 > chartH) {
                        continue;
                    }
                    
                    // grid
                    this.grid.context.fillStyle = this.color.grid;
                    this.grid.context.fillRect(
                        0,
                        cp,
                        chartW,
                        1
                    );

                    // text
                    this.grid.context.fillStyle = this.color.textWeak;
                    this.grid.context.font = "10px Arial";
                    this.grid.context.textAlign = "left";
                    this.grid.context.fillText(
                        util.fixedDecimal(i, decimalPower),
                        chartW + 2,
                        cp + 3.5
                    );

                    lp = cp;
                }

                // Last Depth Indicator (v2.25)
                if (chart._bars[0][6] && chart._bars[0][7]) {
                    this._drawDepthIndicator(
                        this.overlay.context,
                        chartW - chartM - 7,
                        15,
                        chart._bars[0][6],
                        this.color.askDepthLast
                    );
                    this._drawDepthIndicator(
                        this.overlay.context,
                        chartW - chartM - 7,
                        chartH - 15,
                        chart._bars[0][7],
                        this.color.bidDepthLast
                    );
                }

                // Ask/Bid Price Indicator (v2.24)
                if (chart.askPrice && chart.bidPrice) {
                    let askp = Math.round((chart.highest - chart.askPrice) * chart.ratio);
                    let bidp = Math.round((chart.highest - chart.bidPrice) * chart.ratio);

                    this._drawPriceTag2(
                        this.overlay.context,
                        chartW - chartM + Math.round(barW / 2),
                        askp,
                        chartM - Math.round(barW / 2),
                        chart.askPrice,
                        this.color.long,
                        [2, 2]
                    );
                    this._drawPriceTag2(
                        this.overlay.context,
                        chartW - chartM + Math.round(barW / 2),
                        bidp,
                        chartM - Math.round(barW / 2),
                        chart.bidPrice,
                        this.color.short,
                        [2, 2]
                    );
                }

                // Board (testing)
                if (chart.board) {
                    this.overlay.context.save();
                    this.overlay.context.globalCompositeOperation = "lighter";

                    this.overlay.context.fillStyle = this.color.askOrder;
                    for (i = 0; i < chart.board.asks.length; i++) {
                        this.overlay.context.globalAlpha = Math.max(0.02, chart.board.asks[i].size / chart.boardMaxSize);
                        this.overlay.context.fillRect(
                            chartW - 8,
                            Math.round((chart.highest - chart.board.asks[i].price) * chart.ratio) + 2,
                            8,
                            -3
                        );
                    }
                    this.overlay.context.fillStyle = this.color.bidOrder;
                    for (i = 0; i < chart.board.bids.length; i++) {
                        this.overlay.context.globalAlpha = Math.max(0.02, chart.board.bids[i].size / chart.boardMaxSize);
                        this.overlay.context.fillRect(
                            chartW - 8,
                            Math.round((chart.highest - chart.board.bids[i].price) * chart.ratio) - 1,
                            8,
                            3
                        );
                    }

                    this.overlay.context.restore();
                }

                // Pinned Price
                this.pinnedPrices.forEach(price => {
                    this._drawPriceTag(
                        this.overlay.context,
                        0,
                        Math.round((chart.highest - price) * chart.ratio),
                        chartW,
                        price,
                        price > chart.latest ? this.color.long : this.color.short,
                        "#ffffff",
                        [3, 3]
                    );
                });

                // Positions (testing)
                this.positions.forEach(position => {
                    this._drawPositionMarker(
                        this.overlay.context,
                        0,
                        Math.round((chart.highest - position.price) * chart.ratio),
                        chartW,
                        position.price,
                        position.side,
                        position.size || 0,
                        chart.latest
                    );
                });

                // LTP
                let ltpp = Math.round((chart.highest - chart.latest) * chart.ratio);

                let color = this.color.borderLTP;
                if (chart.highestPrice === chart.latest) {
                    color = this.color.long;
                } else if (chart.lowestPrice === chart.latest) {
                    color = this.color.short;
                }
                this._drawPriceTag(
                    this.overlay.context,
                    0,
                    ltpp,
                    chartW,
                    chart.latest,
                    color,
                    this.color.borderLTPText,
                    []
                );

                // Price Pop Effect (testing)
                for (i = 0; i < this._pricePops.length; i++) {
                    this._pricePops[i][0] *= 0.972;
                    if (this._pricePops[i][0] < 0.06) {
                        this._pricePops.splice(i, 1);
                        i--;
                        continue;
                    }
                    if (this._pricePops[i][5]) {
                        this._pricePops[i][4] -= 0.2;
                    } else {
                        this._pricePops[i][4] += 0.2;
                    }
                }
                if (chart.tickDelta !== 0) {
                    this._pricePops.push([
                        1,
                        (Math.round(Math.abs(chart.tickDelta) * decimal) / decimal).toString(10),
                        chart.tickDelta > 0 ? this.color.long : this.color.short,
                        chartW - 12,
                        chart.tickDelta > 0 ? (ltpp - 8) : (ltpp + 16),
                        chart.tickDelta > 0
                    ]);

                    this._afs = Math.max(100, this._afs);
                    chart.tickDelta = 0;
                }
                this.overlay.context.save();
                this.overlay.context.textAlign = "right";
                this.overlay.context.font = "10px monospace";
                for (i = 0; i < this._pricePops.length; i++) {
                    this.overlay.context.globalAlpha = this._pricePops[i][0];
                    this.overlay.context.fillStyle = this._pricePops[i][2];
                    this.overlay.context.fillText(
                        this._pricePops[i][1],
                        this._pricePops[i][3],
                        Math.round(this._pricePops[i][4])
                    );
                }
                this.overlay.context.restore();
            }
        } // main

        // technical
        for (j = 0; j < m; j++) {
            const chart = this.charts[j];
            if (!chart.selected) {
                break;
            }

            const ctx = chart.context;
            const barX = chartW - chartM - 0.5;

            if (period === 0) {
                // tick (special)
                this._drawSMA(ctx, barX, chart, l, 1, this.color.text);
            } else {
                this._drawSMA(ctx, barX, chart, l, 10, this.color.lineMA1);
                this._drawSMA(ctx, barX, chart, l, 21, this.color.lineMA2);
                this._drawSMA(ctx, barX, chart, l, 34, this.color.lineMA3);
            }
        } // technical

        // datetime
        barDate = new Date(this.charts[0]._bars[0][0]);
        this.grid.context.textAlign = "right";
        this.grid.context.fillStyle = this.color.text;
        this.grid.context.fillText(
            `:${util.zeroPadding(barDate.getMinutes(), 2)}`,
            canvasW - 45,
            canvasH - 4
        );

        // cursor
        this.cursorPrice = 0;
        if (this.cursorX > 0 && this.cursorY > 30 && this.cursorX < chartW && this.cursorY < chartH) {
            let pX = this.cursorX - (this.cursorX % barW);
            i = Math.round((chartW - pX - chartM - this.options.barWidth) / barW);
            pX = Math.floor(chartW - chartM - (i * barW) - (barW / 2)) - 1;

            // bar line
            this.grid.context.fillStyle = this.color.grid;
            this.grid.context.fillRect(
                pX,
                0,
                this.options.barWidth,
                chartH
            );

            let chart = this.charts[0];
            this.cursorPrice = Math.ceil((chart.highest - this.cursorY / chart.ratio) * decimal) / decimal;
            if (decimal === 1) {
                this.cursorPrice = Math.round(this.cursorPrice / 50) * 50;
            } else {
                this.cursorPrice = Math.round(this.cursorPrice * (decimal / 10)) / (decimal / 10);
            }

            // price
            this._drawPriceTag(
                this.overlay.context,
                0,
                Math.round((chart.highest - this.cursorPrice) * chart.ratio),
                chartW,
                this.cursorPrice,
                this.color.border,
                this.color.textStrong,
                []
            );

            if (i >= 0 && i < chart._bars.length) {
                // Time Line
                this.grid.context.fillStyle = this.color.grid;
                this.grid.context.fillRect(
                    pX - 10,
                    chartH,
                    25,
                    20
                );
                // Time Text
                barDate = new Date(chart._bars[i][0]);
                this.grid.context.textAlign = "center";
                this.grid.context.fillStyle = this.color.textStrong;
                this.grid.context.fillText(
                    `${barDate.getHours()}:${util.zeroPadding(barDate.getMinutes(), 2)}`,
                    pX + this.options.barWidth / 2,
                    canvasH - 4
                );

                // Bar Info
                this.overlay.context.save();
                this.overlay.context.textAlign = "left";
                this.overlay.context.fillStyle = this.color.textStrong;
                this.overlay.context.font = "12px monospace";
                const diff = Math.round((100 - (chart._bars[i][1] / chart._bars[i][4] * 100)) * 1000) / 1000;
                this.overlay.context.fillText(
                    (
                        barDate.toLocaleString() +
                        `  ○ ${util.fixedDecimal(chart._bars[i][1], decimalPower)}` +
                        `  ↑ ${util.fixedDecimal(chart._bars[i][2], decimalPower)}` +
                        `  ↓ ${util.fixedDecimal(chart._bars[i][3], decimalPower)}` +
                        `  × ${util.fixedDecimal(chart._bars[i][4], decimalPower)}` +
                        `  ${util.toStringWithSign(diff)}%`
                    ),
                    10,
                    20
                );
                this.overlay.context.fillText(
                    "[価格マーカー] 左クリックで追加・削除 / 右クリックで全消去",
                    10,
                    40
                );
                this.overlay.context.restore();
            }

            // Total Margin of Positions on Cursor (testing)
            if (this.positions.length !== 0) {
                let margin = 0;

                this.positions.forEach(pos => {
                    let m = (this.cursorPrice - pos.price) * pos.size;
                    if (pos.side === "S") {
                        m = -m;
                    }
                    margin += m;
                });

                margin = Math.floor(margin);

                this.overlay.context.save();
                this.overlay.context.textAlign = "left";
                this.overlay.context.fillStyle = margin < 0 ? this.color.short : this.color.long;
                this.overlay.context.fillText(
                    util.toStringWithSign(margin),
                    10,
                    this.cursorY - 5
                );
                this.overlay.context.restore();
            }
        } else {
            this.overlay.context.save();
            this.overlay.context.textAlign = "left";
            this.overlay.context.font = "11px monospace";
            this.overlay.context.fillStyle = this.color.text;
            this.overlay.context.fillText(
                "> " + this.charts[0].title,
                10,
                20
            );
            if (this.charts[1]) {
                this.overlay.context.fillStyle = this.color.textWeak;
                this.overlay.context.fillText(
                    "  " + this.charts[1].title,
                    10,
                    35
                );
            }
            this.overlay.context.restore();
        } // cursor

        // Total Margin of Positions (testing)
        if (this.positions.length !== 0) {
            const chart = this.charts[0];
            let margin = 0;

            this.positions.forEach((pos) => {
                let m = (chart.latest - pos.price) * pos.size;
                if (pos.side === "S") {
                    m = -m;
                }
                margin += m;
            });

            margin = Math.floor(margin);

            this.overlay.context.save();
            this.overlay.context.font = "11px monospace";
            this.overlay.context.textAlign = "left";
            this.overlay.context.fillStyle = margin < 0 ? this.color.short : this.color.long;
            this.overlay.context.fillText(
                `評価損益: ${util.toStringWithSign(margin)}`,
                10,
                80
            );
            this.overlay.context.restore();
        }

        if (this._afs !== 0) {
            this._afs--;
            this._hasUpdated = true;
        }
    }

    private _getBars(index: number, start: number, count: number, hiddenCount: number): Bar[] {

        const chart = this.charts[index];
        const period = this.timePeriod;
        const barCount = count + hiddenCount;
        
        if (chart.bars.length === 0) {
            return [];
        }
        if (period === 1) {
            return chart.bars.slice(start, start + barCount);
        } else if (period === 0) {
            return chart.ticks.slice(start, start + barCount).map(tick => {
                return <Bar>[
                    tick[0],
                    tick[1],
                    tick[1],
                    tick[1],
                    tick[1],
                    tick[2],
                    tick[3],
                    tick[4],
                ];
            });
        }

        const bars: Bar[] = [],
              mBars = chart.bars;

        let date,
            backCount = 0;

        if (start !== 0) {
            date = new Date(mBars[0][0]);
            backCount = start * period + (date.getMinutes() % period) - period;
        }

        let i = Math.min(
            (barCount * period) + backCount - 1,
            chart.bars.length - 1
        );
        for (; i >= backCount; i--) {
            date = new Date(mBars[i][0]);

            if (
                bars.length === 0 ||
                (
                    date.getMinutes() % period === 0 &&
                    date.getHours() % Math.ceil(period / 60) === 0 &&
                    bars[0][0] < mBars[i][0]
                )
            ) {
                bars.unshift([
                    date.setSeconds(0, 0),
                    mBars[i][1],
                    mBars[i][2],
                    mBars[i][3],
                    mBars[i][4],
                    mBars[i][5],
                    mBars[i][6] || 0,
                    mBars[i][7] || 0
                ]);
                continue;
            }

            if (bars[0][2] < mBars[i][2]) {
                bars[0][2] = mBars[i][2];
            }
            if (bars[0][3] > mBars[i][3]) {
                bars[0][3] = mBars[i][3];
            }
            bars[0][4] = mBars[i][4];
            bars[0][5] = mBars[i][5];
            bars[0][6] = mBars[i][6] || 0;
            bars[0][7] = mBars[i][7] || 0;
        }

        return bars.slice(0, barCount);
    }

    private _contextmenuHandler(ev: MouseEvent) {

        ev.stopPropagation();
        ev.preventDefault();

        this.pinnedPrices = [];
    }

    private _pointerdownHandler(ev: PointerEvent) {

        if (ev.target !== this.overlay.canvas) {
            return;
        }

        let offsetX = ev.offsetX;
        let offsetY = ev.offsetY;
        if (!offsetX && !offsetY && ev.target) {
            const rect = (<Element>ev.target).getBoundingClientRect();
            offsetX = ev.clientX - rect.left;
            offsetY = ev.clientY - rect.top;
        }

        let buttons = ev.buttons;
        if (buttons === undefined && ev.which) {
            switch (ev.which) {
                case 2:
                    buttons = 4;
                    break;
                case 3:
                    buttons = 2;
                    break;
                default:
                    buttons = ev.which;
            }
        }

        this._lastPointerdown = [offsetX, offsetY];
        this._lastPointerButtons = buttons;
        this._dragStartX = undefined;

        ev.preventDefault();
    }

    private _pointerupHandler(ev: PointerEvent) {

        if (ev.target !== this.overlay.canvas) {
            return;
        }

        let offsetX = ev.offsetX;
        let offsetY = ev.offsetY;
        if (!offsetX && !offsetY) {
            const rect = (<Element>ev.target).getBoundingClientRect();
            offsetX = ev.clientX - rect.left;
            offsetY = ev.clientY - rect.top;
        }

        if (
            ev.pointerType !== "touch" &&
            this._lastPointerdown[0] === offsetX &&
            this._lastPointerdown[1] === offsetY
        ) {
            if (this._lastPointerButtons === 1) {
                if (this.cursorPrice) {
                    const pinnedPriceIndex = this.pinnedPrices.indexOf(this.cursorPrice);
                    if (pinnedPriceIndex === -1) {
                        this.pinnedPrices.push(this.cursorPrice);
                    } else {
                        this.pinnedPrices.splice(pinnedPriceIndex, 1);
                    }
                }
            } else if (this._lastPointerButtons === 2) {
                this.pinnedPrices = [];
            }
        }

        this._lastPointerdown = [0, 0];
        this._lastPointerButtons = 0;

        this._hasUpdated = true;

        ev.preventDefault();
    }

    private _pointermoveHandler(ev: PointerEvent) {

        if (ev.target !== this.overlay.canvas) {
            return;
        }

        let offsetX = ev.offsetX;
        let offsetY = ev.offsetY;
        if (!offsetX && !offsetY) {
            const rect = (<Element>ev.target).getBoundingClientRect();
            offsetX = ev.clientX - rect.left;
            offsetY = ev.clientY - rect.top;
        }

        let buttons = ev.buttons;
        if (buttons === undefined && ev.which) {
            switch (ev.which) {
                case 2:
                    buttons = 4;
                    break;
                case 3:
                    buttons = 2;
                    break;
                default:
                    buttons = ev.which;
            }
        }

        if (buttons === 1) {
            ev.preventDefault();

            if (!this._dragStartX) {
                this._dragStartX = offsetX;
                this._dragStartI = this.barIndex;
            }
            const deltaX = this._dragStartX - offsetX;
            this.barIndex = this._dragStartI - Math.round(deltaX / (this.options.barWidth + this.options.barMargin))
            if (this.barIndex < 0) {
                this.barIndex = 0;
            } else if (this.barIndex >= this.charts[0].bars.length) {
                this.barIndex = this.charts[0].bars.length - 1;
            }
        } else {
            this._dragStartX = undefined;
        }

        this.cursorX = offsetX;
        this.cursorY = offsetY;

        this._hasUpdated = true;
    }

    private _pointeroutHandler(ev: PointerEvent) {
        this.cursorX = this.cursorY = -1;
    }

    private _mousewheelHandler(ev: MouseWheelEvent) {

        ev.preventDefault();

        this.barIndex -= Math.round(ev.deltaX ? ev.deltaX : -(ev.deltaY / 6));
        if (this.barIndex < 0) {
            this.barIndex = 0;
        }

        this._hasUpdated = true;
    }

    private _drawBorder(ctx: CanvasRenderingContext2D,
                        x: number, y: number, w: number, color: string, lineDash: number[]) {

        ctx.save();

        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.setLineDash(lineDash);
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();

        ctx.restore();
    }

    private _drawPriceTag(ctx: CanvasRenderingContext2D,
                          x: number, y: number, w: number, price: number,
                          color: string, textColor: string, lineDash: number[], tagColor?: string) {

        this._drawBorder(ctx, x, y + 0.5, w - 5, color, lineDash);
        
        w += x;

        ctx.save();
        
        ctx.fillStyle = tagColor || color;
        ctx.beginPath();
        ctx.moveTo(w - 5, y);
        ctx.lineTo(w + 1, y - 6);
        ctx.lineTo(w + 42, y - 6);
        ctx.lineTo(w + 43, y - 5);
        ctx.lineTo(w + 43, y + 6);
        ctx.lineTo(w + 42, y + 7);
        ctx.lineTo(w + 1, y + 7);
        ctx.lineTo(w - 5, y + 1);
        ctx.fill();

        ctx.textAlign = "left";
        ctx.fillStyle = textColor;
        ctx.font = "10px Arial";
        ctx.fillText(
            util.fixedDecimal(price, this.options.decimalPower),
            w + 2,
            y + 3.5
        );

        ctx.restore();
    }

    private _drawPriceTag2(ctx: CanvasRenderingContext2D,
                           x: number, y: number, w: number, price: number,
                           color: string, lineDash: number[]) {

        this._drawBorder(ctx, x, y + 0.5, w - 5, color, lineDash);
        
        w += x;

        ctx.save();

        ctx.fillStyle = this.color.bg;
        ctx.fillRect(
            w + 1,
            y - 5,
            40,
            10
        );

        ctx.textAlign = "left";
        ctx.fillStyle = color;
        ctx.font = "10px Arial";
        ctx.fillText(
            util.fixedDecimal(price, this.options.decimalPower),
            w + 2,
            y + 3.5
        );

        ctx.restore();
    }

    private _drawDepthIndicator(ctx: CanvasRenderingContext2D,
                                x: number, y: number, value: number, color: string) {

        this._drawBorder(ctx, x, y + 0.5, -10, color, [2, 2]);

        ctx.save();

        ctx.textAlign = "right";
        ctx.fillStyle = this.color.textWeak;
        ctx.strokeStyle = this.color.bg;
        ctx.lineWidth = 2;
        ctx.font = "10px Arial";
        ctx.strokeText(
            Math.round(value).toString(10),
            x - 12,
            y + 3.5
        );
        ctx.fillText(
            Math.round(value).toString(10),
            x - 12,
            y + 3.5
        );

        ctx.restore();
    }

    private _drawPositionMarker(ctx: CanvasRenderingContext2D,
                                x: number, y: number, w: number, price: number,
                                side: PositionSide, size: number, ltp: number) {

        const color = side === "L" ? this.color.long : this.color.short;

        let margin = Math.floor((ltp - price) * size);
        if (side === "S") {
            margin = -margin;
        }

        this._drawPriceTag(
            ctx,
            x,
            y,
            w,
            price,
            color,
            "#ffffff",
            [5, 2, 2]
        );

        ctx.save();

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = this.color.bg;
        ctx.fillRect(
            x + 4,
            y - 2,
            80,
            -13
        );

        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.fillText(
            `${size} ${side}, ${util.toStringWithSign(margin)}`,
            x + 6,
            y - 5
        );

        ctx.restore();
    }

    private _drawSMA(ctx: CanvasRenderingContext2D,
                     x: number, chart: Chart, count: number, value: number, color: string) {

        const barW = this.options.barMargin + this.options.barWidth;
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
            bar,
            p = 0,
            y = 0;
        for (; i < count; i++) {
            if (!chart._bars[i] || !chart._bars[i + value]) {
                break;
            }
            x -= barW;

            p = 0;
            for (j = 0; j < value; j++) {
                p += chart._bars[i + j][4];
            }
            p /= value;
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

if (window.Kuromaty === undefined) {
    (<any>window).Kuromaty = Kuromaty;
}

declare global {
    interface Window {
        Kuromaty: typeof Kuromaty;
    }
}

export default Kuromaty;
