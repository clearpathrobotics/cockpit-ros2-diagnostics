/*
 * This file is part of Cockpit ROS 2 Diagnostics.
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

import React, { useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";

import cockpit from 'cockpit';

const _ = cockpit.gettext;

export const Application = () => {
    const [namespace, setNamespace] = useState(_("default_namespace")); // Default namespace

    useEffect(() => {
        // Fetch the IP address of the Cockpit instance
        cockpit.transport.wait(() => {
            const hostIp = cockpit.transport.host;
            if (hostIp) {
                setUrl(`ws://${hostIp}:8765`); // Update WebSocket URL with the host IP
            } else {
                console.warn(_("Unable to determine the host IP address."));
            }
        });
    }, []);

    useEffect(() => {
        const yamlFile = cockpit.file('/etc/clearpath/robot.yaml');

        const updateNamespace = (content) => {
            if (content) {
                const trimmedContent = content.trim();

                // Filter out commented lines
                const uncommentedLines = trimmedContent
                        .split("\n")
                        .filter(line => !line.trim().startsWith("#"))
                        .join("\n");

                // Extract namespace or serial_number, ensuring serial_number has no leading white spaces
                const namespaceMatch = uncommentedLines.match(/^\s*namespace:\s*(\S+)/m);
                const serialNumberMatch = uncommentedLines.match(/^serial_number:\s*(\S+)/m); // No leading white spaces for serial_number
                if (namespaceMatch) {
                    setNamespace(namespaceMatch[1].replace(/^\/|\/$/g, "")); // Trim leading and trailing slashes
                } else if (serialNumberMatch) {
                    setNamespace(serialNumberMatch[1].replace(/-/g, "_").replace(/^\/|\/$/g, "")); // Replace dashes and trim slashes
                } else {
                    console.warn(_("Neither namespace nor serial_number found in robot.yaml"));
                }
            } else {
                console.warn(_("robot.yaml content is empty or null"));
            }
        };

        yamlFile.watch(updateNamespace);
        return yamlFile.close;
    }, []);

    return (
        <Card>
            <CardTitle>ROS 2 Diagnostics</CardTitle>
            <CardBody>
                <Alert
                    variant="info"
                    title={ cockpit.format(_("Namespace: $0"), namespace) }
                />
                <Alert
                    variant="info"
                    title={ cockpit.format(_("WebSocket URL: $0"), url) }
                />
            </CardBody>
        </Card>
    );
};
