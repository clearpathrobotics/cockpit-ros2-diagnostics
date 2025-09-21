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

import { useState, useCallback, useRef, useEffect } from "react";

import { DiagnosticsStatus } from "../interfaces";

export const HISTORY_SIZE = 30;

export const useDiagHistory = (isPaused: boolean) => {
    const [diagHistory, setDiagHistory] = useState<DiagnosticsStatus[]>([]);
    const isPausedRef = useRef<boolean>(isPaused);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    const clearDiagHistory = useCallback(() => {
        setDiagHistory([]);
    }, []);

    const updateDiagHistory = useCallback((diagStatusLatest: DiagnosticsStatus | null) => {
        // Only add to history if we have actual diagnostics
        if (!isPausedRef.current && diagStatusLatest && diagStatusLatest.diagnostics.length > 0) {
            setDiagHistory(prevItems => {
                const updatedItems = [...prevItems, diagStatusLatest];
                // Keep only the last HISTORY_SIZE entries
                if (updatedItems.length > HISTORY_SIZE) {
                    return updatedItems.slice(-HISTORY_SIZE);
                }
                return updatedItems;
            });
        }
    }, [isPausedRef]);

    return { diagHistory, updateDiagHistory, clearDiagHistory };
};
