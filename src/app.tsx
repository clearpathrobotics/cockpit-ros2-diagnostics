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

const DEFAULT_NAMESPACE = "default_namespace";

const sanitizeNamespace = (namespace: string): string => {
    const originalNamespace = namespace;

    let sanitizedNamespace = namespace
            .replace(/[^a-zA-Z0-9_/]/g, "") // Remove invalid characters
            .replace(/\/+/g, "/") // Replace consecutive slashes with a single slash
            .replace(/_+/g, "_") // Replace consecutive underscores with a single underscore
            .replace(/^\/|\/$/g, "") // Trim leading and trailing slashes
            .replace(/^\d+/, ""); // Drop leading numbers prior to the first letter or underscore

    // Add a leading slash only if the sanitized namespace is not blank
    if (sanitizedNamespace) {
        sanitizedNamespace = "/" + sanitizedNamespace;
    }

    if (originalNamespace.replace(/^\/|\/$/g, "") !== sanitizedNamespace.replace(/^\/|\/$/g, "")) {
        console.warn(`Invalid namespace: ${originalNamespace}, trying to use: ${sanitizedNamespace}`);
    }

    return sanitizedNamespace;
};

export const Application = () => {
    const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE); // Default namespace
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
                const namespaceMatch = uncommentedLines.match(/^[ \t]*namespace:[ \t]*(\S+)/ms);
                const serialNumberMatch = uncommentedLines.match(/^serial_number:[ \t]*(\S+)/ms); // No leading white spaces for serial_number
                if (namespaceMatch) {
                    setNamespace(sanitizeNamespace(namespaceMatch[1]));
                } else if (serialNumberMatch) {
                    setNamespace(sanitizeNamespace(serialNumberMatch[1]));
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
        if (namespace === DEFAULT_NAMESPACE || !url) {
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
                    title={ cockpit.format("Namespace: $0", namespace) }
                />
                <Alert
                    variant="info"
                    title={ cockpit.format("WebSocket URL: $0", url) }
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
