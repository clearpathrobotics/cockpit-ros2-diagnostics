import React, { useEffect, useState } from 'react';
import {
    ProgressStepper,
    ProgressStep
} from '@patternfly/react-core';

import { DiagnosticsStatus } from "../interfaces";

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
        if (!isPaused && diagHistory.length > 0) {
            setNegIndex(-1);
            setDiagStatusDisplay(diagHistory[diagHistory.length - 1]);
        }
    }, [diagHistory, setDiagStatusDisplay, isPaused]);

    return (
        <ProgressStepper isCenterAligned aria-label="Diagnostics History">
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
                    >
                        {(index % 10 === 0 || index === diagHistory.length - 1) ? new Date(diagStatus.timestamp).toLocaleTimeString() : null}
                    </ProgressStep>
                );
            })}
        </ProgressStepper>
    );
};
