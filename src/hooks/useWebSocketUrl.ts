/*
 * This file is part of Cockpit ROS 2 Diagnostics.
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

import { useEffect, useState } from "react";

import cockpit from "cockpit";

const _ = cockpit.gettext;

export const useWebSocketUrl = (): string | null => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        // Fetch the IP address or hostname of the Cockpit instance and set the WebSocket URL
        cockpit.transport.wait(() => {
            try {
                const url = new URL(cockpit.transport.origin);
                const hostIp = url.hostname; // Extract the hostname or IP from the origin
                if (hostIp) {
                    setUrl(`ws://${hostIp}:8765`); // Construct WebSocket URL using the host IP
                } else {
                    console.warn(_("Unable to determine the host IP address."));
                }
            } catch (error) {
                console.error(_("Failed to parse Cockpit origin URL:"), error);
            }
        });
    }, []);

    return url;
};
