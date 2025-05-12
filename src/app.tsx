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
import {
    Alert,
    Bullseye,
    Icon,
    Title,
    Drawer,
    DrawerContent,
    DrawerContentBody,
    DrawerPanelContent,
    DrawerHead,
    DrawerActions,
    DrawerCloseButton,
    EmptyState,
    EmptyStateVariant,
    EmptyStateBody,
    Spinner
} from "@patternfly/react-core";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Table, Thead, Tr, Th, Tbody, Td, TreeRowWrapper, TdProps} from "@patternfly/react-table";
import {
    BanIcon,
    CheckCircleIcon,
    DisconnectedIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    QuestionCircleIcon
} from "@patternfly/react-icons";

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
    rawName: string;
    message: string;
    severity_level: number;
    hardware_id: string | null;
    values: { [key: string]: any } | null;
    children: DiagnosticsEntry[];
    icon: JSX.Element | null;
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
                const path = parts.slice(0, index + 1).join("/").split(":")[0];
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

// Helper function to collect leaf nodes
const collectLeafNodes = (entries: DiagnosticsEntry[]): DiagnosticsEntry[] =>
    entries.flatMap(entry =>
        entry.children.length === 0 ? [entry] : collectLeafNodes(entry.children)
    );

// Renders a table of diagnostic messages filtered by severity level
const DiagnosticsTable = ({ diagnostics, variant }: { diagnostics: DiagnosticsEntry[], variant: "danger" | "warning" }) => {
    const levelFilter = (level: number) =>
        variant === "danger" ? level >= 2 : level === 1; // Errors: level >= 2, Warnings: level == 1

    const filteredDiagnostics = collectLeafNodes(diagnostics).filter(d => levelFilter(d.severity_level));

    return (
        <Alert
            variant={variant}
            title={variant === "danger" ? _("Errors") : _("Warnings")}
            component='h2'
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
                                <Title headingLevel="h3" size="sm">
                                    {d.icon} <span style={{ marginLeft: "0.5rem" }}>{d.name || _("N/A")}</span>
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
const DiagnosticsTreeTable = ({ diagnostics, bridgeConnected }: { diagnostics: DiagnosticsEntry[], bridgeConnected: boolean }) => {
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const [selectedRawName, setSelectedRawName] = useState<string | null>(null); // Use rawName as identifier
    const drawerRef = React.useRef<HTMLSpanElement>(null); // Ref for focus management

    useEffect(() => {
        if (selectedRawName && drawerRef.current) {
            drawerRef.current.focus(); // Focus the drawer after it is rendered
        }
    }, [selectedRawName]);

    const onRowClick = (entry: DiagnosticsEntry) => {
        setSelectedRawName(entry.rawName);
    };

    const closeDrawer = () => {
        setSelectedRawName(null);
    };

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

        const treeRow: TdProps["treeRow"] = {
            onCollapse: (event) => {
                event.stopPropagation(); // Prevent triggering onClick when expanding/collapsing
                setExpandedRows(prevExpanded =>
                    prevExpanded.includes(diag.name)
                        ? prevExpanded.filter(name => name !== diag.name)
                        : [...prevExpanded, diag.name]
                );
            },
            rowIndex,
            props: {
                isExpanded,
                isHidden,
                "aria-level": indentLevel,
                "aria-posinset": posinset,
                "aria-setsize": diag.children.length,
                icon: diag.icon,
            },
        };

        const childRows = diag.children.length
            ? renderRows(diag.children, indentLevel + 1, 1, rowIndex + 1, !isExpanded || isHidden)
            : [];

        return [
            <TreeRowWrapper
                key={diag.rawName}
                row={{ props: treeRow.props }}
                isClickable
                onClick={() => onRowClick(diag)}
            >
                <Td dataLabel={_("Name")} treeRow={treeRow}>
                    <Title headingLevel="h3" size="sm">{diag.name}</Title>
                    {diag.path}
                </Td>
                <Td dataLabel={columnNames.message}>{diag.message}</Td>
            </TreeRowWrapper>,
            ...childRows,
            ...renderRows(remainingDiag, indentLevel, posinset + 1, rowIndex + 1 + childRows.length, isHidden),
        ];
    };

    // Helper function to find the latest entry by path
    const findEntryByRawName = (entries: DiagnosticsEntry[], rawName: string): DiagnosticsEntry | null => {
        for (const entry of entries) {
            if (entry.rawName === rawName) {
                return entry;
            }
            const foundInChildren = findEntryByRawName(entry.children, rawName);
            if (foundInChildren) {
                return foundInChildren;
            }
        }
        return null;
    };

    const selectedEntry = selectedRawName ? findEntryByRawName(diagnostics, selectedRawName) : null;

    const drawerPanel = (
        <DrawerPanelContent isResizable defaultSize="35%" maxSize="50%" minSize="20%">
            {selectedEntry && (
                <div style={{ padding: "1rem" }}>
                    <DrawerHead>
                        <span tabIndex={selectedEntry ? 0 : -1} ref={drawerRef}>
                            Diagnostics Details
                        </span>
                        <DrawerActions>
                            <DrawerCloseButton onClick={closeDrawer} />
                        </DrawerActions>
                    </DrawerHead>
                    <Title headingLevel="h2" size="lg">{selectedEntry.icon} {selectedEntry.name}</Title>
                    <p><strong>{_("Path")}:</strong> {selectedEntry.path}</p>
                    <p><strong>{_("Hardware ID")}:</strong> {selectedEntry.hardware_id || _("N/A")}</p>
                    <p><strong>{_("Level")}:</strong> {
                        selectedEntry.severity_level === 3
                            ? _("STALE")
                            : selectedEntry.severity_level === 2
                                ? _("ERROR")
                                : selectedEntry.severity_level === 1
                                    ? _("WARNING")
                                    : _("OK")
                    }
                    </p>
                    <p><strong>{_("Message")}:</strong> {selectedEntry.message}</p>
                    {selectedEntry.values && Object.keys(selectedEntry.values).length > 0 && (
                        <div>
                            <br />
                            <strong>{_("Values")}:</strong>
                            <Table aria-label={_("Diagnostic Values Table")} borders={false} variant="compact">
                                <Tbody>
                                    {Object.entries(selectedEntry.values).map(([key, value]) => (
                                        <Tr key={key}>
                                            <Td>{key}</Td>
                                            <Td>{value}</Td>
                                        </Tr>
                                    ))}
                                </Tbody>
                            </Table>
                        </div>
                    )}
                </div>
            )}
        </DrawerPanelContent>
    );

    return (
        <Drawer isExpanded={!!selectedEntry} isInline>
            <DrawerContent panelContent={drawerPanel}>
                <DrawerContentBody style={{ marginRight: "1rem" }}>
                    <Card>
                        <CardTitle>{_("All Diagnostics")}</CardTitle>
                        <CardBody>
                            <Table isTreeTable variant="compact" aria-label={_("Diagnostics Tree Table")} borders={false}>
                                <Thead>
                                    <Tr>
                                        <Th>{_("Name")}</Th>
                                        <Th>{_("Message")}</Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {renderRows(diagnostics)}
                                    {(diagnostics.length === 0) && (
                                        <Tr>
                                            <Td colSpan={2}>
                                                <Bullseye>
                                                    <EmptyState
                                                        headingLevel="h2"
                                                        titleText="Connecting"
                                                        icon={Spinner}
                                                        variant={EmptyStateVariant.sm}
                                                    >
                                                        <EmptyStateBody>
                                                            { bridgeConnected
                                                                ? _("Listening for the diagnostics topic...")
                                                                : _("Attempting to connect to the Foxglove bridge...")}
                                                        </EmptyStateBody>
                                                    </EmptyState>
                                                </Bullseye>
                                            </Td>
                                        </Tr>
                                    )}
                                </Tbody>
                            </Table>
                        </CardBody>
                    </Card>
                </DrawerContentBody>
            </DrawerContent>
        </Drawer>
    );
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
            });

            return () => {
                diagnosticsTopic.unsubscribe();
                setBridgeConnected(false);
                ros.close();
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
                            <DiagnosticsTable diagnostics={diagnostics} variant="danger" />
                            <DiagnosticsTable diagnostics={diagnostics} variant="warning" />
                            <DiagnosticsTreeTable diagnostics={diagnostics} bridgeConnected={bridgeConnected} />
                        </>
                    )}
                </Stack>
            </PageSection>
        </Page>
    );
};
