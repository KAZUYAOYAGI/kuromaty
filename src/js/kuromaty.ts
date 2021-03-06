/*!
    Copyright 2017 Kuromatch
*/
import * as util from "./util";
import { Position as _Position, PositionLike, Side as PositionSide } from "./Position";
import { PositionSet } from "./PositionSet";
import { Order as _Order, OrderLike } from "./Order";
import { OrderSet } from "./OrderSet";
import flagrate from "flagrate/lib/es6/flagrate";
import { ContextMenu } from "flagrate/lib/es6/flagrate/context-menu";
import { Decimal } from "decimal.js-light";
import { ChartDimensions, Overlay } from "./Overlay";
import * as overlays from "./overlays/";

enum Month {
    Jan,
    Feb,
    Mar,
    Apr,
    May,
    Jun,
    Jul,
    Aug,
    Sep,
    Oct,
    Nov,
    Dec
}

/** time, open, high, low, close, volume, askDepth, bidDepth, sellVolume, buyVolume */
export type Bar = [number, number, number, number, number, number, number, number, number, number];
export const enum BarColumn {
    Time,
    Open,
    High,
    Low,
    Close,
    Volume,
    AskDepth,
    BidDepth,
    SellVolume,
    BuyVolume
}

export interface Bars extends Array<Bar> { nextTick?: number; period?: number; }

/** time, ltp, volume, askDepth, bidDepth, sellVolume, buyVolume */
export type Tick = [number, number, number, number, number, number, number];
const enum TickColumn {
    Time,
    Ltp,
    Volume,
    AskDepth,
    BidDepth,
    SellVolume,
    BuyVolume
}

const enum TimeByMinutes {
    OneMinute = 1,
    OneHour =  60,
    OneDay = 60 * 24,
    OneWeek = 60 * 24 * 7
}

export interface Options {
    chartCount?: number;
    chartTitles?: string[];
    chartOverlay?: boolean;
    cursorSnapToGrid?: boolean;
    barWidth?: number;
    barMargin?: number;
    decimalPower?: number;
    boardGroupSize?: number;
    pricePopEffect?: boolean;
    quickOrder?: boolean;
    quickOrderHandler?: (order: QuickOrder) => void;
}

export interface QuickOrder {
    price: number;
    type: "limit" | "stop-limit";
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
    hBars: Bar[];
    _bars: Bars;
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

export type Position = PositionLike;

export class Kuromaty {

    static readonly overlays = overlays;

    timePeriod = 1;
    barIndex = 0;
    cursorPrice = 0;
    cursorVolume = 0;
    cursorBoard = 0;
    cursorBoardPrice = 0;
    pinnedPrices: number[] = [];
    maxBarCount = 8200;
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

    overlays: { [name: string]: Overlay } = {};

    private _dpr = window.devicePixelRatio;
    private _rootContainer: HTMLDivElement;
    private _chartContainer: HTMLDivElement;
    private _hasUpdated = false;
    private _hasRemoved = true;
    private _afr: number;
    private _afs = 0;
    private _pricePops: [number, string, string, number, number, boolean, string][] = [];
    private _lastPointerdown: [number, number] = [0, 0];
    private _lastPointerType: "mouse" | "pen" | "touch";
    private _lastPointerButtons = 0;
    private _dragStartX: number;
    private _dragStartI: number;
    private _decimal: number;
    private _positions: PositionSet = new PositionSet();
    private _orders: OrderSet = new OrderSet();
    private _contextMenu: ContextMenu;

    private _barsDownSampleCache: Bars[] = [];

    private __keydownHandler = this._keydownHandler.bind(this);

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
        if (options.cursorSnapToGrid === undefined) {
            options.cursorSnapToGrid = true;
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

    insertTo(container: Element) {

        container.appendChild(this._rootContainer);

        this._hasRemoved = false;

        this.resize();
    }

    remove() {

        this._removeListeners();

        this._rootContainer.parentNode.removeChild(this._rootContainer);

        this.canvasW = this.canvasH = 0;
        this._hasRemoved = true;

        cancelAnimationFrame(this._afr);
    }

    resize() {

        let w = this.canvasW = this._chartContainer.clientWidth;
        let h = this.canvasH = this._chartContainer.clientHeight;

        w *= this._dpr;
        h *= this._dpr;

        this.canvases.forEach(canvas => {
            canvas.width = w;
            canvas.height = h;
        });

        this._hasUpdated = true;

        this._redraw();
    }

    zoom(delta: number) {

        this.options.barWidth = Math.min(11, Math.max(1, this.options.barWidth + delta));

        this._hasUpdated = true;
    }

    update(index: number, bars: Bar[]) {

        this.charts[index].bars = bars;

        this._hasUpdated = true;
    }

    updateHBars(index: number, hBars: Bar[]) {

        this.charts[index].hBars = hBars;

        this._hasUpdated = true;
    }

    tick(index: number, tick: Tick) {

        const chart = this.charts[index];

        chart.tickDelta = 0;
        if (chart.ticks[0] && chart.bars[0] && chart.bars[0][BarColumn.Close] !== tick[TickColumn.Ltp]) {
            chart.tickDelta = tick[TickColumn.Ltp] - chart.bars[0][BarColumn.Close];
        }
        if (!chart.ticks[0] || 1000 < tick[TickColumn.Time] - chart.ticks[0][TickColumn.Time]) {
            chart.ticks.unshift(tick);
            if (chart.ticks.length > 250) {
                chart.ticks.pop();
            }
        }

        let lastTime = Date.now() - 1000 * 60;
        if (chart.bars.length > 0) {
            lastTime = chart.bars[0][BarColumn.Time];
        }

        const bar = chart.bars[0];

        const time = tick[TickColumn.Time];
        if (!bar || new Date(lastTime).getMinutes() !== new Date(time).getMinutes()) {
            const delta = Math.floor((time - lastTime) / 1000 / 60);
            for (let i = delta; i > 0; i--) {
                if (i === 1) {
                    chart.bars.unshift([
                        new Date(tick[TickColumn.Time]).setSeconds(0, 0),
                        tick[TickColumn.Ltp],
                        tick[TickColumn.Ltp],
                        tick[TickColumn.Ltp],
                        tick[TickColumn.Ltp],
                        tick[TickColumn.Volume],
                        tick[TickColumn.AskDepth],
                        tick[TickColumn.BidDepth],
                        tick[TickColumn.SellVolume],
                        tick[TickColumn.BuyVolume]
                    ]);
                } else {
                    chart.bars.unshift([
                        new Date(tick[TickColumn.Time]).setSeconds(0, 0) - (1000 * 60 * (i - 1)),
                        chart.ticks[0][TickColumn.Ltp],
                        chart.ticks[0][TickColumn.Ltp],
                        chart.ticks[0][TickColumn.Ltp],
                        chart.ticks[0][TickColumn.Ltp],
                        chart.ticks[0][TickColumn.Volume],
                        chart.ticks[0][TickColumn.AskDepth],
                        chart.ticks[0][TickColumn.BidDepth],
                        chart.ticks[0][TickColumn.SellVolume],
                        chart.ticks[0][TickColumn.BuyVolume]
                    ]);
                }

                if (chart.bars.length > this.maxBarCount) {
                    chart.bars.pop();
                }
            }
        } else {
            if (bar[BarColumn.High] < tick[TickColumn.Ltp]) {
                bar[BarColumn.High] = tick[TickColumn.Ltp];
            }
            if (bar[BarColumn.Low] > tick[TickColumn.Ltp]) {
                bar[BarColumn.Low] = tick[TickColumn.Ltp];
            }
            bar[BarColumn.Close] = tick[TickColumn.Ltp];
            if (bar[BarColumn.Volume] < tick[TickColumn.Volume]) {
                bar[BarColumn.Volume] = tick[TickColumn.Volume];
            }
            bar[BarColumn.AskDepth] = tick[TickColumn.AskDepth];
            bar[BarColumn.BidDepth] = tick[TickColumn.BidDepth];
            if (bar[BarColumn.SellVolume] < tick[TickColumn.SellVolume]) {
                bar[BarColumn.SellVolume] = tick[TickColumn.SellVolume];
            }
            if (bar[BarColumn.BuyVolume] < tick[TickColumn.BuyVolume]) {
                bar[BarColumn.BuyVolume] = tick[TickColumn.BuyVolume];
            }
        }

        this._hasUpdated = true;
    }

    updateBoard(index: number, board: Board) {

        board = util.deepCopy(board);

        const chart = this.charts[index];
        const groupPrice = util.generatePriceGrouping(this._decimal, this.options.boardGroupSize);

        let boardMaxSize = 0;

        const maxPrice = chart.highest;
        const minPrice = chart.lowest;
        function groupUp(boardItems: BoardItem[]) {

            if (boardItems.length === 0) {
                return [];
            }

            let current: BoardItem = { price: groupPrice(boardItems[0].price), size: 0 };
            let currentSize = new Decimal(0);
            const groupedItems = [current];
            for (let i = 0; i < boardItems.length; i++) {
                const price = groupPrice(boardItems[i].price);
                if (price < minPrice || maxPrice < price) {
                    break;
                }

                if (current.price !== price) {
                    if (boardMaxSize < current.size) {
                        boardMaxSize = current.size;
                    }
                    current = {
                        price,
                        size: boardItems[i].size
                    };
                    currentSize = new Decimal(current.size);
                    groupedItems.push(current);
                } else {
                    currentSize = currentSize.plus(boardItems[i].size);
                    current.size = currentSize.toNumber();
                }
            }

            if (boardMaxSize < current.size) {
                boardMaxSize = current.size;
            }

            return groupedItems;
        }

        board.asks = groupUp(board.asks);
        board.bids = groupUp(board.bids);

        chart.board = board;
        chart.boardMaxSize = boardMaxSize;

        this._hasUpdated = true;
    }

    setColor(option: ColorOption) {

        for (const key in option) {
            this.color[key] = option[key];
        }

        this._chartContainer.style.borderColor = this.color.border;
    }

    setPositions(positions: PositionLike[]) {
        this._positions = new PositionSet(positions);
    }

    setOrders(orders: OrderLike[]) {
        this._orders = new OrderSet(orders);
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

            if (/iPad;|iPhone;/.test(navigator.userAgent) === true) {
                this.overlay.canvas.addEventListener("touchstart", this._touchEventsHandler.bind(this));
                this.overlay.canvas.addEventListener("touchmove", this._touchEventsHandler.bind(this));
                this.overlay.canvas.addEventListener("touchend", this._touchEventsHandler.bind(this));
            } else {
                this.overlay.canvas.addEventListener("pointerdown", this._pointerdownHandler.bind(this));
                this.overlay.canvas.addEventListener("pointerup", this._pointerupHandler.bind(this));
                this.overlay.canvas.addEventListener("pointermove", this._pointermoveHandler.bind(this));
                this.overlay.canvas.addEventListener("pointerout", this._pointeroutHandler.bind(this));
                this.overlay.canvas.addEventListener("wheel", this._wheelHandler.bind(this)/* , { passive: true } */);
                this.overlay.canvas.addEventListener("contextmenu", this._contextmenuHandler.bind(this));
            }
        }

        for (let i = 0; i < this.options.chartCount; i++) {
            const chart = {
                title: this.options.chartTitles[i] || "Untitled",
                canvas: document.createElement("canvas"),
                context: null,
                bars: [],
                hBars: [],
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

        this._addListeners();
    }

    private _addListeners() {

        window.addEventListener("keydown", this.__keydownHandler);
    }

    private _removeListeners() {

        window.removeEventListener("keydown", this.__keydownHandler);
    }

    private _redraw() {

        if (this._afr) {
            cancelAnimationFrame(this._afr);
        }

        // initial settings
        this.contexts.forEach(context => {
            context.scale(this._dpr, this._dpr);
            context.imageSmoothingEnabled = false;
        });

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

        const canvasW = this.canvasW;
        const canvasH = this.canvasH;
        const barW = this.options.barWidth + this.options.barMargin;
        const chartW = canvasW - 45;
        const chartH = canvasH - 16;
        const chartM = barW * Math.max(2, 5 - this.barIndex); // 右側の余白の幅 板や値幅などを表示
        const chartI = Math.max(0, this.barIndex - 3); // 表示対象の足の先頭位置
        const barCount = Math.round((chartW - chartM) / barW) - 1;
        const decimal = this._decimal;
        const decimalPower = this.options.decimalPower;
        const period = this.timePeriod;

        let l = 0;
        const m = this.charts.length;
        let highest = 0;
        let lowest = Infinity;
        let maxVolume = 0;
        let maxDepth = 0;
        let minDepth = Infinity;
        let bar: Bar;
        let barH = 0;
        let barDate: Date;
        let barDateMinutes: number;
        let barDateHours: number;
        let barDateDate: number;
        let barDateMonth: number;
        let lowestGridPrice: number;
        let gridPriceDelta: number;

        this.hasDepleted = false;

        // pre
        for (let j = 0; j < m; j++) {
            const chart = this.charts[j];

            chart.context.clearRect(0, 0, canvasW, canvasH);

            if (period === 0 && !chart.selected) {
                continue;
            }

            highest = 0;
            lowest = Infinity;
            maxVolume = 0;
            maxDepth = 0;
            minDepth = Infinity;

            const requireBarCount = barCount + (chart.selected ? this.getRequiredBackCount(barCount) : barCount);

            chart._bars = this._getBars(j, chartI, requireBarCount);
            l = Math.min(barCount, chart._bars.length);

            if (chart.selected) {
                if (requireBarCount > chart._bars.length && this.maxBarCount > (period > TimeByMinutes.OneHour ? chart.hBars.length : chart.bars.length)) {
                    this.hasDepleted = true;
                }
            }

            for (let i = 0; i < l; i++) {
                bar = chart._bars[i];
                if (!bar) {
                    break;
                }
                if (highest < bar[BarColumn.High]) {
                    highest = bar[BarColumn.High];
                }
                if (lowest > bar[BarColumn.Low]) {
                    lowest = bar[BarColumn.Low];
                }
                if (maxVolume < bar[BarColumn.Volume]) {
                    maxVolume = bar[BarColumn.Volume];
                }
                if (maxDepth < bar[BarColumn.AskDepth]) {
                    maxDepth = bar[BarColumn.AskDepth];
                }
                if (minDepth > bar[BarColumn.AskDepth]) {
                    minDepth = bar[BarColumn.AskDepth];
                }
                if (maxDepth < bar[BarColumn.BidDepth]) {
                    maxDepth = bar[BarColumn.BidDepth];
                }
                if (minDepth > bar[BarColumn.BidDepth]) {
                    minDepth = bar[BarColumn.BidDepth];
                }
            }

            if (chart._bars.length === 0) {
                return;
            }

            chart.latest = chart.bars[0][BarColumn.Close];
            chart.highestPrice = highest;
            chart.lowestPrice = lowest;
            chart.highestPricePrinted = false;
            chart.lowestPricePrinted = false;
            const priceRatio = chartH / (highest - lowest);
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
        }// pre

        this.grid.context.clearRect(0, 0, canvasW, canvasH);
        this.grid.context.fillStyle = this.color.bg;
        this.grid.context.fillRect(0, 0, canvasW, canvasH);
        this.grid.context.textAlign = "center";

        this.overlay.context.clearRect(0, 0, canvasW, canvasH);

        // main
        for (let j = 0; j < m; j++) {
            const chart = this.charts[j];
            const ctx = chart.context;
            let barX = chartW - chartM;

            if (period === 0 && !chart.selected) {
                continue;
            }

            // bars
            for (let i = 0; i < l; i++) {
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
                        Math.round((bar[BarColumn.AskDepth] - chart.minDepth) * chart.depthRatio)
                    );

                    ctx.fillStyle = i === 0 && chartI < 1 ? this.color.bidDepthLast : this.color.bidDepth;
                    ctx.fillRect(
                        barX - this.options.barWidth,
                        chartH,
                        barW,
                        - Math.round((bar[BarColumn.BidDepth] - chart.minDepth) * chart.depthRatio)
                    );
                }

                // volume
                ctx.fillStyle = this.color.volume;
                ctx.fillRect(
                    barX - Math.ceil(this.options.barWidth / 2),
                    chartH,
                    1,
                    - Math.round(bar[BarColumn.Volume] * chart.volumeRatio)
                );

                // candlestick
                if (period !== 0) {
                    // bar height
                    barH = Math.round((bar[BarColumn.Open] - bar[BarColumn.Close]) * chart.ratio);

                    // candlestick
                    ctx.fillStyle = bar[BarColumn.Open] > bar[BarColumn.Close] ? this.color.short : this.color.long;
                    ctx.fillRect(
                        barX - this.options.barWidth,
                        Math.round((chart.highest - bar[BarColumn.Open]) * chart.ratio),
                        this.options.barWidth,
                        barH === 0 ? 1 : barH
                    );
                    // candlestick (hige)
                    ctx.fillRect(
                        barX - Math.ceil(this.options.barWidth / 2),
                        Math.round((chart.highest - bar[BarColumn.High]) * chart.ratio),
                        1,
                        Math.round((bar[BarColumn.High] - bar[BarColumn.Low]) * chart.ratio)
                    );
                }

                if (!chart.selected) {
                    continue;
                }

                // highest
                if (period !== 0 && bar[BarColumn.High] === chart.highestPrice) {
                    this.overlay.context.fillStyle = this.color.long;

                    const hpX = barX - this.options.barWidth / 2;
                    const hpY = Math.round((chart.highest - bar[BarColumn.High]) * chart.ratio);

                    this.overlay.context.beginPath();
                    this.overlay.context.moveTo(hpX, hpY - 2);
                    this.overlay.context.lineTo(hpX + 3, hpY - 5);
                    this.overlay.context.lineTo(hpX - 3, hpY - 5);
                    this.overlay.context.fill();

                    if (chart.highestPricePrinted === false) {
                        chart.highestPricePrinted = true;

                        this.overlay.context.textAlign = (i < l / 2) ? "right" : "left";
                        this.overlay.context.fillText(
                            new Decimal(bar[BarColumn.High]).toFixed(decimalPower),
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
                if (period !== 0 && bar[BarColumn.Low] === chart.lowestPrice) {
                    this.overlay.context.fillStyle = this.color.short;

                    const lpX = barX - this.options.barWidth / 2;
                    const lpY = Math.round((chart.highest - bar[BarColumn.Low]) * chart.ratio);

                    this.overlay.context.beginPath();
                    this.overlay.context.moveTo(lpX, lpY + 2);
                    this.overlay.context.lineTo(lpX + 3, lpY + 5);
                    this.overlay.context.lineTo(lpX - 3, lpY + 5);
                    this.overlay.context.fill();

                    if (chart.lowestPricePrinted === false) {
                        chart.lowestPricePrinted = true;

                        this.overlay.context.textAlign = (i < l / 2) ? "right" : "left";
                        this.overlay.context.fillText(
                            new Decimal(bar[BarColumn.Low]).toFixed(decimalPower),
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
                barDate = new Date(bar[BarColumn.Time]);
                barDateMinutes = barDate.getMinutes();
                barDateHours = barDate.getHours();
                barDateDate = barDate.getDate();
                barDateMonth = barDate.getMonth();

                // datetime
                if (
                    (period === 0 && i % 10 === 0) ||
                    (period >= 1 && period < 3 && barDateMinutes % 15 === 0) ||
                    (period >= 3 && period < 5 && barDateMinutes % 30 === 0) ||
                    (period >= 5 && period < 10 && barDateMinutes % 60 === 0) ||
                    (period >= 10 && period < 15 && barDateMinutes % 60 === 0 && barDateHours % 2 === 0) ||
                    (period >= 15 && period < 30 && barDateMinutes % 60 === 0 && barDateHours % 3 === 0) ||
                    (period >= 30 && period < 60 && barDateMinutes % 60 === 0 && barDateHours % 6 === 0) ||
                    (period >= 60 && period < 120 && barDateMinutes % 60 === 0 && barDateHours % 12 === 0) ||
                    (period >= 120 && period < 240 && barDateHours === 0) ||
                    (period >= 240 && period < 360 && barDateHours === 0 && barDateDate % 2 === 1) ||
                    (period >= 360 && period < 720 && barDateHours === 0 && barDateDate % 3 === 1) ||
                    (period >= 720 && barDateHours === 0 && barDateDate % 7 === 1)
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
                    if (barX > chartW - 40) {
                        timeStr = null;
                    } else if (period === 0) {
                        timeStr = `${barDate.getSeconds()}s`;
                    } else if (!(barDateHours === 0 && barDateMinutes === 0)) {
                        timeStr = `${barDateHours}:${util.zeroPadding(barDateMinutes, 2)}`;
                    } else if (period >= 1440 && barDateDate > 22) {
                        timeStr = null;
                    } else if (barDateDate !== 1) {
                        timeStr = period >= 1440 ? barDateDate : `${barDateMonth + 1}/${barDateDate}'`;
                    } else if (barDateMonth !== 0) {
                        timeStr = Month[barDateMonth];
                    } else {
                        timeStr = barDate.getFullYear();
                    }

                    if (timeStr !== null) {
                        this.grid.context.fillStyle = this.color.text;
                        this.grid.context.font = "10px sans-serif";
                        this.grid.context.fillText(
                            timeStr,
                            barX - Math.ceil(this.options.barWidth / 2),
                            canvasH - 4
                        );
                    }
                }
            }// bars

            if (chart.selected) {
                // LTP Position (Y)
                let ltpp = Math.round((chart.highest - chart.latest) * chart.ratio);
                if (!isFinite(ltpp)) {
                    ltpp = Math.round(canvasH / 2);
                }

                // horizontal grid (price)
                let lp = Infinity;
                let cp = 0;
                gridPriceDelta = decimal === 1 ? 1000 : 100 / decimal;
                if (period === 0) {
                    gridPriceDelta /= 100;
                }

                gridPriceDelta *= Math.ceil(80 / (gridPriceDelta * chart.ratio));
                lowestGridPrice = this.calculateHorizontalGridLowestPrice(chart, gridPriceDelta);
                for (let i = lowestGridPrice; i < chart.highest; i += gridPriceDelta) {
                    cp = Math.round((chart.highest - i) * chart.ratio);
                    if (cp + 30 > chartH) {
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
                    this.grid.context.font = "11px sans-serif";
                    this.grid.context.textAlign = "left";
                    this.grid.context.fillText(
                        new Decimal(i).toFixed(decimalPower),
                        chartW + 2,
                        cp + 5,
                        39
                    );

                    lp = cp;
                }

                // Price Range Indicator
                this._drawVerticalRange(
                    this.grid.context,
                    chartW - chartM + barW,
                    (chart.highest - chart.highestPrice) * chart.ratio,
                    (chart.highestPrice - chart.lowestPrice) * chart.ratio,
                    this.color.border,
                    [2, 1]
                );
                const priceRangeLabelY = ((chart.highestPrice - chart._bars[0][BarColumn.High]) > (chart._bars[0][BarColumn.Low] - chart.lowestPrice)) ? ((chart.highest - chart.highestPrice) * chart.ratio + 40) : ((chart.highest - chart.lowestPrice) * chart.ratio - 40);
                this.grid.context.save();
                this.grid.context.fillStyle = this.color.bg;
                this.grid.context.fillRect(
                    chartW - chartM + barW,
                    priceRangeLabelY - 10,
                    1,
                    12
                );
                this.grid.context.textAlign = "right";
                this.grid.context.fillStyle = this.color.textWeak;
                this.grid.context.font = "10px sans-serif";
                this.grid.context.globalAlpha = 0.6;
                this.grid.context.fillText(
                    new Decimal(chart.highestPrice - chart.lowestPrice).toFixed(decimalPower),
                    chartW - chartM + barW + 6,
                    priceRangeLabelY
                );
                this.grid.context.restore();

                // Last Sell/Buy Volume Indicator (experimental)
                this.overlay.context.save();

                if (chart._bars[0][BarColumn.SellVolume] > chart._bars[0][BarColumn.BuyVolume]) {
                    const grad = this.overlay.context.createLinearGradient(0, 1, 0, ltpp - 2);
                    grad.addColorStop(0, this.color.askOrder);
                    grad.addColorStop(1, this.color.bg);
                    this.overlay.context.fillStyle = grad;
                    this.overlay.context.globalAlpha = (chart._bars[0][BarColumn.SellVolume] - chart._bars[0][BarColumn.BuyVolume]) / chart._bars[0][BarColumn.Volume];
                    this.overlay.context.fillRect(chartW - 1, 1, -4, ltpp - 2);
                } else if (chart._bars[0][BarColumn.SellVolume] < chart._bars[0][BarColumn.BuyVolume]) {
                    const grad = this.overlay.context.createLinearGradient(0, ltpp + 1, 0, chartH);
                    grad.addColorStop(0, this.color.bg);
                    grad.addColorStop(1, this.color.bidOrder);
                    this.overlay.context.fillStyle = grad;
                    this.overlay.context.globalAlpha = (chart._bars[0][BarColumn.BuyVolume] - chart._bars[0][BarColumn.SellVolume]) / chart._bars[0][BarColumn.Volume];
                    this.overlay.context.fillRect(chartW - 1, chartH - 1, -4, -(chartH - ltpp - 2));
                }

                this.overlay.context.restore();

                if (this.cursorX > -1 && chart._bars[0].length > BarColumn.BuyVolume && chart._bars[0][BarColumn.BuyVolume]) {
                    this._drawDepthIndicator(
                        this.overlay.context,
                        chartW - chartM - 7,
                        40,
                        `Sell Vol. ${new Decimal(chart._bars[0][BarColumn.SellVolume]).toFixed(1)}`,
                        this.color.askOrder
                    );
                    this._drawDepthIndicator(
                        this.overlay.context,
                        chartW - chartM - 7,
                        chartH - 40,
                        `Buy Vol. ${new Decimal(chart._bars[0][BarColumn.BuyVolume]).toFixed(1)}`,
                        this.color.bidOrder
                    );
                }

                // Last Depth Indicator (v2.25)
                if (chart._bars[0][BarColumn.AskDepth] && chart._bars[0][BarColumn.BidDepth]) {
                    this._drawDepthIndicator(
                        this.overlay.context,
                        chartW - chartM - 7,
                        20,
                        `Ask Depth ${Math.round(chart._bars[0][BarColumn.AskDepth])}`,
                        this.color.askDepthLast
                    );
                    this._drawDepthIndicator(
                        this.overlay.context,
                        chartW - chartM - 7,
                        chartH - 20,
                        `Bid Depth ${Math.round(chart._bars[0][BarColumn.BidDepth])}`,
                        this.color.bidDepthLast
                    );
                }

                // Ask/Bid Price Indicator (v2.24)
                if (chart.askPrice && chart.bidPrice) {
                    const askp = Math.round((chart.highest - chart.askPrice) * chart.ratio);
                    const bidp = Math.round((chart.highest - chart.bidPrice) * chart.ratio);

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
                    let board: BoardItem;
                    const boardItemHeight = Math.round((this.options.boardGroupSize / decimal) * chart.ratio);

                    this.overlay.context.save();

                    this.overlay.context.fillStyle = this.color.askOrder;
                    for (let i = 0; i < chart.board.asks.length - 1; i++) {
                        board = chart.board.asks[i];

                        this.overlay.context.globalAlpha = Math.min(1, board.size / chart.boardMaxSize + 0.12);
                        this.overlay.context.fillRect(
                            chartW - 1,
                            Math.round((chart.highest - board.price) * chart.ratio),
                            -(Math.min(19, Math.ceil(board.size / chart.boardMaxSize * 19)) + 1),
                            -boardItemHeight
                        );
                    }
                    this.overlay.context.fillStyle = this.color.bidOrder;
                    for (let i = 0; i < chart.board.bids.length - 1; i++) {
                        board = chart.board.bids[i];

                        this.overlay.context.globalAlpha = Math.min(1, board.size / chart.boardMaxSize + 0.12);
                        this.overlay.context.fillRect(
                            chartW - 1,
                            Math.round((chart.highest - board.price) * chart.ratio),
                            -(Math.min(19, Math.ceil(board.size / chart.boardMaxSize * 19)) + 1),
                            boardItemHeight
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
                this._positions.forEach(position => {
                    this._drawPositionMarker(
                        this.overlay.context,
                        0,
                        Math.round((chart.highest - position.price) * chart.ratio),
                        chartW,
                        position,
                        chart.latest
                    );
                });

                // Orders (testing)
                this._orders.forEach(order => {
                    this._drawOrderMarker(
                        this.overlay.context,
                        0,
                        Math.round((chart.highest - order.price) * chart.ratio),
                        chartW,
                        order,
                        chart.latest
                    );
                });

                // LTP
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
                if (this.options.pricePopEffect) {
                    this._drawPricePopEffect(chart, decimal, chartW, ltpp);
                }
            }
        } // main

        const dimensions: ChartDimensions = {
            width: chartW,
            height: chartH,
            rightMargin: chartM,
            firstBarIndex: chartI,
            barCount,
            barMargin: this.options.barMargin,
            barWidth: this.options.barWidth
        };

        // drawing only for selected chart
        for (let j = 0; j < m; j++) {
            const chart = this.charts[j];
            if (!chart.selected) {
                break;
            }

            // Tick graph
            if (period === 0) {
                const ctx = chart.context;

                ctx.save();

                ctx.strokeStyle = this.color.text;
                ctx.lineWidth = 1;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.setLineDash([]);
                ctx.beginPath();

                let i = 0;
                let p = 0;
                let y = 0;
                let x = chartW - chartM - Math.ceil(barW / 2) + 1 + barW;
                for (; i < barCount; i++) {
                    if (!chart._bars[i]) {
                        break;
                    }
                    x -= barW;

                    p = chart._bars[i][BarColumn.Close];
                    y = Math.round((chart.highest - p) * chart.ratio) + 0.5;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    }
                    ctx.lineTo(x, y);
                }

                ctx.stroke();

                ctx.restore();
            }

            // overlays
            for (const name in this.overlays) {
                if (this.overlays[name].minPeriod <= period) {
                    this.overlays[name].draw(chart, dimensions, this.color);
                }
            }

            chart.context.clearRect(0, chartH, chartW, canvasH - chartH);

            // border
            chart.context.fillStyle = this.color.border;
            chart.context.fillRect(chartW, 0, 1, chartH);
            chart.context.fillRect(0, chartH, chartW + 1, 1);
        } // drawing only for selected chart

        // datetime
        if (period > 0) {
            barDate = new Date(this.charts[0]._bars[0][BarColumn.Time]);
            this.grid.context.textAlign = "right";
            this.grid.context.fillStyle = this.color.text;
            this.grid.context.fillText(
                period >= TimeByMinutes.OneDay ?  `${barDate.getDate()}` :
                    period >= TimeByMinutes.OneHour ? `${barDate.getHours()}:00` :
                        `:${util.zeroPadding(barDate.getMinutes(), 2)}`,
                canvasW - 45,
                canvasH - 4
            );
        }

        // cursor
        this.cursorPrice = 0;
        if (this.cursorX > 0 && this.cursorY > 30 && this.cursorX < chartW && this.cursorY < chartH) {
            let pX = this.cursorX - (this.cursorX % barW);
            const i = Math.round((chartW - pX - chartM - this.options.barWidth) / barW);
            pX = Math.floor(chartW - chartM - (i * barW) - (barW / 2)) - 1;

            // bar line
            this.grid.context.fillStyle = this.color.grid;
            this.grid.context.fillRect(
                pX,
                0,
                this.options.barWidth,
                chartH
            );

            const chart = this.charts[0];

            if (this.options.cursorSnapToGrid) {
                const nearestGridPrice = lowestGridPrice + Math.floor((chart.highest - this.cursorY / chart.ratio - lowestGridPrice) / gridPriceDelta) * gridPriceDelta;
                const nearestGridY = Math.floor((chart.highest - nearestGridPrice) * chart.ratio);
                if (nearestGridY === Math.floor(this.cursorY) || nearestGridY === Math.ceil(this.cursorY)) {
                    this.cursorPrice = nearestGridPrice;
                }
            }

            if (this.cursorPrice === 0) {
                this.cursorPrice = Math.ceil((chart.highest - this.cursorY / chart.ratio) * decimal) / decimal;
                if (decimal === 1) {
                    this.cursorPrice = Math.round(this.cursorPrice / 50) * 50;
                } else {
                    this.cursorPrice = Math.round(this.cursorPrice * (decimal / 10)) / (decimal / 10);
                }
            }
            const cursorPriceY = Math.round((chart.highest - this.cursorPrice) * chart.ratio);

            // price
            this._drawPriceTag(
                this.overlay.context,
                0,
                cursorPriceY,
                chartW,
                this.cursorPrice,
                this.color.border,
                this.color.textStrong,
                []
            );

            // board
            this.cursorBoard = 0;
            this.cursorBoardPrice = 0;
            if (chart.board) {
                if (this.cursorPrice > chart.latest) {
                    for (let j = chart.board.asks.length - 1; j >= 0; j--) {
                        if (chart.board.asks[j].price <= this.cursorPrice) {
                            this.cursorBoard = chart.board.asks[j].size;
                            this.cursorBoardPrice = chart.board.asks[j].price;
                            break;
                        }
                    }
                }
                if (this.cursorPrice < chart.latest) {
                    for (let j = chart.board.bids.length - 1; j >= 0; j--) {
                        if (chart.board.bids[j].price >= this.cursorPrice) {
                            this.cursorBoard = chart.board.bids[j].size;
                            this.cursorBoardPrice = chart.board.bids[j].price;
                            break;
                        }
                    }
                }
            }
            this.cursorBoard = Math.round(this.cursorBoard);
            if (this.cursorBoard > 0) {
                const cursorBoardPriceY = Math.round((chart.highest - this.cursorBoardPrice) * chart.ratio);

                this._drawBorder(
                    this.overlay.context,
                    chartW - 25,
                    cursorBoardPriceY + (this.cursorPrice > chart.latest ? -0.5 : +0.5),
                    10,
                    this.cursorPrice > chart.latest ? this.color.askOrder : this.color.bidOrder,
                    [1, 1]
                );

                this.overlay.context.save();

                this.overlay.context.globalAlpha = 0.8;
                this.overlay.context.fillStyle = this.color.bg;
                this.overlay.context.fillRect(
                    chartW - 29,
                    cursorBoardPriceY - 7,
                    -22,
                    13
                );

                this.overlay.context.globalAlpha = 1;
                this.overlay.context.textAlign = "right";
                this.overlay.context.fillStyle = this.cursorPrice > chart.latest ? this.color.askOrder : this.color.bidOrder;
                this.overlay.context.fillText(
                    this.cursorBoard.toString(10),
                    chartW - 29,
                    cursorBoardPriceY + 3,
                    20
                );

                this.overlay.context.restore();
            }

            this.overlay.context.save();

            if (i >= 0 && i < chart._bars.length) {
                // Time Line
                this.grid.context.fillStyle = this.color.grid;
                this.grid.context.fillRect(
                    pX - 13,
                    chartH,
                    31,
                    20
                );
                // Time Text
                barDate = new Date(chart._bars[i][BarColumn.Time]);
                const barTime = barDate.getHours() === 0 && barDate.getMinutes() === 0 ?
                    `${barDate.getMonth() + 1}/${barDate.getDate()}'` :
                    `${barDate.getHours()}:${util.zeroPadding(barDate.getMinutes(), 2)}`;
                this.grid.context.textAlign = "center";
                this.grid.context.fillStyle = this.color.textStrong;
                this.grid.context.font = "10px sans-serif";
                this.grid.context.fillText(
                    barTime,
                    pX + this.options.barWidth / 2,
                    canvasH - 4
                );

                // Bar Info
                this.overlay.context.textAlign = "left";
                this.overlay.context.fillStyle = this.color.textStrong;
                this.overlay.context.font = "12px monospace";
                const diff = Math.round((100 - (chart._bars[i][BarColumn.Open] / chart._bars[i][BarColumn.Close] * 100)) * 1000) / 1000;
                this.overlay.context.fillText(
                    (
                        barDate.toLocaleString() +
                        `  O ${new Decimal(chart._bars[i][BarColumn.Open]).toFixed(decimalPower)}` +
                        `  H ${new Decimal(chart._bars[i][BarColumn.High]).toFixed(decimalPower)}` +
                        `  L ${new Decimal(chart._bars[i][BarColumn.Low]).toFixed(decimalPower)}` +
                        `  C ${new Decimal(chart._bars[i][BarColumn.Close]).toFixed(decimalPower)}` +
                        `  ${util.toStringWithSign(diff)}%`
                    ),
                    10,
                    20,
                    canvasW - 20
                );
                if (this._lastPointerType === "mouse") {
                    this.overlay.context.fillText(
                        "[価格マーカー] 左クリックで追加・削除",
                        10,
                        40
                    );
                }

                // Volume
                if (chart._bars[i + 1]) {
                    this.overlay.context.globalAlpha = 0.8;
                    this.overlay.context.fillStyle = this.color.bg;
                    this.overlay.context.fillRect(
                        pX + (barW / 2) - 17,
                        (chart.highest - chart.lowestPrice) * chart.ratio + 2,
                        34,
                        13
                    );

                    this.overlay.context.globalAlpha = 1;
                    this.overlay.context.textAlign = "center";
                    this.overlay.context.font = "10px sans-serif";
                    this.overlay.context.fillStyle = this.color.volume;
                    this.overlay.context.fillText(
                        Math.round(chart._bars[i][BarColumn.Volume]).toString(10),
                        pX + (barW / 2),
                        (chart.highest - chart.lowestPrice) * chart.ratio + 12,
                        30
                    );
                }
            }

            this.overlay.context.restore();

            // Total Margin of Positions on Cursor (testing)
            if (!this._positions.isEmpty() && this.cursorPrice) {
                const margin = Math.floor(this._positions.marginAgainst(this.cursorPrice));
                const marginText = util.toStringWithSign(margin);

                this.overlay.context.save();

                this.overlay.context.globalAlpha = 0.8;
                this.overlay.context.fillStyle = this.color.bg;
                this.overlay.context.fillRect(
                    6,
                    cursorPriceY - 5,
                    60,
                    13
                );

                this.overlay.context.globalAlpha = 1;
                this.overlay.context.textAlign = "left";
                this.overlay.context.fillStyle = margin < 0 ? this.color.short : this.color.long;
                this.overlay.context.fillText(
                    marginText,
                    10,
                    cursorPriceY + 5,
                    56
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
        if (!this._positions.isEmpty()) {
            const chart = this.charts[0];
            const margin = Math.floor(this._positions.marginAgainst(chart.latest));
            const marginText = `建玉: ${this._positions.size}  評価損益: ${util.toStringWithSign(margin)}`;

            this.overlay.context.save();
            this.overlay.context.font = "bold 11px sans-serif";
            this.overlay.context.textAlign = "left";
            this.overlay.context.strokeStyle = this.color.bg;
            this.overlay.context.fillStyle = margin < 0 ? this.color.short : this.color.long;
            this.overlay.context.strokeText(marginText, 10, 80);
            this.overlay.context.fillText(marginText, 10, 80);
            this.overlay.context.restore();
        }

        if (this._afs !== 0) {
            this._afs--;
            this._hasUpdated = true;
        }
    }

    private getRequiredBackCount(required = 0) {

        for (const name in this.overlays) {
            const overlayRequires = this.overlays[name].requiredBackCount;
            if (overlayRequires > required) {
                required = overlayRequires;
            }
        }

        return required;
    }

    private _drawPricePopEffect(chart: Chart, decimal: number, chartW: number, ltpp: number): void {

        let i;
        for (i = 0; i < this._pricePops.length; i++) {
            this._pricePops[i][0] *= 0.95;
            if (this._pricePops[i][0] < 0.08) {
                this._pricePops.splice(i, 1);
                i--;
                continue;
            }
            if (this._pricePops[i][5]) {
                this._pricePops[i][4] -= 0.15;
            } else {
                this._pricePops[i][4] += 0.15;
            }
        }
        if (chart.tickDelta !== 0) {
            this._pricePops.push([
                1,
                (Math.round(Math.abs(chart.tickDelta) * decimal) / decimal).toString(10),
                chart.tickDelta > 0 ? this.color.long : this.color.short,
                chartW - 12,
                chart.tickDelta > 0 ? (ltpp - 8) : (ltpp + 16),
                chart.tickDelta > 0,
                Math.abs(chart.tickDelta) / chart.latest * 100 > 0.025 ? "bold 11px sans-serif" : "10px sans-serif"
            ]);

            this._afs = Math.max(50, this._afs);
            chart.tickDelta = 0;
        }
        this.overlay.context.save();
        this.overlay.context.textAlign = "right";
        for (i = 0; i < this._pricePops.length; i++) {
            const [alpha, delta, fillStyle, posX, posY, isBuy, font] = this._pricePops[i];

            this.overlay.context.font = font;
            this.overlay.context.globalAlpha = alpha;
            this.overlay.context.fillStyle = fillStyle;
            this.overlay.context.fillText(
                delta,
                posX,
                posY
            );
        }
        this.overlay.context.restore();
    }

    private _getBars(index: number, start: number, barCount: number): Bars {

        const chart = this.charts[index];
        const period = this.timePeriod;

        if (chart.bars.length === 0) {
            return [];
        }

        if (period === TimeByMinutes.OneMinute) {
            return chart.bars.slice(start, start + barCount);
        } else if (period === 0) {
            return chart.ticks.slice(start, start + barCount).map(tick => {
                return <Bar> [
                    tick[TickColumn.Time],
                    tick[TickColumn.Ltp],
                    tick[TickColumn.Ltp],
                    tick[TickColumn.Ltp],
                    tick[TickColumn.Ltp],
                    tick[TickColumn.Volume],
                    tick[TickColumn.AskDepth],
                    tick[TickColumn.BidDepth],
                    tick[TickColumn.SellVolume],
                    tick[TickColumn.BuyVolume]
                ];
            });
        }

        const timeZoneOffset = new Date().getTimezoneOffset() * 60 * 1000;
        const latestTime = truncateTime(period, chart.bars[0][BarColumn.Time]) - period * start * 60 * 1000;
        const oldestTime = latestTime - (barCount - 1) * period * 60 * 1000;

        const cached: Bars = normalizeCache(this._barsDownSampleCache[index], oldestTime, latestTime, start === 0);

        // 分足が不十分な場合に対応
        // ただし、その場合volumeが重複カウントされる可能性があるため、
        // 今後updateHBarsで提供する足データにどこまで集計してあるかわかる情報を付加できるようにするか、
        // 最初に分足を現在時刻の時の0分(現在1:13なら1:00)からの分を設定することを求める必要がある
        const mBarExistsBeforeThisHour = chart.bars.length >= timeToIndex(chart.bars, 1, truncateTime(TimeByMinutes.OneHour, chart.bars[0][BarColumn.Time]));
        const barsFromHBars: Bars = downSample(
            mBarExistsBeforeThisHour ? chart.hBars.slice(1) : chart.hBars,
            TimeByMinutes.OneHour,
            period,
            cached.nextTick,
            latestTime + (period - TimeByMinutes.OneHour) * 60 * 1000
        );

        const barsFromMBars: Bars = downSample(
            chart.bars,
            1,
            period,
            barsFromHBars.nextTick,
            latestTime + (period - 1) * 60 * 1000
        );

        return this._barsDownSampleCache[index] = mergeBars(mergeBars(cached, barsFromHBars), barsFromMBars);

        function createBars(nextTick, period) {
            const ret: Bars = [];
            ret.period = period;
            ret.nextTick = nextTick;

            return ret;
        }

        function  normalizeCache(cache: Bars, oldestTime, latestTime, isZeroStart) {
            if (cache === undefined || cache.length === 0 || cache[cache.length - 1][BarColumn.Time] > oldestTime) {
                return createBars(oldestTime, period);
            }

            if (isZeroStart) {
                latestTime -= cache.period * 60 * 1000;
            }
            if (cache.period !== period) {
                return downSample(cache, cache.period, period, oldestTime, latestTime);
            }

            const end = Math.max(0, timeToIndex(cache, period, latestTime));
            const start = timeToIndex(cache, period, oldestTime);

            if (end >= cache.length) {
                return createBars(oldestTime, period);
            }

            const bars: Bars = cache.slice(end, start + 1);
            bars.nextTick = end === 0 ? cache.nextTick : cache[end - 1][BarColumn.Time];
            bars.period = period;

            return bars;
        }

        function mergeBars(bars1: Bars, bars2: Bars): Bars {
            if (bars1.length < 1) {
                return bars2;
            }

            if (bars2.length < 1) {
                return bars1;
            }

            const bar1: Bar = bars1[0];
            const bar2: Bar = bars2[bars2.length - 1];

            if (bar1[BarColumn.Time] === bar2[BarColumn.Time]) {
                mergeBar(bar1, bar2);
                bars2.pop();
            }

            const ret: Bars = bars2.concat(bars1);
            ret.nextTick = bars2.nextTick;
            ret.period = bars2.period;

            return ret;
        }

        function truncateTime(period: number, time: number) {
            const periodByMilliSec = period * 60 * 1000;
            return Math.floor((time - timeZoneOffset) / periodByMilliSec) * periodByMilliSec + timeZoneOffset;
        }

        function mergeBar(bar1: Bar, bar2: Bar) {
            if (bar1[BarColumn.High] < bar2[BarColumn.High]) {
                bar1[BarColumn.High] = bar2[BarColumn.High];
            }
            if (bar1[BarColumn.Low] > bar2[BarColumn.Low]) {
                bar1[BarColumn.Low] = bar2[BarColumn.Low];
            }
            bar1[BarColumn.Close] = bar2[BarColumn.Close];
            bar1[BarColumn.Volume] += bar2[BarColumn.Volume];
            bar1[BarColumn.AskDepth] = bar2[BarColumn.AskDepth] || 0;
            bar1[BarColumn.BidDepth] = bar2[BarColumn.BidDepth] || 0;
            bar1[BarColumn.SellVolume] += bar2[BarColumn.SellVolume] || 0;
            bar1[BarColumn.BuyVolume] += bar2[BarColumn.BuyVolume] || 0;
        }

        function downSample(fromBars: Bars, fromPeriod: number, period: number, oldestTime: number, latestTime: number): Bars {
            if (fromBars.length < 1 || fromPeriod > period || oldestTime > latestTime) {
                return createBars(oldestTime, period);
            }

            const end = Math.max(0, timeToIndex(fromBars, fromPeriod, latestTime));
            const start = timeToIndex(fromBars, fromPeriod, oldestTime);

            if (end >= fromBars.length || start < end) {
                return createBars(oldestTime, period);
            }

            if (fromPeriod === period) {
                const bars: Bars = fromBars.slice(end, start + 1).map(util.deepCopy);
                bars.nextTick = fromBars[end][BarColumn.Time] + fromPeriod * 60 * 1000;
                bars.period = period;

                return bars;
            }

            const bars: Bars = [];
            let i;
            let bar: Bar = void 0;
            for (i = Math.min(start, fromBars.length - 1); i >= end; i--) {
                const fromBar = fromBars[i];
                if ( bar === undefined || bar[BarColumn.Time] < truncateTime(period, fromBar[BarColumn.Time]) ) {
                    bars.unshift(bar = [
                        truncateTime(period, fromBar[BarColumn.Time]),
                        fromBar[BarColumn.Open],
                        fromBar[BarColumn.High],
                        fromBar[BarColumn.Low],
                        fromBar[BarColumn.Close],
                        fromBar[BarColumn.Volume],
                        fromBar[BarColumn.AskDepth] || 0,
                        fromBar[BarColumn.BidDepth] || 0,
                        fromBar[BarColumn.SellVolume] || 0,
                        fromBar[BarColumn.BuyVolume] || 0
                    ]);
                    continue;
                }
                mergeBar(bar, fromBar);
            }

            bars.nextTick = fromBars[end][BarColumn.Time] + fromPeriod * 60 * 1000;
            bars.period = period;
            return bars;
        }

        function timeToIndex(bars: Bar[], period: number, time: number) {
            if (bars.length < 1) {
                return NaN;
            }
            const periodByMilliSec = period * 60 * 1000;
            return Math.floor(bars[0][BarColumn.Time] / periodByMilliSec) - Math.floor((time / periodByMilliSec));
        }
    }

    private _keydownHandler(ev: KeyboardEvent) {

        const active = document.activeElement && document.activeElement.tagName;

        if (active !== "BODY" && active !== "DIV" && active !== "BUTTON") { return; }
        if (window.getSelection().toString() !== "") { return; }

        let activated = false;

        switch (ev.keyCode) {
            // Space
            case 32:
                activated = true;
                this.barIndex = 0;
                this._hasUpdated = true;
                break;
        }

        if (activated) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    }

    private _contextmenuHandler(ev: MouseEvent) {

        ev.stopPropagation();
        ev.preventDefault();

        const price = this.cursorPrice;
        const limitSide = this.charts[0].latest > price ? "buy" : "sell";
        const stopSide = limitSide === "buy" ? "sell" : "buy";
        const limitSideLabel = limitSide === "buy" ? "買い" : "売り";
        const stopSideLabel = stopSide === "buy" ? "買い" : "売り";

        const quickOrderItems = [];

        if (this.options.quickOrder) {
            quickOrderItems.push(
                {
                    labelHTML: `<span class="kuromaty-label ${limitSide}">${limitSideLabel}</span> 指値注文...`,
                    onSelect: () => {
                        this.options.quickOrderHandler({
                            price: price,
                            type: "limit"
                        });
                    }
                },
                {
                    labelHTML: `<span class="kuromaty-label ${stopSide}">${stopSideLabel}</span> STOP-LIMIT 注文...`,
                    onSelect: () => {
                        this.options.quickOrderHandler({
                            price: price,
                            type: "stop-limit"
                        });
                    }
                }
            );
        }

        if (this._contextMenu && this._contextMenu.visible() === true) {
            this._contextMenu.close();
        }

        this._contextMenu = new flagrate.ContextMenu({
            target: this._rootContainer,
            items: [
                {
                    label: `${price}`,
                    isDisabled: true
                },
                <any> "--",
                {
                    labelHTML: "価格をコピー",
                    onSelect: () => {
                        util.copyTextToClipboard(price.toString(10));
                    }
                },
                ...quickOrderItems,
                <any> "--",
                {
                    label: "価格マーカー全消去",
                    onSelect: () => {
                        this.pinnedPrices = [];
                        this._hasUpdated = true;
                    }
                },
                <any> "--",
                {
                    label: "キャンセル"
                }
            ]
        }).open(ev);
    }

    private _touchEventsHandler(ev: TouchEvent) {

        let nextHandler: (ev: PointerEvent) => void;
        switch (ev.type) {
            case "touchstart":
                nextHandler = this._pointerdownHandler;
                break;
            case "touchmove":
                nextHandler = this._pointermoveHandler;
                break;
            case "touchend":
                nextHandler = this._pointerupHandler;
                break;
        }

        const rect = (<Element> ev.target).getBoundingClientRect();

        for (let i = 0, len = ev.changedTouches.length; i < len; i++) {
            const touch = ev.changedTouches[i];

            nextHandler.call(this, {
                preventDefault: () => ev.preventDefault(),

                target: ev.target,
                pointerType: "touch",
                pointerId: touch.identifier,
                buttons: ev.type === "touchend" ? 0 : 1,
                pageX: touch.pageX,
                pageY: touch.pageY,
                clientX: touch.clientX,
                clientY: touch.clientY,
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top
            });

            // ignore for now
            break;
        }

        if (ev.type === "touchend") {
            this._pointeroutHandler.call(this, ev);
        }
    }

    private _pointerdownHandler(ev: PointerEvent) {

        if (ev.target !== this.overlay.canvas) {
            return;
        }
        ev.preventDefault();

        if (this._contextMenu && this._contextMenu.visible() === true) {
            this._contextMenu.close();
            this._contextMenu = null;
            return;
        }

        let offsetX = ev.offsetX;
        let offsetY = ev.offsetY;
        if (!offsetX && !offsetY && ev.target) {
            const rect = (<Element> ev.target).getBoundingClientRect();
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

        if (buttons === 2) {
            return;
        }

        this._lastPointerdown = [offsetX, offsetY];
        this._lastPointerType = ev.pointerType;
        this._lastPointerButtons = buttons;
        this._dragStartX = undefined;
    }

    private _pointerupHandler(ev: PointerEvent) {

        if (ev.target !== this.overlay.canvas) {
            return;
        }

        let offsetX = ev.offsetX;
        let offsetY = ev.offsetY;
        if (!offsetX && !offsetY) {
            const rect = (<Element> ev.target).getBoundingClientRect();
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
            }
        }

        this._lastPointerdown = [0, 0];
        this._lastPointerType = null;
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
            const rect = (<Element> ev.target).getBoundingClientRect();
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
            const maxIndex = this._getMaxIndex();
            this.barIndex = this._dragStartI - Math.round(deltaX / (this.options.barWidth + this.options.barMargin));
            if (this.barIndex < 0) {
                this.barIndex = 0;
            } else if (this.barIndex > maxIndex) {
                this.barIndex = maxIndex;
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

    private _wheelHandler(ev: MouseWheelEvent) {

        ev.preventDefault();

        if (ev.ctrlKey) {
            this.zoom(ev.deltaY < 0 ? 2 : ev.deltaY > 0 ? -2 : 0);
            return;
        }

        this.barIndex -= Math.round(ev.deltaX ? ev.deltaX : -(ev.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? ev.deltaY / 6 : ev.deltaY));
        const maxIndex = this._getMaxIndex();
        if (this.barIndex < 0) {
            this.barIndex = 0;
        } else if (this.barIndex > maxIndex) {
            this.barIndex = maxIndex;
        }

        this._hasUpdated = true;
    }

    private _drawBorder(ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, color: string, lineDash: number[]) {

        ctx.save();

        ctx.globalCompositeOperation = "destination-over";
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.setLineDash(lineDash);
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();

        ctx.restore();
    }

    private _drawVerticalRange(ctx: CanvasRenderingContext2D,
        x: number, y: number, h: number,
        color: string, lineDash: number[]) {

        x += 0.5;
        y = Math.round(y);
        h = Math.round(h);

        ctx.save();

        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.setLineDash(lineDash);
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x, y + h - 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 3, y + 4);
        ctx.lineTo(x - 3, y + 4);
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + 3, y + h - 4);
        ctx.lineTo(x - 3, y + h - 4);
        ctx.fill();

        ctx.restore();
    }

    private _drawPriceTag(ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, price: number,
        color: string, textColor: string, lineDash: number[],
        tagColor?: string, alpha?: number) {

        this._drawBorder(ctx, x, y + 0.5, w - 5, color, lineDash);

        w += x;

        ctx.save();

        ctx.globalAlpha = alpha || 1;
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
        ctx.font = "11px sans-serif";
        ctx.fillText(
            new Decimal(price).toFixed(this.options.decimalPower),
            w + 2,
            y + 5,
            39
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
        ctx.font = "11px sans-serif";
        ctx.fillText(
            new Decimal(price).toFixed(this.options.decimalPower),
            w + 2,
            y + 5,
            39
        );

        ctx.restore();
    }

    private _drawDepthIndicator(ctx: CanvasRenderingContext2D,
        x: number, y: number, value: string, color: string) {

        this._drawBorder(ctx, x, y + 0.5, -10, color, [2, 2]);

        ctx.save();

        ctx.textAlign = "right";
        ctx.fillStyle = this.color.textWeak;
        ctx.strokeStyle = this.color.bg;
        ctx.lineWidth = 2.5;
        ctx.font = "10px sans-serif";
        ctx.strokeText(
            value,
            x - 13,
            y + 3.5
        );
        ctx.fillText(
            value,
            x - 13,
            y + 3.5
        );

        ctx.restore();
    }

    private _drawPositionMarker(ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, position: _Position, ltp: number) {

        const color = position.side === "L" ? this.color.long : this.color.short;
        const margin = Math.floor(position.marginAgainst(ltp));

        this._drawPriceTag(
            ctx,
            x,
            y,
            w,
            position.price.toNumber(),
            color,
            "#ffffff",
            [1, 2]
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
        ctx.textAlign = "left";
        ctx.fillStyle = color;
        ctx.fillText(
            `${position.size} ${position.side}, ${util.toStringWithSign(margin)}`,
            x + 6,
            y - 5,
            76
        );

        ctx.restore();
    }

    private _drawOrderMarker(ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, order: _Order, ltp: number) {

        let color = this.color.text;
        switch (order.side) {
            case "L":
                color = this.color.long;
                break;
            case "S":
                color = this.color.short;
                break;
        }

        this._drawPriceTag(
            ctx,
            x,
            y,
            w,
            order.price.toNumber(),
            color,
            "#ffffff",
            [1, 5],
            null,
            0.45
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
        ctx.textAlign = "left";
        ctx.fillStyle = color;
        ctx.fillText(
            `${order.size} ${order.side} ${order.type}`,
            x + 6,
            y - 5,
            76
        );

        ctx.restore();
    }

    private _getMaxIndex() {
        if (this.timePeriod > TimeByMinutes.OneHour) {
            return Math.floor(this.charts[0].hBars.length * (TimeByMinutes.OneHour / this.timePeriod));
        } else if (this.timePeriod === TimeByMinutes.OneHour) {
            return this.charts[0].hBars.length - 1;
        } else if (this.timePeriod === TimeByMinutes.OneMinute) {
            return this.charts[0].bars.length - 1;
        } else {
            return Math.floor(this.charts[0].bars.length / this.timePeriod);
        }
    }

    private calculateHorizontalGridLowestPrice(chart, delta) {
        const m = findNiceValue(chart.highest, chart.lowest);

        return m - Math.ceil((m - chart.lowest) / delta) * delta;

        function findNiceValue(high, low) {
            const highStr = Math.floor(high).toString(10);
            const lowStr = Math.floor(low).toString(10);

            if (low < 0 || highStr.length !== lowStr.length) {
                const h = Number(highStr.charAt(0));
                let x;
                if (h >= 5) {
                    x = 5;
                } else if (h >= 2) {
                    x = 2;
                } else {
                    x = 1;
                }

                return x * Math.pow(10, highStr.length - 1);
            }

            const length = highStr.length;
            for (let i = 0; i < length; i++) {
                if (highStr.charAt(i) !== lowStr.charAt(i)) {
                    const topDigit = Number(highStr.substring(0, i - 1)) * 10;
                    const h = Number(highStr.charAt(i));
                    const l = Number(highStr.charAt(i));

                    let x;
                    if (l === 0) {
                        x = 0;
                    } else if (h >= 5 && l <= 5) {
                        x = 5;
                    } else if (l % 2 === 0) {
                        x = l;
                    } else if (h % 2 === 0) {
                        x = h;
                    } else {
                        x = Math.floor((h + l) / 2);
                    }

                    return (topDigit + x) * Math.pow(10, length - i - 1);
                }
            }

            return low;
        }
    }
}

if (window.Kuromaty === undefined) {
    (<any> window).Kuromaty = Kuromaty;
}

declare global {
    interface Window {
        // @ts-ignore
        Kuromaty: typeof Kuromaty;
    }
}

export default Kuromaty;
