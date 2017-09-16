/*!
    Copyright 2017 Kuromatch
*/
"use strict";

import { Order, OrderLike } from "./Order";

export class OrderSet {
    private orders: { [priceKey: string]: Order } = {};
    private _length = 0;

    constructor(orders?: OrderLike[]) {
        if (orders) {
            orders.forEach(position => {
                this.add(new Order(position));
            })
        }
    }

    add(position: Order) {

        const key = position.price.toString();
        const existed = this.orders[key];

        if (existed) {
            existed.merge(position);
            return;
        }

        this.orders[key] = position;
        this._length++;
    }

    forEach(callbackFn) {
        const orders = this.orders;
        Object.keys(orders).forEach(key => callbackFn(orders[key], key));
    }

    isEmpty() {
        return this._length === 0;
    }
}
