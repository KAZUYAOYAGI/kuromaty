(function ($) {
    var queries = (function () {
        var s = location.search.replace("?", ""),
            query = {},
            queries = s.split("&"),
            i = 0;

        if (!s) return null;

        for (i; i < queries.length; i++) {
            var t = queries[i].split("=");
            query[t[0]] = t[1];
        }
        return query;
    })();

    $.queryParameter = function (key) {
        return (queries == null ? null : queries[key] ? queries[key] : null);
    };
})(jQuery);

(function () {
    "use strict";

    function save(key, value) {
        localStorage.setItem(location.href + "." + key, value);
    }
    function load(key) {
        return localStorage.getItem(location.href + "." + key);
    }

    document.ontouchmove = function (e) { e.preventDefault(); }
    localStorage.setItem(location.href + ".isLocal", "true");

    var symbols = ($.queryParameter("symbols") || "FX_BTC_JPY,BTC_JPY").split(",");

    var kuro = window.kuro = {
        apiRoot: "/api/",
        socket: io("https://kuromat.ch", {
            transports: ["websocket"]
        }),
        pubnub: null,
        kuromaty: null,
        options: {
            theme: "dark",
            板表示: true
        },
        stat: {
            ver: "",
            lastLTP: 0,
            board: {
                asks: [],
                bids: []
            },
            pinnedPricesJSON: ""
        },
        element: {
            ver: $("#ver"),
            conn: $("#conn"),
            header: $("#header"),
            footer: $("#footer"),
            title: $("#title"),
            period: $("#period"),
            periodItems: $("#period-items"),
            timestamp: $("#timestamp"),
            zoomin: $("#zoomin"),
            zoomout: $("#zoomout"),
            loading: $("#loading"),
            dot: $("#dot"),
            kuromaty: document.getElementById("kuromaty")
        },
        map: {}
    };

    var silentReload = function () {
        
        if (kuro.element.dot.hasClass("loading")) {
            setTimeout(silentReload, 3000);
            return;
        }

        location.reload();
    };

    kuro.socket.on("ver", function (ver) {
        if (kuro.stat.ver !== "" && kuro.stat.ver !== ver) {
            setTimeout(function () {
                silentReload();
            }, 7000);
        }
        kuro.stat.ver = ver;
        kuro.element.ver.text(kuro.stat.ver);
        kuro.element.loading.hide();
    });
    kuro.socket.on("stat", function (stat) {
        kuro.element.conn.text(stat.conn);
        kuro.element.dot.removeClass("loading");
    });
    kuro.socket.on("disconnect", function () {
        //kuro.element.loading.show();
        kuro.element.conn.text("*");
        kuro.element.dot.addClass("loading");
    });

    var dummyTickerTimeout;

    kuro.socket.on("ticker", function (ticker) {

        var index = symbols.indexOf(ticker.symbol);
        var len = kuromaty.charts[index]._bars && kuromaty.charts[index]._bars.length || 0;

        if (index !== null) {
            kuromaty.charts[index].askPrice = ticker.best_ask || 0;
            kuromaty.charts[index].bidPrice = ticker.best_bid || 0;

            kuromaty.tick(index, [
                new Date(ticker.timestamp).getTime(),
                ticker.ltp,
                ticker.volume,
                ticker.ask_depth,
                ticker.bid_depth,
                ticker.volume_sell,
                ticker.volume_buy
            ]);
        }

        if (index === 0) {
            kuro.stat.lastLTP = ticker.ltp;
        }

        var timestamp = new Date(ticker.timestamp);
        kuro.element.timestamp.text(
            timestamp.getHours() + ":" +
            ("0" + timestamp.getMinutes()).slice(-2) + ":" +
            ("0" + timestamp.getSeconds()).slice(-2)
        );
    });

    var decimalPower = 0;
    if (symbols[0] === "ETH_BTC") {
        decimalPower = 5;
    } else if (symbols[0] === "BCH_BTC") {
        decimalPower = 5;
    } else if (symbols[0] === "BFX_BTC_USD") {
        decimalPower = 1;
    }

    var kuromaty = kuro.kuromaty = new Kuromaty(kuro.element.kuromaty, {
        decimalPower: decimalPower,
        // 複数チャート
        chartCount: Math.min(2, symbols.length),
        chartTitles: symbols,
        chartOverlay: true,
        boardGroupSize: 100,
        pricePopEffect: true
    });

    kuromaty.timePeriod = parseInt(load("timePeriod") || "1", 10);

    kuromaty.setColor({
        bg: "#12151b",
        text: "#bbbbbb",
        textWeak: "#999999",
        textStrong: "#eeeeee",
        grid: "#20202a",
        border: "#2f2f36",
        bidOrder: "#5aff00",
        askDepth: "rgba(210,179,189,0.15)",
        bidDepth: "rgba(201,210,179,0.15)",
        askDepthLast: "rgba(210,179,189,0.28)",
        bidDepthLast: "rgba(201,210,179,0.28)",
        volume: "#c379a2",
        lineMA1: "#676330",
        lineMA2: "#48758e",
        lineMA3: "#67305a"
    });

    kuromaty.overlays = {
        EMA1: new Kuromaty.overlays.EMA({ period: 5, colorKey: "lineMA1" }),
        // EMA2: new Kuromaty.overlays.EMA({ period: 21, colorKey: "lineMA2" }),
        EMA3: new Kuromaty.overlays.EMA({ period: 100, backCount: 100, colorKey: "lineMA3" }),
        BollingerBand: new Kuromaty.overlays.BollingerBand(),
        ParabolicSAR: new Kuromaty.overlays.ParabolicSAR(),
        Chandelier: new Kuromaty.overlays.ChandelierExit(),
    };

    document.body.style.background = kuromaty.color.bg;

    // リサイズハンドラ
    window.addEventListener("resize", function () {
        kuromaty.resize();
    });

    // タイトル (v2.29)
    var titleTable = {
        FX_BTC_JPY: "bitFlyer BTC-FX/JPY",
        BTC_JPY: "bitFlyer BTC/JPY",
        ETH_BTC: "bitFlyer ETH/BTC",
        BCH_BTC: "bitFlyer BCH/BTC"
    };
    var title = titleTable[symbols[0]] || symbols[0];
    kuro.element.title.text(title);
    kuro.element.title.on("pointerdown", function () {
        window.open(location.href, "_blank");
    });

    // 足 (v2.26, v2.29)
    [0, 1, 3, 5, 10, 15, 30, 60, 120, 240, 360, 720, 1440].forEach(function (period) {

        var btn = $("<div class='item'></div>");
        
        if (period === 0) {
            btn.text("Tick");
        } else if (period >= 1440) {
            btn.text((period / 1440) + "日");
        } else if (period >= 60) {
            btn.text((period / 60) + "時間");
        } else {
            btn.text(period + "分");
        }

        if (period === kuromaty.timePeriod) {
            kuro.element.period.text(btn[0].innerHTML + " ▼");
            btn.addClass("selected");
        }

        btn.on("pointerdown", function () {

            kuro.element.period.text(btn[0].innerHTML + " ▼");

            kuro.element.periodItems.children().each(function () {
                $(this).removeClass("selected");
            });
            btn.addClass("selected");

            kuromaty.timePeriod = period;
            kuromaty.barIndex = 0;
            kuromaty._hasUpdated = true;
        });

        kuro.element.periodItems.append(btn);
    });

    // ズーム (v2.30)
    kuro.element.zoomout.on("pointerdown", function () {
        kuromaty.zoom(-2);
    });
    kuro.element.zoomin.on("pointerdown", function () {
        kuromaty.zoom(2);
    });

    // Extra OHLC (v2.27)
    var getExtras = function (index, symbol, period) {

        if (
            kuromaty.timePeriod < 60 && period === "h" ||
            kuromaty.timePeriod >= 60 && period === "m" && kuromaty.charts[index].bars.length !== 0
        ) {
            setTimeout(getExtras, 250, index, symbol, period);
            return;
        }

        if (kuromaty.hasDepleted === true) {
            var bars = period === "m" ? kuromaty.charts[index].bars : kuromaty.charts[index].hBars;
            var before = Date.now();
            if (bars[bars.length - 1]) {
                before = bars[bars.length - 1][0];
                if (period === "m") {
                    before -= 1000 * 60;
                } else if (period === "h") {
                    before -= 1000 * 60 * 60 * 1;
                }
            }
            $.ajax(
                kuro.apiRoot +
                "ohlc?symbol=" + symbol +
                "&before=" + before +
                "&period=" + period
            ).done(function (ohlc) {

                if (period === "m") {
                    kuromaty.update(index, bars.concat(ohlc));
                } else if (period === "h") {
                    kuromaty.updateHBars(index, bars.concat(ohlc));
                }

                if (ohlc.length === 0) {
                    // not enough data
                    return;
                } else if (before !== ohlc[ohlc.length - 1][0]) {
                    setTimeout(getExtras, 100, index, symbol, period);
                }
            });
        } else {
            setTimeout(getExtras, 500, index, symbol, period);
        }
    };
    symbols.forEach(function (symbol) {
        setTimeout(getExtras, 500, symbols.indexOf(symbol), symbol, "m");
        setTimeout(getExtras, 500, symbols.indexOf(symbol), symbol, "h");
    });

    // データ要求
    kuro.socket.on("ready", function () {
        symbols.forEach(function (symbol) {
            kuro.socket.emit("join", symbol);
        });
    });

    // 価格マーカーリストア
    if (load("pinnedPrices")) {
        kuro.stat.pinnedPricesJSON = load("pinnedPrices");
        kuromaty.pinnedPrices = JSON.parse(kuro.stat.pinnedPricesJSON);
    }

    // ステート保存
    window.onbeforeunload = function () {
        save("timePeriod", kuromaty.timePeriod.toString(10));
        save("pinnedPrices", JSON.stringify(kuromaty.pinnedPrices));
    };

    // ステート同期
    var stateSyncing = function () {
        
        var _pinnedPricesJSON = JSON.stringify(kuromaty.pinnedPrices);
        if (kuro.stat.pinnedPricesJSON !== _pinnedPricesJSON) {
            kuro.stat.pinnedPricesJSON = _pinnedPricesJSON;
            save("pinnedPrices", _pinnedPricesJSON);
        } else {
            kuro.stat.pinnedPricesJSON = load("pinnedPrices");
            kuromaty.pinnedPrices = JSON.parse(kuro.stat.pinnedPricesJSON);
        }

        setTimeout(stateSyncing, 3000);
    };
    setTimeout(stateSyncing, 3000);

    // ポジション (テスト中)
    if (/Chrome/.test(navigator.userAgent) === true) {
        window.addEventListener("message", function (event) {
            var message = JSON.parse(event.data);
            if (message.kind === "positions") {
                kuromaty.setPositions(message.body);
            } else if (message.kind === "orders") {
                kuromaty.setOrders(message.body);
            }
        }, false);

        window.postMessage('{"kind":"positions","body":[{"time":1505831495637,"side":"S","price":"445000","size":"0.001","margin":45},{"time":1505836555637,"side":"S","price":"449000","size":"0.01","margin":449}]}', "*");
        window.postMessage('{"kind":"orders","body":[{"time":1505836364633,"type":"指値","side":"S","price":"449000","origSize":"0.01","size":"0.01"},{"time":1505831416633,"type":"IFD","side":"L/S","price":"445000","origSize":"0.002","size":"0.001"},{"time":1505831348633,"type":"IFD","side":"L/S","price":"442141","origSize":"0.002","size":"0.002"}]}', "*");
    }

    // 注文 (テスト中)
    if (/Chrome/.test(navigator.userAgent) === true) {
        kuromaty.options.quickOrder = true;
        kuromaty.options.quickOrderHandler = function (order) {

            console.log("quickOrderHandler", order);

            window.parent.postMessage(JSON.stringify({
                kind: "order",
                body: order
            }), "*");
        };
    }

    // 板情報 (テスト中)
    if (kuro.options["板表示"]) {
        kuro.stat.boardUpdated = false;
        kuro.pubnubBoard = new PUBNUB.ws("wss://pubsub.pubnub.com//sub-c-52a9ab50-291b-11e5-baaa-0619f8945a4f/lightning_board_" + symbols[0]);
        kuro.pubnubBoard.onmessage = function (evt) {

            var book = evt.data;

            var i, j, price, size, find;
            for (i = 0; i < book.asks.length; i++) {
                price = book.asks[i].price;
                size = book.asks[i].size;
                find = false;
                for (j = 0; j < kuro.stat.board.asks.length; j++) {
                    if (kuro.stat.board.asks[j].price === price) {
                        find = true;
                        if (size === 0) {
                            kuro.stat.board.asks.splice(j, 1);
                            break;
                        }
                        kuro.stat.board.asks[j].size = size;
                        break;
                    }
                }
                if (find === false && size !== 0) {
                    kuro.stat.board.asks.push({
                        price: price,
                        size: size
                    });
                }
            }
            for (i = 0; i < book.bids.length; i++) {
                price = book.bids[i].price;
                size = book.bids[i].size;
                find = false;
                for (j = 0; j < kuro.stat.board.bids.length; j++) {
                    if (kuro.stat.board.bids[j].price === price) {
                        find = true;
                        if (size === 0) {
                            kuro.stat.board.bids.splice(j, 1);
                            break;
                        }
                        kuro.stat.board.bids[j].size = size;
                        break;
                    }
                }
                if (find === false && size !== 0) {
                    kuro.stat.board.bids.push({
                        price: price,
                        size: size
                    });
                }
            }

            kuro.stat.board.asks.sort(function (a, b) {
                return a.price - b.price;
            });
            kuro.stat.board.bids.sort(function (a, b) {
                return b.price - a.price;
            });

            kuro.stat.boardUpdated = true;

            if (kuro.stat.connected === false) {
                if (kuro.stat.board.asks[0]) {
                    kuromaty.charts[0].askPrice = kuro.stat.board.asks[0].price;
                }
                if (kuro.stat.board.bids[0]) {
                    kuromaty.charts[0].bidPrice = kuro.stat.board.bids[0].price;
                }
            }
        };

        var boardUpdater = function () {

            if (kuro.stat.boardUpdated) {
                kuro.stat.boardUpdated = false;
                kuromaty.updateBoard(0, kuro.stat.board);
            }

            setTimeout(boardUpdater, 500);
        };
        setTimeout(boardUpdater, 1000);
    }

} ());
