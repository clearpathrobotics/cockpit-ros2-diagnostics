/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import cockpit from 'cockpit';

export function downloadFile(downloadPath: string) {
    const payload = JSON.stringify({
        payload: "fsread1",
        binary: "raw",
        path: `${downloadPath}`,
        superuser: "try",
        host: cockpit.transport.host,
        external: {
            "content-disposition": `attachment; filename="${downloadPath.split('/').pop()}"`,
            "content-type": "application/octet-stream",
        },
        // HACK: The Cockpit bridge has no way of saying "unlimited" until it supports passing -1
        // https://github.com/cockpit-project/cockpit/pull/21556
        max_read_size: Number.MAX_SAFE_INTEGER,
    });

    const encodedPayload = new TextEncoder().encode(payload);
    const query = window.btoa(String.fromCharCode(...encodedPayload));

    const prefix = (new URL(cockpit.transport.uri("channel/" + cockpit.transport.csrf_token))).pathname;
    window.open(`${prefix}?${query}`);
}
