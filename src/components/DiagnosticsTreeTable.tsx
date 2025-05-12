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
    Bullseye,
    Card,
    CardBody,
    CardTitle,
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
    Spinner,
    Title
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td, TreeRowWrapper, TdProps } from "@patternfly/react-table";

import cockpit from 'cockpit';

import { DiagnosticsEntry } from "../interfaces";

const _ = cockpit.gettext;

// Renders an expandable TreeTable of diagnostic messages
export const DiagnosticsTreeTable = ({ diagnostics, bridgeConnected }: { diagnostics: DiagnosticsEntry[], bridgeConnected: boolean }) => {
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
