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

import * as ROSLIB from "./roslib/index";

const _ = cockpit.gettext;

export const Application = () => {
    const [namespace, setNamespace] = useState(_("default_namespace")); // Default namespace
    const [url, setUrl] = useState<string>("");
    const [diagnostics, setDiagnostics] = useState([]);

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

    useEffect(() => {
        if (namespace === _("default_namespace") || !url) {
            console.warn("Namespace or URL is not set. Skipping WebSocket configuration.");
            return;
        }

        const ros = new ROSLIB.Ros({ url });

        ros.on('connection', () => {
            console.log('Connected to Foxglove bridge');
        });

        ros.on('error', (error) => {
            console.error('Error connecting to Foxglove bridge:', error);
        });

        ros.on('close', () => {
            console.log('Connection to Foxglove bridge closed');
        });

        const diagnosticsTopic = new ROSLIB.Topic({
            ros,
            name: `/${namespace}/diagnostics_agg`,
            messageType: "diagnostic_msgs/DiagnosticArray",
        });

        diagnosticsTopic.subscribe((message) => {
            if (Array.isArray(message.status)) {
                const formattedDiagnostics = message.status.map(({ name = 'N/A', message = 'N/A', level }) => ({
                    name,
                    message,
                    level: level !== undefined ? level.toString() : 'N/A'
                }));
                setDiagnostics(formattedDiagnostics);
            } else {
                console.warn('Unexpected diagnostics data format:', message);
            }
        });

        return () => {
            diagnosticsTopic.unsubscribe();
            ros.close();
        };
    }, [namespace, url]); // Re-run effect when namespace or url changes

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
                <textarea
                    readOnly
                    value={diagnostics.map(d => `Name: ${d.name}, Message: ${d.message}, Level: ${d.level}`).join("\n")}
                    style={{ width: "100%", height: "200px", marginTop: "1rem" }}
                />
            </CardBody>
        </Card>
    );
};
