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

import React, { useState } from 'react';

import { Alert, Page, PageSection, Stack, Title } from "@patternfly/react-core";

import cockpit from 'cockpit';
import { DiagnosticsEntry } from "./interfaces";
import { DiagnosticsTable } from "./components/DiagnosticsTable";
import { DiagnosticsTreeTable } from "./components/DiagnosticsTreeTable";
import { RosConnectionManager } from "./components/RosConnectionManager";
import { useNamespace } from "./hooks/useNamespace";
import { useWebSocketUrl } from "./hooks/useWebSocketUrl";
import { DiagnosticsCapture } from "./components/DiagnosticsCapture";
import { ManualNamespace } from "./components/ManualNamespace";

const _ = cockpit.gettext;

export const Application = () => {
    const {
        namespace,
        setManualNamespace,
        invalidNamespaceMessage,
        manualEntryRequired
    } = useNamespace();
    const url = useWebSocketUrl(); // Use custom hook for WebSocket URL
    const [diagnostics, setDiagnostics] = useState<DiagnosticsEntry[]>([]); // Diagnostics data
    const [bridgeConnected, setBridgeConnected] = useState(false);
    const [selectedRawName, setSelectedRawName] = useState<string | null>(null); // Used as identifier for diag entry so that values get updated

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
                    { manualEntryRequired && (
                        <ManualNamespace
                            setManualNamespace={setManualNamespace}
                            namespace={namespace}
                        />
                    )}
                    <DiagnosticsCapture namespace={namespace} />
                    { !invalidNamespaceMessage && (
                        <>
                            <RosConnectionManager
                                namespace={namespace}
                                url={url}
                                onDiagnosticsUpdate={setDiagnostics}
                                onConnectionStatusChange={setBridgeConnected}
                            />
                            {diagnostics.length > 0 && (
                                <>
                                    <DiagnosticsTable diagnostics={diagnostics} setSelectedRawName={setSelectedRawName} variant="error" />
                                    <DiagnosticsTable diagnostics={diagnostics} setSelectedRawName={setSelectedRawName} variant="warning" />
                                </>
                            )}
                            <DiagnosticsTreeTable
                                diagnostics={diagnostics}
                                bridgeConnected={bridgeConnected}
                                selectedRawName={selectedRawName}
                                setSelectedRawName={setSelectedRawName}
                            />
                        </>
                    )}
                </Stack>
            </PageSection>
        </Page>
    );
};
