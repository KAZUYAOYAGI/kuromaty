/*!
    Copyright 2017 Kuromatch
*/

"use strict";
import { Position, PositionLike } from "./Position";
import { Decimal } from "decimal.js-light";

export class PositionSet {
    private positions = {};
    private _size = 0;

    constructor(positions?: PositionLike[]) {
        if (positions) {
            positions.forEach(position => {
                this.add(new Position(position));
            })
        }
    }

    add(position: Position) {
        const key = position.price.toString();
        const existed = this.positions[key];

        if (existed) {
            existed.merge(position);
            return;
        }

        this.positions[key] = position;
        this._size++;
    }

    forEach(callbackFn) {
        const positions = this.positions;
        Object.keys(positions).forEach(key => callbackFn(positions[key], key));
    }

    marginAgainst(price: number) {
        let margin = 0;
        this.forEach(pos => {
            margin += pos.marginAgainst(price);
        });

        return margin;
    }

    isEmpty() {
        return this._size === 0;
    }
}
