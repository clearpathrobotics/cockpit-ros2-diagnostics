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

import React, { useEffect } from "react";
import * as ROSLIB from "../roslib/index";
import { DiagnosticsEntry } from "../interfaces";
import { Icon } from "@patternfly/react-core";
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    QuestionCircleIcon,
} from "@patternfly/react-icons";

interface RosConnectionManagerProps {
    namespace: string;
    url: string | null;
    defaultNamespace: string;
    onDiagnosticsUpdate: (diagnostics: DiagnosticsEntry[]) => void;
    onConnectionStatusChange: (connected: boolean) => void;
}

// Helper function to build a nested DiagnosticsEntry tree
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                const path = parts.slice(0, index + 1).join("/")
                        .split(":")[0];
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

export const RosConnectionManager: React.FC<RosConnectionManagerProps> = ({
    namespace,
    url,
    defaultNamespace,
    onDiagnosticsUpdate,
    onConnectionStatusChange,
}) => {
    useEffect(() => {
        if (namespace === defaultNamespace) {
            console.warn("Namespace is not set correctly. Skipping WebSocket configuration.");
            return;
        }
        if (!url) {
            console.warn("WebSocket URL is not set correctly. Skipping WebSocket configuration.");
            return;
        }

        const retryDelay = 3000; // 3 seconds
        const timeoutDuration = 5000; // 5 seconds
        let timeoutId: NodeJS.Timeout | null = null;

        const connectToWebSocket = () => {
            const ros = new ROSLIB.Ros({ url });

            ros.on("connection", () => {
                console.log("Connected to Foxglove bridge at " + url);
                console.log(`Subscribing to topic: ${diagnosticsTopic.name}`); // Moved inside the connection callback
                onConnectionStatusChange(true);
            });

            ros.on("error", (error) => {
                console.error("Error connecting to Foxglove bridge:", error);
                console.log("Retrying WebSocket connection...");
                onConnectionStatusChange(false);
            });

            ros.on("close", () => {
                onConnectionStatusChange(false);
                console.log("Connection to Foxglove bridge closed");
                onDiagnosticsUpdate([]);
                setTimeout(connectToWebSocket, retryDelay);
            });

            const diagnosticsTopic = new ROSLIB.Topic({
                ros,
                name: `${namespace}/diagnostics_agg`,
                messageType: "diagnostic_msgs/DiagnosticArray",
            });

            diagnosticsTopic.subscribe((message) => {
                // Clear the timeout if a new message is received
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Process incoming diagnostics messages
                if (Array.isArray(message.status)) {
                    const diagnosticsTree = buildDiagnosticsTree(
                        message.status.map(({ name, message, level, hardware_id, values }) => ({
                            name,
                            message,
                            level: level !== undefined ? level : -1,
                            hardware_id,
                            values,
                        }))
                    );
                    onDiagnosticsUpdate(diagnosticsTree);
                } else {
                    console.warn("Unexpected diagnostics data format:", message);
                }

                // Set a timeout to clear stale diagnostics if no new message is received
                timeoutId = setTimeout(() => {
                    console.warn("No diagnostics message received for 5 seconds. Clearing stale diagnostics.");
                    onDiagnosticsUpdate([]);
                }, timeoutDuration);
            });

            return () => {
                diagnosticsTopic.unsubscribe();
                onConnectionStatusChange(false);
                ros.close();
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            };
        };

        connectToWebSocket();
    }, [namespace, url, defaultNamespace, onDiagnosticsUpdate, onConnectionStatusChange]);

    return null; // This component does not render anything
};
