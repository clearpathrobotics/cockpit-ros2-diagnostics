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

import {
    Alert,
    Button,
    Flex,
    FlexItem,
    Page,
    PageSection,
    Stack,
    Title
} from "@patternfly/react-core";
import { PauseIcon, PlayIcon } from "@patternfly/react-icons";

import cockpit from 'cockpit';
import { DiagnosticsStatus } from "./interfaces";
import { DiagnosticsTable } from "./components/DiagnosticsTable";
import { DiagnosticsTreeTable } from "./components/DiagnosticsTreeTable";
import { RosConnectionManager } from "./components/RosConnectionManager";
import { useNamespace } from "./hooks/useNamespace";
import { useWebSocketUrl } from "./hooks/useWebSocketUrl";
import { DiagnosticsCapture } from "./components/DiagnosticsCapture";
import { ManualNamespace } from "./components/ManualNamespace";
import { HistorySelection } from "./components/HistorySelection";
import { useDiagHistory } from './hooks/useDiagHistory';

const _ = cockpit.gettext;

export const Application = () => {
    const {
        namespace,
        setManualNamespace,
        invalidNamespaceMessage,
        manualEntryRequired
    } = useNamespace();
    const url = useWebSocketUrl(); // Use custom hook for WebSocket URL
    const [diagStatusDisplay, setDiagStatusDisplay] = useState<DiagnosticsStatus | null>(null); // DiagStatus data for display
    const [bridgeConnected, setBridgeConnected] = useState(false);
    const [selectedRawName, setSelectedRawName] = useState<string | null>(null); // Used as identifier for diag entry so that values get updated
    const [isPaused, setIsPaused] = useState(false); // Pause state for diagnostics updates

    const {
        diagHistory,
        updateDiagHistory,
        clearDiagHistory
    } = useDiagHistory(isPaused);

    // Extract diagnostics array from DiagnosticsStatus for components that need it
    const diagnostics = diagStatusDisplay?.diagnostics || [];

    return (
        <Page id="ros2-diag" className='no-masthead-sidebar'>
            <PageSection>
                <Stack hasGutter>
                    <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                        <FlexItem>
                            <Title headingLevel="h1" size="2xl">
                                {_("ROS 2 Diagnostics")}
                            </Title>
                        </FlexItem>
                        <FlexItem>
                            <Button
                                variant="secondary"
                                icon={isPaused ? <PlayIcon /> : <PauseIcon />}
                                onClick={() => {
                                    if (isPaused) clearDiagHistory();
                                    setIsPaused(!isPaused);
                                }}
                                aria-label={isPaused ? _("Resume diagnostics updates") : _("Pause diagnostics updates")}
                            >
                                {isPaused ? _("Resume") : _("Pause")}
                            </Button>
                        </FlexItem>
                    </Flex>
                    <HistorySelection
                        diagHistory={diagHistory}
                        setDiagStatusDisplay={setDiagStatusDisplay}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                    />
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
                                onDiagnosticsUpdate={updateDiagHistory}
                                onConnectionStatusChange={setBridgeConnected}
                                onClearHistory={clearDiagHistory}
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
