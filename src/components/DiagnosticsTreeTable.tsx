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

import React, { useEffect, useState, useCallback } from 'react';
import {
    Bullseye,
    Card,
    CardBody,
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
export const DiagnosticsTreeTable = ({
    diagnostics,
    bridgeConnected,
    selectedRawName,
    setSelectedRawName,
}: {
    diagnostics: DiagnosticsEntry[],
    bridgeConnected: boolean,
    selectedRawName: string | null,
    setSelectedRawName: (rawName: string | null) => void,
}) => {
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const drawerRef = React.useRef<HTMLDivElement>(null); // Ref for focus management
    const [triggerDrawerFocus, setTriggerDrawerFocus] = useState(false); // Used to ensure focus happens after the drawer renders
    const [lastExpandedRawName, setLastExpandedRawName] = useState<string | null>(null); // Track last expanded

    useEffect(() => {
        if (selectedRawName) {
            setTriggerDrawerFocus(true);
        }
    }, [selectedRawName]);

    useEffect(() => {
        if (triggerDrawerFocus && drawerRef.current) {
            drawerRef.current.focus();
            setTriggerDrawerFocus(false);
        }
    }, [triggerDrawerFocus]);

    const closeDrawer = () => {
        setSelectedRawName(null);
    };

    // Helper to toggle expansion for a given diagnostic rawName
    const toggleRowExpansion = (diagRawName: string) => {
        setExpandedRows(prevExpanded =>
            prevExpanded.includes(diagRawName)
                ? prevExpanded.filter(name => name !== diagRawName)
                : [...prevExpanded, diagRawName]
        );
    };

    const renderRows = (
        [diag, ...remainingDiag]: DiagnosticsEntry[],
        indentLevel = 1,
        posinset = 1,
        rowIndex = 0,
        isHidden = false
    ): React.ReactNode[] => {
        if (!diag) return [];

        const isExpanded = expandedRows.includes(diag.rawName);

        const treeRow: TdProps["treeRow"] = {
            onCollapse: (event) => {
                event.stopPropagation(); // Prevent triggering onClick when expanding/collapsing
                toggleRowExpansion(diag.rawName);
            },
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
                isSelectable
                isRowSelected={selectedRawName === diag.rawName}
                isClickable
                onClick={() => {
                    setSelectedRawName(diag.rawName);
                    toggleRowExpansion(diag.rawName);
                }}
            >
                <Td dataLabel={_("Name")} treeRow={treeRow}>
                    <Title headingLevel="h4">{diag.name}</Title>
                    {diag.path}
                </Td>
                <Td dataLabel={_("Message")}>{diag.message}</Td>
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

    // Helper to find the path (array of rawNames) from root to a given rawName
    const findPathToRawName = useCallback((entries: DiagnosticsEntry[], rawName: string, path: string[] = []): string[] | null => {
        for (const entry of entries) {
            const newPath = [...path, entry.rawName];
            if (entry.rawName === rawName) {
                return newPath;
            }
            const childPath = findPathToRawName(entry.children, rawName, newPath);
            if (childPath) {
                return childPath;
            }
        }
        return null;
    }, []);

    useEffect(() => {
        if (
            selectedRawName &&
            selectedRawName !== lastExpandedRawName // Only expand if changed
        ) {
            const path = findPathToRawName(diagnostics, selectedRawName);
            if (path && path.length > 1) {
                // Expand all ancestors (exclude the last, which is the selected node itself)
                setExpandedRows(prevExpanded => {
                    const ancestors = path.slice(0, -1);
                    // Only add ancestors not already expanded
                    return Array.from(new Set([...prevExpanded, ...ancestors]));
                });
            }
            setLastExpandedRawName(selectedRawName);
        }
    }, [selectedRawName, diagnostics, findPathToRawName, lastExpandedRawName]);

    const selectedEntry = selectedRawName ? findEntryByRawName(diagnostics, selectedRawName) : null;

    const drawerPanel = (
        <DrawerPanelContent isResizable defaultSize="35%" maxSize="50%" minSize="20%">
            {selectedEntry && (
                <div
                    style={{ padding: "1rem" }}
                    tabIndex={0}
                    ref={drawerRef}
                >
                    <DrawerHead>
                        <Title headingLevel="h3">
                            Diagnostic Details
                        </Title>
                        <DrawerActions>
                            <DrawerCloseButton onClick={closeDrawer} />
                        </DrawerActions>
                    </DrawerHead>
                    <Title headingLevel="h4">{selectedEntry.icon} {selectedEntry.name}</Title>
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
                        <>
                            <p>&nbsp;</p>
                            <p><strong>{_("Values")}:</strong></p>
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
                        </>
                    )}
                </div>
            )}
        </DrawerPanelContent>
    );

    return (
        <Card>
            <CardBody>
                <Title headingLevel="h2">
                    {_("All Diagnostics")}
                </Title>
                <Drawer isExpanded={!!selectedEntry} isInline>
                    <DrawerContent panelContent={drawerPanel}>
                        <DrawerContentBody>
                            <Table isTreeTable variant="compact" aria-label={_("Diagnostics Tree Table")} borders={false}>
                                <Thead>
                                    <Tr>
                                        <Th>
                                            <Title headingLevel="h3">
                                                {_("Name")}
                                            </Title>
                                        </Th>
                                        <Th>
                                            <Title headingLevel="h3">
                                                {_("Message")}
                                            </Title>
                                        </Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {renderRows(diagnostics)}
                                    {(diagnostics.length === 0) && (
                                        <Tr>
                                            <Td colSpan={2}>
                                                <Bullseye>
                                                    <EmptyState
                                                        headingLevel="h3"
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
                        </DrawerContentBody>
                    </DrawerContent>
                </Drawer>
            </CardBody>
        </Card>
    );
};
