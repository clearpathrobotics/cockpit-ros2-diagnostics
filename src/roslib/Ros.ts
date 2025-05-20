/*
 * This file is part of Cockpit ROS 2 Diagnostics but was originally sourced from
 * https://github.com/tier4/roslibjs-foxglove under the Apache License 2.0.
 *
 * Modifications made by Hilary Luo 2025.
 *
 * Copyright (C) 2025 Clearpath Robotics, Inc., a Rockwell Automation Company. All rights reserved.
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

import type EventEmitter from 'eventemitter3';

import { type EventTypes, Impl } from './Impl';

export class Ros {
    #rosImpl: Impl | undefined;

    constructor(readonly options: { readonly url?: string }) {
        if (options.url) {
            this.connect(options.url);
        }
    }

    /** @internal */
    get rosImpl() {
        return this.#rosImpl;
    }

    on<T extends EventEmitter.EventNames<EventTypes>>(
        event: T,
        fn: EventEmitter.EventListener<EventTypes, T>,
    ): this {
        this.rosImpl?.emitter.on(event, fn);
        return this;
    }

    off<T extends EventEmitter.EventNames<EventTypes>>(
        event: T,
        fn: EventEmitter.EventListener<EventTypes, T>,
    ): this {
        this.rosImpl?.emitter.off(event, fn);
        return this;
    }

    connect(url: string) {
        this.#rosImpl = new Impl(url);
    }

    close() {
        this.rosImpl?.close();
        this.#rosImpl = undefined;
    }

    getTopics(
        callback: (result: { topics: string[]; types: string[] }) => void,
        failedCallback?: (error: string) => void,
    ) {
        const topics = this.rosImpl?.getTopics();
        if (topics) {
            callback(topics);
        } else if (failedCallback) {
            failedCallback('Error: getTopics');
        }
    }

    getServices(
        callback: (services: string[]) => void,
        failedCallback?: (error: string) => void,
    ) {
        this.rosImpl?.getServices().then(callback)
                .catch(failedCallback);
    }

    getTopicType(
        topic: string,
        callback: (type: string) => void,
        failedCallback?: (error: string) => void,
    ) {
        const topicType = this.rosImpl?.getTopicType(topic);
        if (topicType) {
            callback(topicType);
        } else if (failedCallback) {
            failedCallback('Error: getTopicType');
        }
    }

    getServiceType(
        service: string,
        callback: (type: string) => void,
        failedCallback?: (error: string) => void,
    ) {
        const serviceType = this.rosImpl?.getServiceType(service);
        if (serviceType) {
            callback(serviceType);
        } else if (failedCallback) {
            failedCallback('Error: getServiceType');
        }
    }
}
