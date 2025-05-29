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

import React from 'react';
import {
    Alert,
    Bullseye,
    Title,
    EmptyState,
    EmptyStateVariant,
} from "@patternfly/react-core";
import { CheckCircleIcon } from "@patternfly/react-icons";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";

import cockpit from 'cockpit';

import { DiagnosticsEntry } from "../interfaces";

const _ = cockpit.gettext;

// Helper function to collect leaf nodes
const collectLeafNodes = (entries: DiagnosticsEntry[]): DiagnosticsEntry[] =>
    entries.flatMap(entry =>
        entry.children.length === 0 ? [entry] : collectLeafNodes(entry.children)
    );

// Renders a table of diagnostic messages filtered by severity level
export const DiagnosticsTable = ({
    diagnostics,
    setSelectedRawName,
    variant
}: {
    diagnostics: DiagnosticsEntry[],
    setSelectedRawName: (rawName: string | null) => void,
    variant: "error" | "warning"
}) => {
    const levelFilter = (level: number) =>
        variant === "error" ? level >= 2 : level === 1; // Errors: level >= 2, Warnings: level == 1

    const filteredDiagnostics = collectLeafNodes(diagnostics).filter(d => levelFilter(d.severity_level));

    return (
        <Alert
            variant={variant === "error" ? "danger" : "warning"}
            title={
                <Title headingLevel="h2">
                    {variant === "error" ? _("Errors") : _("Warnings")}
                </Title>
            }
            component='h2'
            isInline
        >
            <Table aria-label={`${variant === "error" ? "Errors" : "Warnings"} Table`} borders={false} variant="compact">
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
                    {filteredDiagnostics.map((diag, index) => (
                        <Tr
                            key={index}
                            isClickable
                            onRowClick={() => setSelectedRawName(diag.rawName)}
                        >
                            <Td>
                                <Title headingLevel="h4">
                                    {diag.icon} <span style={{ marginLeft: "0.5rem" }}>{diag.name || _("N/A")}</span>
                                </Title>
                                {diag.path || _("N/A")}
                            </Td>
                            <Td>{diag.message || _("N/A")}</Td>
                        </Tr>
                    ))}
                    {filteredDiagnostics.length === 0 && (
                        <Tr>
                            <Td colSpan={2}>
                                <Bullseye>
                                    <EmptyState
                                        headingLevel="h4"
                                        titleText={variant === "error" ? _("No Errors") : _("No Warnings")}
                                        icon={CheckCircleIcon}
                                        variant={EmptyStateVariant.sm}
                                    />
                                </Bullseye>
                            </Td>
                        </Tr>
                    )}
                </Tbody>
            </Table>
        </Alert>
    );
};
