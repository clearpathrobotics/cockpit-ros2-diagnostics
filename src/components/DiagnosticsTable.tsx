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
    EmptyStateBody,
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
export const DiagnosticsTable = ({ diagnostics, variant }: { diagnostics: DiagnosticsEntry[], variant: "danger" | "warning" }) => {
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
                    {filteredDiagnostics.length === 0 && (
                        <Tr>
                            <Td colSpan={2}>
                                <Bullseye>
                                    <EmptyState
                                        headingLevel="h2"
                                        titleText={variant === "danger" ? _("No Errors") : _("No Warnings")}
                                        icon={CheckCircleIcon}
                                        variant={EmptyStateVariant.sm}
                                    >
                                        <EmptyStateBody>
                                            {variant === "danger"
                                                ? _("No errors found.")
                                                : _("No warnings found.")}
                                        </EmptyStateBody>
                                    </EmptyState>
                                </Bullseye>
                            </Td>
                        </Tr>
                    )}
                </Tbody>
            </Table>
        </Alert>
    );
};
