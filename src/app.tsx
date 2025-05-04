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

import cockpit from 'cockpit';
import React, { useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { ExclamationCircleIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@patternfly/react-icons";

import * as ROSLIB from "./roslib/index";

const _ = cockpit.gettext;

const DEFAULT_NAMESPACE = "default_namespace";

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

// Renders a table of diagnostic messages filtered by severity level
const DiagnosticsTable = ({ diagnostics, variant }: { diagnostics: any[], variant: "danger" | "warning" }) => {
    const levelFilter = variant === "danger"
        ? (level: number) => level >= 2 // Errors: level >= 2
        : (level: number) => level === 1; // Warnings: level == 1
    const Icon = variant === "danger" ? ExclamationCircleIcon : ExclamationTriangleIcon;
    const iconColor = variant === "danger"
        ? "var(--pf-t--global--icon--color--status--danger--default)"
        : "var(--pf-t--global--icon--color--status--warning--default)";

    // Create a Set of all parent paths to exclude them from the table
    const parentPaths = new Set(
        diagnostics
                .map((d) => d.name)
                .filter((name) => name.includes("/"))
                .map((name) => name.substring(0, name.lastIndexOf("/")))
    );

    // Filter diagnostics based on the severity level and exclude parent paths
    const filteredDiagnostics = diagnostics
            .filter((d) => levelFilter(parseInt(d.level, 10))) // Filter by level
            .filter((d) => !parentPaths.has(d.name)); // Exclude diagnostics that are parent paths

    return (
        <Alert
            variant={variant}
            title={variant === "danger" ? _("Errors") : _("Warnings")}
            isInline
        >
            <Table aria-label={`${variant === "danger" ? "Errors" : "Warnings"} Table`} borders={false} variant="compact">
                <Thead>
                    <Tr>
                        <Th>Name</Th>
                        <Th>Message</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {filteredDiagnostics.map((d, index) => {
                        // Extract the path and name from the diagnostic name
                        const [path, name] = (() => {
                            const colonIndex = d.name.indexOf(":");
                            if (colonIndex !== -1) {
                                return [
                                    d.name.substring(0, colonIndex),
                                    d.name.substring(colonIndex + 1).trim() || d.name,
                                ];
                            }
                            const lastSlashIndex = d.name.lastIndexOf("/");
                            return [
                                d.name,
                                d.name.substring(lastSlashIndex + 1) || d.name,
                            ];
                        })();

                        return (
                            <Tr key={index}>
                                <Td>
                                    <div style={{ fontWeight: "bold" }}>
                                        {React.createElement(Icon, { style: { color: iconColor, marginRight: "0.5rem" } })}
                                        {name || "N/A"}
                                    </div>
                                    <div>{path || "N/A"}</div>
                                </Td>
                                <Td>{d.message || "N/A"}</Td>
                            </Tr>
                        );
                    })}
                </Tbody>
            </Table>
        </Alert>
    );
};

export const Application = () => {
    const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE); // Default namespace
    const [url, setUrl] = useState<string | null>(null); // WebSocket URL
    const [diagnostics, setDiagnostics] = useState([]); // Diagnostics data
    const [invalidNamespaceMessage, setInvalidNamespaceMessage] = useState<string | null>(null); // Error message for invalid namespace

    useEffect(() => {
        // Fetch the IP address of the Cockpit instance and set the WebSocket URL
        cockpit.transport.wait(() => {
            const hostIp = cockpit.transport.host;
            if (hostIp) {
                setUrl(`ws://${hostIp}:8765`); // Construct WebSocket URL using the host IP
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
                    console.warn(_("Neither namespace nor serial_number found in robot.yaml"));
                    setInvalidNamespaceMessage(_("Neither namespace nor serial_number found in robot.yaml"));
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
                const message = _("robot.yaml content is empty or null");
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

        const ros = new ROSLIB.Ros({ url }); // Initialize ROS connection

        ros.on('connection', () => {
            console.log('Connected to Foxglove bridge at ' + url);
        });

        ros.on('error', (error) => {
            console.error('Error connecting to Foxglove bridge:', error);
        });

        ros.on('close', () => {
            console.log('Connection to Foxglove bridge closed');
        });

        const diagnosticsTopic = new ROSLIB.Topic({
            ros,
            name: `${namespace}/diagnostics_agg`,
            messageType: "diagnostic_msgs/DiagnosticArray",
        });

        console.log(`Subscribing to topic: ${diagnosticsTopic.name}`);

        diagnosticsTopic.subscribe((message) => {
            // Process incoming diagnostics messages
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
    }, [namespace, url]); // Re-run effect when namespace or URL changes

    return (
        <Page id="ros2-diag" className='no-masthead-sidebar'>
            <PageSection>
                <Stack hasGutter>
                    <Card>
                        <CardTitle>{_("ROS 2 Diagnostics")}</CardTitle>
                        <CardBody>
                            {invalidNamespaceMessage && (
                                <Alert
                                    variant="danger"
                                    title={invalidNamespaceMessage} // Display error message if namespace is invalid
                                />
                            )}
                            <Alert
                                variant="info"
                                title={cockpit.format("Namespace: $0", namespace)}
                            />
                            <Alert
                                variant="info"
                                title={cockpit.format("WebSocket URL: $0", url)}
                            />
                        </CardBody>
                    </Card>
                    <DiagnosticsTable diagnostics={diagnostics} variant="danger" />
                    <DiagnosticsTable diagnostics={diagnostics} variant="warning" />
                </Stack>
            </PageSection>
        </Page>
    );
};
