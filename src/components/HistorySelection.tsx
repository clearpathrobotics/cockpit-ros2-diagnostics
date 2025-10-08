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

import React, { useEffect, useState } from 'react';
import {
    ProgressStepper,
    ProgressStep,
    Flex,
    FlexItem
} from '@patternfly/react-core';

import { DiagnosticsStatus } from "../interfaces";
import { HISTORY_SIZE } from '../hooks/useDiagHistory';

export const HistorySelection = ({
    diagHistory,
    setDiagStatusDisplay,
    isPaused,
    setIsPaused
}: {
    diagHistory: DiagnosticsStatus[],
    setDiagStatusDisplay: React.Dispatch<React.SetStateAction<DiagnosticsStatus | null>>,
    isPaused: boolean,
    setIsPaused: React.Dispatch<React.SetStateAction<boolean>>
}) => {
    const [negIndex, setNegIndex] = useState(-1); // -1 is latest, -2 is second latest, etc.

    useEffect(() => {
        // On initial load, set to the latest history entry if available
        if (!isPaused) {
            setNegIndex(-1);
            if (diagHistory.length > 0) {
                setDiagStatusDisplay(diagHistory[diagHistory.length - 1]);
            } else {
                setDiagStatusDisplay(null);
            }
        }
    }, [diagHistory, setDiagStatusDisplay, isPaused]);

    return (
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsXs' }}>
            <FlexItem>
                <ProgressStepper isCenterAligned aria-label="Diagnostics History">
                    {
                        Array.from({ length: HISTORY_SIZE - diagHistory.length }).map((_, index) => (
                            <ProgressStep
                                key={index}
                                id={`blank-step-${index}`}
                                titleId={`blank-step-${index}-title`}
                            />
                        ))
                    }

                    {diagHistory.map((diagStatus, index) => {
                        const variant = diagStatus.level >= 2
                            ? "danger"
                            : diagStatus.level === 1
                                ? "warning"
                                : "success";

                        return (
                            <ProgressStep
                                key={index}
                                variant={((diagHistory.length + negIndex) === index) ? "info" : variant}
                                id={`history-step-${index}`}
                                titleId={`history-step-${index}-title`}
                                aria-label={`diagnostics snapshot ${index + 1}`}
                                onClick={() => {
                                    setDiagStatusDisplay(diagStatus);
                                    setIsPaused(true);
                                    setNegIndex(index - diagHistory.length);
                                }}
                                style={{ cursor: 'pointer' }}
                            />
                        );
                    })}
                </ProgressStepper>
            </FlexItem>
            <FlexItem>
                <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
                    <FlexItem>
                        Oldest Timestamp: {diagHistory.length > 0 ? new Date(diagHistory[0].timestamp).toLocaleTimeString() : 'N/A'}
                    </FlexItem>
                    {isPaused &&
                        <FlexItem>
                            Selected Timestamp: {diagHistory.length > 0 ? new Date(diagHistory[diagHistory.length + negIndex].timestamp).toLocaleTimeString() : 'N/A'}
                        </FlexItem>}
                    <FlexItem>
                        Latest Timestamp: {diagHistory.length > 0 ? new Date(diagHistory[diagHistory.length - 1].timestamp).toLocaleTimeString() : 'N/A'}
                    </FlexItem>
                </Flex>
            </FlexItem>
        </Flex>
    );
};
