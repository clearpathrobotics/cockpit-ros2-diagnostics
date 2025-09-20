import React, { useState, useEffect } from 'react';
import {
    ActionGroup,
    Button,
    Card,
    CardBody,
    CardTitle,
    Flex,
    FlexItem,
    Form,
    FormHelperText,
    FormGroup,
    HelperText,
    HelperTextItem,
    TextInput
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from "@patternfly/react-icons";

import cockpit from 'cockpit';
import { sameNamespace, sanitizeNamespace } from '../utils/namespaceUtils';

const _ = cockpit.gettext;

export const ManualNamespace = ({
    setManualNamespace,
    namespace
}: {
    setManualNamespace: (namespace: string) => void,
    namespace: string
}) => {
    const [value, setValue] = useState(namespace);
    const [unsaved, setUnsaved] = useState(false);
    const [invalidNamespaceMessage, setInvalidNamespaceMessage] = useState('');
    const [validated, setValidated] = useState<'default' | 'error'>('default');

    // Check if a namespace change has been made
    useEffect(() => {
        const isSame = sameNamespace(namespace, sanitizeNamespace(value));
        setUnsaved(!isSame);
    }, [namespace, value]);

    // Validate the namespace entered
    useEffect(() => {
        const sanitizedValue = sanitizeNamespace(value);
        const isSame = sameNamespace(value, sanitizedValue);
        setValidated(!isSame ? 'error' : 'default');
        setInvalidNamespaceMessage(!isSame ? 'Invalid namespace. Legal namespace would be: ' + sanitizedValue : '');
    }, [namespace, value]);

    return (
        <Card>
            <CardTitle component='h2' className='diagnostics-title'>{_('Namespace')}</CardTitle>
            <CardBody>
                <Form onSubmit={e => e.preventDefault()}>
                    <Flex direction={{ default: 'row' }} spaceItems={{ default: 'spaceItemsMd' }}>
                        <FlexItem grow={{ default: 'grow' }}>
                            <FormGroup>
                                <TextInput
                                    value={value}
                                    type='text'
                                    placeholder={_('Enter namespace for the diagnostics_agg topic')}
                                    onChange={(_event, value) => setValue(value)}
                                    validated={validated}
                                    aria-label='Manual Namespace Entry'
                                />
                                <FormHelperText>
                                    <HelperText>
                                        <HelperTextItem
                                            variant={validated}
                                            {...(validated === 'error' && { icon: <ExclamationCircleIcon /> })}
                                        >
                                            {invalidNamespaceMessage}
                                        </HelperTextItem>
                                    </HelperText>
                                </FormHelperText>
                            </FormGroup>
                        </FlexItem>
                        <FlexItem align={{ default: 'alignRight' }}>
                            <ActionGroup className='diagnostics-no-margin'>
                                <Button
                                    isDisabled={!unsaved}
                                    onClick={() => {
                                        const ns = sanitizeNamespace(value);
                                        setManualNamespace(ns);
                                        setValue(ns);
                                    }}
                                    type='submit'
                                >
                                    {unsaved ? _('Apply') : _('Applied')}
                                </Button>
                            </ActionGroup>
                        </FlexItem>
                    </Flex>
                </Form>
            </CardBody>
        </Card>
    );
};
