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
import { Alert, Icon, Title } from "@patternfly/react-core";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Table, Thead, Tr, Th, Tbody, Td, TreeRowWrapper, TdProps } from "@patternfly/react-table";
import { ExclamationCircleIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@patternfly/react-icons";

import * as ROSLIB from "./roslib/index";

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

interface DiagnosticsEntry {
    name: string;
    path: string;
    message: string;
    severity_level: number;
    hardware_id: string | null;
    values: { [key: string]: any } | null;
    children: DiagnosticsEntry[];
}

// Helper function to build a nested DiagnosticsEntry tree
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
                existingEntry = {
                    name: index === parts.length - 1 && suffix ? suffix : baseName,
                    path: parts.slice(0, index + 1).join("/")
                            .split(":")[0],
                    message: "",
                    severity_level: -1,
                    hardware_id: null,
                    values: null,
                    children: [],
                };
                currentLevel.push(existingEntry);
            }

            if (index === parts.length - 1) {
                existingEntry.message = message || "";
                existingEntry.severity_level = level ?? -1;
                existingEntry.hardware_id = hardware_id || null;
                existingEntry.values = values || null;
            }

            currentLevel = existingEntry.children;
        });
    });

    return root;
};

// Helper function to collect leaf nodes
const collectLeafNodes = (entries: DiagnosticsEntry[]): DiagnosticsEntry[] =>
    entries.flatMap(entry =>
        entry.children.length === 0 ? [entry] : collectLeafNodes(entry.children)
    );

// Renders a table of diagnostic messages filtered by severity level
const DiagnosticsTable = ({ diagnostics, variant }: { diagnostics: DiagnosticsEntry[], variant: "danger" | "warning" }) => {
    const levelFilter = (level: number) =>
        variant === "danger" ? level >= 2 : level === 1; // Errors: level >= 2, Warnings: level == 1

    const icon = variant === "danger"
        ? <Icon status="danger"><ExclamationCircleIcon /></Icon>
        : <Icon status="warning"><ExclamationTriangleIcon /></Icon>;

    const filteredDiagnostics = collectLeafNodes(diagnostics).filter(d => levelFilter(d.severity_level));

    return (
        <Alert
            variant={variant}
            title={variant === "danger" ? _("Errors") : _("Warnings")}
            isInline
        >
            <Table aria-label={`${variant === "danger" ? "Errors" : "Warnings"} Table`} borders={false} variant="compact">
                <Thead>
                    <Tr>
                        <Th>{_("Name")}</Th>
                        <Th>{_("Message")}</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {filteredDiagnostics.map((d, index) => (
                        <Tr key={index}>
                            <Td>
                                <Title headingLevel="h5" size="sm">
                                    {icon} <span style={{ marginLeft: "0.5rem" }}>{d.name || _("N/A")}</span>
                                </Title>
                                {d.path || _("N/A")}
                            </Td>
                            <Td>{d.message || _("N/A")}</Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </Alert>
    );
};

// Renders an expandable TreeTable of diagnostic messages
const DiagnosticsTreeTable = ({ diagnostics }: { diagnostics: DiagnosticsEntry[] }) => {
    // By default have the first row expanded
    const [expandedRows, setExpandedRows] = useState<string[]>([diagnostics[0]?.name]);

    if (diagnostics.length === 0) {
        return (
            <Card>
                <CardTitle>{_("ROS 2 Diagnostics")}</CardTitle>
                <CardBody>
                    <Alert variant="warning" isPlain isInline title={_("No diagnostics available")}>
                        {_("Attempting to connect to the diagnostics topic...")}
                    </Alert>
                </CardBody>
            </Card>
        );
    }

    const columnNames = {
        name: _("Name"),
        path: _("Path"),
        message: _("Message"),
    };

    const renderRows = (
        [diag, ...remainingDiag]: DiagnosticsEntry[],
        indentLevel = 1,
        posinset = 1,
        rowIndex = 0,
        isHidden = false
    ): React.ReactNode[] => {
        if (!diag) return [];

        const isExpanded = expandedRows.includes(diag.name);
        const icon = diag.severity_level === 0
            ? <Icon status="success"><CheckCircleIcon /></Icon>
            : diag.severity_level === 1
                ? <Icon status="warning"><ExclamationTriangleIcon /></Icon>
                : <Icon status="danger"><ExclamationCircleIcon /></Icon>;

        const treeRow: TdProps["treeRow"] = {
            onCollapse: () =>
                setExpandedRows(prevExpanded =>
                    prevExpanded.includes(diag.name)
                        ? prevExpanded.filter(name => name !== diag.name)
                        : [...prevExpanded, diag.name]
                ),
            rowIndex,
            props: {
                isExpanded,
                isHidden,
                "aria-level": indentLevel,
                "aria-posinset": posinset,
                "aria-setsize": diag.children.length,
                icon,
            },
        };

        const childRows = diag.children.length
            ? renderRows(diag.children, indentLevel + 1, 1, rowIndex + 1, !isExpanded || isHidden)
            : [];

        return [
            <TreeRowWrapper key={diag.name} row={{ props: treeRow.props }}>
                <Td dataLabel={columnNames.name} treeRow={treeRow}>
                    <Title headingLevel="h5" size="sm">{diag.name}</Title>
                    {diag.path}
                </Td>
                <Td dataLabel={columnNames.message}>{diag.message}</Td>
            </TreeRowWrapper>,
            ...childRows,
            ...renderRows(remainingDiag, indentLevel, posinset + 1, rowIndex + 1 + childRows.length, isHidden),
        ];
    };

    return (
        <Card>
            <CardTitle>{_("ROS 2 Diagnostics")}</CardTitle>
            <CardBody>
                <Table isTreeTable variant="compact" aria-label={_("Diagnostics Tree Table")} borders={false}>
                    <Thead>
                        <Tr>
                            <Th>{columnNames.name}</Th>
                            <Th>{columnNames.message}</Th>
                        </Tr>
                    </Thead>
                    <Tbody>{renderRows(diagnostics)}</Tbody>
                </Table>
            </CardBody>
        </Card>
    );
};

export const Application = () => {
    const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE); // Default namespace
    const [url, setUrl] = useState<string | null>(null); // WebSocket URL
    const [diagnostics, setDiagnostics] = useState<DiagnosticsEntry[]>([]); // Diagnostics data
    const [invalidNamespaceMessage, setInvalidNamespaceMessage] = useState<string | null>(null); // Error message for invalid namespace

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

        let retryCount = 0;
        const maxRetries = 5;
        const retryDelay = 3000; // 3 seconds

        const connectToWebSocket = () => {
            const ros = new ROSLIB.Ros({ url });

            ros.on('connection', () => {
                console.log('Connected to Foxglove bridge at ' + url);
                retryCount = 0; // Reset retry count on successful connection
            });

            ros.on('error', (error) => {
                console.error('Error connecting to Foxglove bridge:', error);
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`Retrying WebSocket connection (${retryCount}/${maxRetries})...`);
                    setTimeout(connectToWebSocket, retryDelay);
                } else {
                    console.error("Max retries reached. Could not connect to WebSocket.");
                }
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
                    const diagnosticsTree = buildDiagnosticsTree(message.status.map(({ name, message, level }) => ({
                        name,
                        message,
                        level: level !== undefined ? level : -1,
                    })));
                    setDiagnostics(diagnosticsTree);
                } else {
                    console.warn('Unexpected diagnostics data format:', message);
                }
            });

            return () => {
                diagnosticsTopic.unsubscribe();
                ros.close();
            };
        };

        connectToWebSocket();
    }, [namespace, url]);

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
                    <DiagnosticsTreeTable diagnostics={diagnostics} />
                </Stack>
            </PageSection>
        </Page>
    );
};
