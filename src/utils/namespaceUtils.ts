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

// Sanitize the namespace to ensure it is valid and formatted correctly
export const sanitizeNamespace = (namespace: string): string => {
    let sanitizedNamespace = namespace
            .replace(/[^a-zA-Z0-9_/]/g, "") // Remove invalid characters
            .replace(/\/+/g, "/") // Replace consecutive slashes with a single slash
            .replace(/_+/g, "_") // Replace consecutive underscores with a single underscore
            .replace(/^\/|\/$/g, "") // Trim leading and trailing slashes
            .replace(/^\d+/, ""); // Drop leading numbers prior to the first letter or underscore

    // Add a leading slash if the sanitized namespace is not empty
    if (sanitizedNamespace) {
        sanitizedNamespace = "/" + sanitizedNamespace;
    }

    return sanitizedNamespace;
};

export const sameNamespace = (ns1: string, ns2: string): boolean => {
    if (ns1.replace(/^\/|\/$/g, "") !== ns2.replace(/^\/|\/$/g, "")) {
        return false;
    }
    return true;
};
