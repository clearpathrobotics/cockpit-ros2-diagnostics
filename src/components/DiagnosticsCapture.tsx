import React, { useState, useEffect } from 'react';
import { Button, Alert, Card, CardBody, Flex, FlexItem, Title } from "@patternfly/react-core";

import cockpit from 'cockpit';
import { downloadFile } from './Download';

const _ = cockpit.gettext;

export const DiagnosticsCapture = ({ namespace }: { namespace: string }) => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [downloadPath, setDownloadPath] = useState<string | null>(null);
    const [adminAccess, setAdminAccess] = useState<boolean>(false);

    useEffect(() => {
        const permission = cockpit.permission({ admin: true });
        const update = () => setAdminAccess(permission.allowed);
        permission.addEventListener("changed", update);
        update();
        return () => {
            permission.removeEventListener("changed", update);
            permission.close();
        };
    }, []);

    const runBash = async (command: string, options: { superuser?: string } = {}) => {
        return await cockpit.spawn(["bash", "-c", command], options);
    };

    const handleCapture = async () => {
        setIsCapturing(true);
        setErrorMessage(null);
        setDownloadPath(null);

        try {
            const temp_folder = (await runBash("mktemp -d")).trim();

            const commands_su = [
                `dmesg -T >> ${temp_folder}/dmesg.log`,
                `cp -r /etc/netplan ${temp_folder}/netplan`,
                `journalctl -b 0 >> ${temp_folder}/journal.log`,
            ];

            const commands_usr = [
                `lsusb -t -v >> ${temp_folder}/usb.log`,
                `ls -lisah /dev/ >> ${temp_folder}/dev.log`,
                `source /etc/clearpath/setup.bash && env | grep -e ROS -e RMW >> ${temp_folder}/env.log`,
                `ip a >> ${temp_folder}/ip.log`,
            ];

            const commands_clearpath = [
                `mkdir -p ${temp_folder}/services`,
                `journalctl -b 0 -u clearpath-platform >> ${temp_folder}/services/platform.log`,
                `journalctl -b 0 -u clearpath-platform-extras >> ${temp_folder}/services/platform_extras.log`,
                `journalctl -b 0 -u clearpath-sensors >> ${temp_folder}/services/sensors.log`,
                `journalctl -b 0 -u clearpath-manipulators >> ${temp_folder}/services/manipulators.log`,
                `journalctl -b 0 -u clearpath-vcan >> ${temp_folder}/services/vcan.log`,
                `journalctl -b 0 -u clearpath-robot >> ${temp_folder}/services/robot.log`,
                `journalctl -b 0 -u clearpath-discovery >> ${temp_folder}/services/discovery_server.log`,
                `journalctl -b 0 -u clearpath-zenoh-router >> ${temp_folder}/services/zenoh_router.log`,
                `[ -f "/etc/clearpath/robot.yaml" ] && cp /etc/clearpath/robot.yaml ${temp_folder}/robot.yaml`,
                `[ -f "/etc/clearpath/setup.bash" ] && source /etc/clearpath/setup.bash && ros2 doctor --report >> ${temp_folder}/ros2_doctor.log`,
                `[ -f "/etc/clearpath/setup.bash" ] && source /etc/clearpath/setup.bash && ros2 topic echo --timeout 10 ${namespace}/diagnostics_agg >> ${temp_folder}/ros2_diagnostics.log`, // Timeout to avoid hanging if no messages are published
            ];

            for (const command of commands_su) {
                const output = await runBash(command, { superuser: "require" });
                console.log("Command executed successfully:", command, ": ", output);
            }

            for (const command of commands_usr) {
                const output = await runBash(command);
                console.log("Command executed successfully:", command, ": ", output);
            }

            if (await runBash("test -f /etc/clearpath/robot.yaml && echo 'exists'")) {
                for (const command of commands_clearpath) {
                    const output = await runBash(command);
                    console.log("Command executed successfully:", command, ": ", output);
                }
            }

            const hostname = (await runBash("hostname")).trim();
            const home = (await runBash("echo $HOME")).trim();
            const current_datetime = (await runBash("date +%Y-%m-%d_%H-%M-%S")).trim();
            const archive_name = `${home}/diagnostic_captures/${hostname}_${current_datetime}.tar.gz`;
            console.log("Archive name:", archive_name);
            await runBash(`mkdir -p ${home}/diagnostic_captures`);
            await runBash(`cd ${temp_folder} && tar -czvf ${archive_name} .`, { superuser: "require" });
            console.log("tar command executed successfully");
            await runBash(`rm -rf ${temp_folder}`, { superuser: "require" });

            setDownloadPath(archive_name);
        } catch (error) {
            console.error("Error capturing diagnostics:", error);
            setErrorMessage(_("Failed to capture diagnostics. Please try again."));
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <Card>
            <CardBody>
                <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                    <Flex direction={{ default: 'row' }} spaceItems={{ default: 'spaceItemsMd' }}>
                        <FlexItem>
                            <Title headingLevel="h2" size="md"> {_("Capture Diagnostics")} </Title>
                        </FlexItem>
                        {adminAccess && (
                            <FlexItem align={{ default: 'alignRight' }}>
                                <Button
                                    isLoading={isCapturing}
                                    isDisabled={isCapturing}
                                    onClick={handleCapture}
                                >
                                    {isCapturing ? _("Generating...") : _("Generate Capture")}
                                </Button>
                            </FlexItem>
                        )}
                    </Flex>
                    {isCapturing && (
                        <FlexItem align={{ default: 'alignRight' }}>
                            <p>Diagnostic capture may take several minutes to generate.</p>
                        </FlexItem>
                    )}
                    {!adminAccess && (
                        <FlexItem>
                            <p>Enable admin access at the top of the page to enable diagnostics capture feature.</p>
                        </FlexItem>
                    )}
                    {!isCapturing && (
                        <FlexItem>
                            {errorMessage && (
                                <Alert variant="danger" title={errorMessage} />
                            )}
                            {downloadPath && (
                                <Alert
                                    variant="success"
                                    title={_(`Diagnostics captured successfully (${downloadPath}).`)}
                                >
                                    <Button
                                        variant="link"
                                        isInline
                                        onClick={() => downloadFile(downloadPath)}
                                    >
                                        {_("Download Diagnostics File")}
                                    </Button>
                                </Alert>
                            )}
                        </FlexItem>
                    )}
                </Flex>
            </CardBody>
        </Card>
    );
};
