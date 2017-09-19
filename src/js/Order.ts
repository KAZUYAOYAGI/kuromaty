/*!
    Copyright 2017 Kuromatch
*/
"use strict";

import { Decimal } from "decimal.js-light";

export type Side = "L" | "S" | "L/S";

export interface OrderLike {
    time: number;
    price: number | string;
    origSize: number | string;
    size: number | string;
    side: Side;
    type: string;
}

export class Order {
    readonly time: number;
    readonly price: Decimal;
    readonly origSize: Decimal;
    readonly size: Decimal;
    readonly side: Side;
    readonly type: string;

    constructor(order: OrderLike) {
        this.time = order.time;
        this.price = new Decimal(order.price);
        this.origSize = new Decimal(order.origSize);
        this.size = new Decimal(order.size);
        this.side = order.side;
        this.type = order.type;
    }

    merge(order: Order) {
        
        if (!this.price.equals(order.price)) {
            throw new Error("Can not merge different price orders.");
        }

        if (this.side !== order.side) {
            // 両建て
            throw new Error("Double options is not supported.");
        }

        (<any>this).origSize = this.origSize.plus(order.origSize);
        (<any>this).size = this.size.plus(order.size);
    }
}

