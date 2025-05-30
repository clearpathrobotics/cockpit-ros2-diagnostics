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

import { useEffect, useState } from "react";

import cockpit from "cockpit";

import { sanitizeNamespace } from "../utils/namespaceUtils";

const _ = cockpit.gettext;

// Custom hook to manage namespace
export const useNamespace = (defaultNamespace: string) => {
    const [namespace, setNamespace] = useState(defaultNamespace);
    const [invalidNamespaceMessage, setInvalidNamespaceMessage] = useState<string | null>(null);
    const [manualEntryRequired, setManualEntryRequired] = useState(false);

    useEffect(() => {
        const yamlFile = cockpit.file("/etc/clearpath/robot.yaml");

        const updateNamespace = (content: string | null) => {
            if (content) {
                const trimmedContent = content.trim();
                let originalNamespace = "";
                let sanitizedNamespace = "";

                // Extract namespace
                const namespaceMatch = trimmedContent.match(/^[ \t]*namespace:[ \t]*(\S+)/ms);
                const serialNumberMatch = trimmedContent.match(/^serial_number:[ \t]*(\S+)/ms);

                if (namespaceMatch) {
                    originalNamespace = namespaceMatch[1];
                    sanitizedNamespace = sanitizeNamespace(namespaceMatch[1]);
                    setNamespace(sanitizedNamespace);
                } else if (serialNumberMatch) {
                    originalNamespace = serialNumberMatch[1];
                    sanitizedNamespace = sanitizeNamespace(serialNumberMatch[1]);
                    setNamespace(sanitizedNamespace);
                } else {
                    const message = _("Configuration Error: Neither namespace nor serial_number found in robot.yaml");
                    console.warn(message);
                    setInvalidNamespaceMessage(message);
                    return;
                }

                // Check if the sanitized namespace differs from the original
                if (originalNamespace.replace(/^\/|\/$/g, "") !== sanitizedNamespace.replace(/^\/|\/$/g, "")) {
                    const message = `Invalid namespace: "${originalNamespace}", trying to connect using: "${sanitizedNamespace}"`;
                    console.warn(message);
                    setInvalidNamespaceMessage(message);
                } else {
                    setInvalidNamespaceMessage(null);
                }
            } else {
                const message = _("'robot.yaml' file not found or empty");
                console.warn(message);
                setInvalidNamespaceMessage(message);
                setManualEntryRequired(true);
            }
        };

        yamlFile.watch(updateNamespace);
        return yamlFile.close;
    }, []);

    return { namespace, setNamespace, invalidNamespaceMessage, manualEntryRequired };
};
