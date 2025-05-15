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

import {
    Alert,
    Icon,
    Page,
    PageSection,
    Stack,
    Title,
} from "@patternfly/react-core";
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    QuestionCircleIcon
} from "@patternfly/react-icons";

import cockpit from 'cockpit';
import * as ROSLIB from "./roslib/index";
import { DiagnosticsEntry } from "./interfaces";
import { DiagnosticsTable } from "./components/DiagnosticsTable";
import { DiagnosticsTreeTable } from "./components/DiagnosticsTreeTable";

const _ = cockpit.gettext;

const DEFAULT_NAMESPACE = "default_namespace";

// Ensure that the namespace is valid and is formatted correctly to be concatenated with the topic name
const sanitizeNamespace = (namespace: string): string => {
    let sanitizedNamespace = namespace
            .replace(/[^a-zA-Z0-9_/]/g, "") // Remove invalid characters
            .replace(/\/+/g, "/") // Replace consecutive slashes with a single slash
            .replace(/_+/g, "_") // Replace consecutive underscores with a single underscore
            .replace(/^\/|\/$/g, "") // Trim leading and trailing slashes
            .replace(/^\d+/, ""); // Drop leading numbers prior to the first letter or underscore

    // Add a leading slash if the sanitized namespace is not empty
    if (sanitizedNamespace) {
        sanitizedNamespace = "/" + sanitizedNamespace;
    }

    return sanitizedNamespace;
};

// Helper function to build a nested DiagnosticsEntry tree
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildDiagnosticsTree = (diagnostics: any[]): DiagnosticsEntry[] => {
    const root: DiagnosticsEntry[] = [];

    diagnostics.forEach(({ name, message, level, hardware_id, values }) => {
        const parts = name.split("/");
        let currentLevel = root;

        parts.forEach((part, index) => {
            if (!part) return; // Skip empty parts

            let existingEntry = currentLevel.find(entry => entry.name === part);

            if (!existingEntry) {
                const [baseName, suffix] = part.split(":");
                const path = parts.slice(0, index + 1).join("/")
                        .split(":")[0];
                existingEntry = {
                    name: index === parts.length - 1 && suffix ? suffix : baseName,
                    path,
                    rawName: path,
                    message: "",
                    severity_level: -1,
                    hardware_id: null,
                    values: null,
                    children: [],
                    icon: null, // Initialize icon as null
                };
                currentLevel.push(existingEntry);
            }

            if (index === parts.length - 1) {
                existingEntry.message = message || "";
                existingEntry.severity_level = level ?? -1;
                existingEntry.hardware_id = hardware_id || null;
                existingEntry.rawName = name;

                existingEntry.values = Array.isArray(values)
                    ? values.reduce((acc, { key, value }) => {
                        acc[key] = value;
                        return acc;
                    }, {})
                    : values && typeof values === "object"
                        ? Object.fromEntries(
                            Object.entries(values).map(([key, value]) => [key, value])
                        )
                        : {};

                // Populate the icon based on severity level
                existingEntry.icon = level === 3
                    ? <Icon status="info"><QuestionCircleIcon /></Icon>
                    : level === 2
                        ? <Icon status="danger"><ExclamationCircleIcon /></Icon>
                        : level === 1
                            ? <Icon status="warning"><ExclamationTriangleIcon /></Icon>
                            : <Icon status="success"><CheckCircleIcon /></Icon>;
            }

            currentLevel = existingEntry.children;
        });
    });

    return root;
};

export const Application = () => {
    const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE); // Default namespace
    const [url, setUrl] = useState<string | null>(null); // WebSocket URL
    const [diagnostics, setDiagnostics] = useState<DiagnosticsEntry[]>([]); // Diagnostics data
    const [invalidNamespaceMessage, setInvalidNamespaceMessage] = useState<string | null>(null); // Error message for invalid namespace
    const [bridgeConnected, setBridgeConnected] = useState(false);

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

    useEffect(() => {
        const yamlFile = cockpit.file('/etc/clearpath/robot.yaml');

        const updateNamespace = (content) => {
            if (content) {
                const trimmedContent = content.trim();
                let originalNamespace = "";
                let sanitizedNamespace = "";
                // Filter out commented lines
                const uncommentedLines = trimmedContent
                        .split("\n")
                        .filter(line => !line.trim().startsWith("#"))
                        .join("\n");

                // Extract namespace
                const namespaceMatch = uncommentedLines.match(/^[ \t]*namespace:[ \t]*(\S+)/ms);
                const serialNumberMatch = uncommentedLines.match(/^serial_number:[ \t]*(\S+)/ms);
                if (namespaceMatch) {
                    originalNamespace = namespaceMatch[1];
                    sanitizedNamespace = sanitizeNamespace(namespaceMatch[1]);
                    setNamespace(sanitizedNamespace);
                } else if (serialNumberMatch) {
                    originalNamespace = serialNumberMatch[1];
                    sanitizedNamespace = sanitizeNamespace(serialNumberMatch[1]);
                    setNamespace(sanitizedNamespace);
                } else {
                    console.warn(_("Configuration Error: Neither namespace nor serial_number found in robot.yaml"));
                    setInvalidNamespaceMessage(_("Configuration Error: Neither namespace nor serial_number found in robot.yaml"));
                    return;
                }

                // Check if the sanitized namespace differs from the original
                if (originalNamespace.replace(/^\/|\/$/g, "") !== sanitizedNamespace.replace(/^\/|\/$/g, "")) {
                    const message = `Invalid namespace: "${originalNamespace}", trying to connect using: "${sanitizedNamespace}"`;
                    console.warn(message);
                    setInvalidNamespaceMessage(message);
                } else {
                    setInvalidNamespaceMessage(null);
                }
            } else {
                const message = _("Configuration Error: 'robot.yaml' file not found or empty");
                console.warn(message);
                setInvalidNamespaceMessage(message);
            }
        };

        yamlFile.watch(updateNamespace);
        return yamlFile.close;
    }, []);

    useEffect(() => {
        if (namespace === DEFAULT_NAMESPACE) {
            console.warn("Namespace is not set correctly. Skipping WebSocket configuration.");
            return;
        }
        if (!url) {
            console.warn("WebSocket URL is not set correctly. Skipping WebSocket configuration.");
            return;
        }

        const retryDelay = 3000; // 3 seconds
        const timeoutDuration = 5000; // 5 seconds
        let timeoutId: NodeJS.Timeout | null = null;

        const connectToWebSocket = () => {
            const ros = new ROSLIB.Ros({ url });

            ros.on('connection', () => {
                console.log('Connected to Foxglove bridge at ' + url);
                setBridgeConnected(true);
            });

            ros.on('error', (error) => {
                console.error('Error connecting to Foxglove bridge:', error);
                console.log("Retrying WebSocket connection...");
                setBridgeConnected(false);
            });

            ros.on('close', () => {
                setBridgeConnected(false);
                console.log('Connection to Foxglove bridge closed');
                setDiagnostics([]);
                setTimeout(connectToWebSocket, retryDelay);
            });

            const diagnosticsTopic = new ROSLIB.Topic({
                ros,
                name: `${namespace}/diagnostics_agg`,
                messageType: "diagnostic_msgs/DiagnosticArray",
            });

            console.log(`Subscribing to topic: ${diagnosticsTopic.name}`);

            diagnosticsTopic.subscribe((message) => {
                // Clear the timeout on receiving a message
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Process incoming diagnostics messages
                if (Array.isArray(message.status)) {
                    const diagnosticsTree = buildDiagnosticsTree(message.status.map(({ name, message, level, hardware_id, values }) => ({
                        name,
                        message,
                        level: level !== undefined ? level : -1,
                        hardware_id,
                        values,
                    })));
                    setDiagnostics(diagnosticsTree);
                } else {
                    console.warn('Unexpected diagnostics data format:', message);
                }

                // Reset the timeout to clear diagnostics if no message is received
                timeoutId = setTimeout(() => {
                    console.warn("No diagnostics message received for 5 seconds. Clearing stale diagnostics.");
                    setDiagnostics([]);
                }, timeoutDuration);
            });

            return () => {
                diagnosticsTopic.unsubscribe();
                setBridgeConnected(false);
                ros.close();
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            };
        };

        connectToWebSocket();
    }, [namespace, url]);

    return (
        <Page id="ros2-diag" className='no-masthead-sidebar'>
            <PageSection>
                <Stack hasGutter>
                    <Title headingLevel="h1" size="2xl">
                        {_("ROS 2 Diagnostics")}
                    </Title>
                    {invalidNamespaceMessage && (
                        <Alert
                            variant="danger"
                            title={invalidNamespaceMessage} // Display error message if namespace is invalid
                        />
                    )}
                    { !invalidNamespaceMessage && (
                        <>
                            {diagnostics.length > 0 && (
                                <>
                                    <DiagnosticsTable diagnostics={diagnostics} variant="danger" />
                                    <DiagnosticsTable diagnostics={diagnostics} variant="warning" />
                                </>
                            )}
                            <DiagnosticsTreeTable diagnostics={diagnostics} bridgeConnected={bridgeConnected} />
                        </>
                    )}
                </Stack>
            </PageSection>
        </Page>
    );
};
