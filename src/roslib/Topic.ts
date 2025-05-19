/*
 * This file is part of Cockpit ROS 2 Diagnostics but was originally sourced from
 * https://github.com/tier4/roslibjs-foxglove under the Apache License 2.0.
 *
 * Modifications made by Hilary Luo 2025.
 *
 * Copyright (C) 2025 Clearpath Robotics, Inc., a Rockwell Automation Company.
 *
 * Cockpit ROS 2 Diagnostics is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit ROS 2 Diagnostics is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import type { Publisher, Subscription } from './Impl';
import type { Ros } from './Ros';

export class Message {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    constructor(readonly values: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        Object.assign(this, values);
    }
}

export class Topic<TMessage = Message> {
    readonly #ros: Ros;
    readonly #name: string;
    readonly #messageType: string;

    #publisher?: Promise<Publisher<TMessage>>;
    #subscriptions = new Map<(message: TMessage) => void, Subscription>();

    constructor(
    readonly options: {
      readonly ros: Ros;
      readonly name: string;
      readonly messageType: string;
    },
    ) {
        this.#ros = options.ros;
        this.#name = options.name;
        this.#messageType = options.messageType;
    }

    get name() {
        return this.#name;
    }

    get messageType() {
        return this.#messageType;
    }

    publish(message: TMessage) {
        if (!this.#publisher) {
            this.advertise();
        }
        this.#publisher?.then((publisher) => {
            publisher.publish(message);
        });
    }

    subscribe(callback: (message: TMessage) => void) {
        this.#ros.rosImpl
                ?.createSubscription(this.name, callback)
                .then((subscription) => {
                    this.#subscriptions.set(callback, subscription);
                });
    }

    unsubscribe(callback?: (message: TMessage) => void) {
        if (callback) {
            this.#subscriptions.get(callback)?.unsubscribe();
            this.#subscriptions.delete(callback);
        } else {
            for (const subscription of this.#subscriptions.values()) {
                subscription.unsubscribe();
            }
            this.#subscriptions.clear();
        }
    }

    advertise() {
        this.#publisher = this.#ros.rosImpl?.createPublisher(
            this.name,
            this.messageType,
        );
    }

    unadvertise() {
        this.#publisher?.then((publisher) => {
            publisher.unadvertise();
            this.#publisher = undefined;
        });
    }
}
