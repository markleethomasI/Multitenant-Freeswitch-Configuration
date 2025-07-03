const tenantService = require('../services/tenantService');

const directoryController = {
    /**
     * Handles FreeSWITCH directory lookups via mod_xml_curl.
     * This endpoint provides user information (SIP credentials, voicemail settings)
     * for SIP clients, group voicemail boxes, and DID voicemail boxes.
     *
     * FreeSWITCH sends a POST request with parameters like:
     * - domain: The domain FreeSWITCH is looking up (e.g., 'tenant1.example.com')
     * - sip_auth_username: The username for SIP registration.
     * - user: A generic user ID lookup.
     *
     * @param {Object} body - The request body from FreeSWITCH containing lookup parameters.
     * @returns {string} The XML document for FreeSWITCH.
     */
    lookup: async (body) => {
        const domain = body.domain;
        // FreeSWITCH sends either sip_auth_username (for registration) or user (for other lookups like voicemail)
        const userNumber = body.sip_auth_username || body.user;

        console.log(`INFO: Directory lookup request for user ID: "${userNumber}" in domain: "${domain}"`);
        console.log('------------------------DIRECTORY XML Provided------------------------------------');

        if (!domain || !userNumber) {
            console.warn("WARN: Missing domain or user ID in directory lookup request. Returning empty XML.");
            return `<document type="freeswitch/xml"/>`;
        }

        // Fetch the tenant and all its associated data (SIP clients, groups, DIDs).
        // This relies on your tenantService.getTenantByDomain method to populate these arrays.
        const tenant = await tenantService.getTenantByDomain(domain);

        if (!tenant) {
            console.warn(`WARN: Tenant not found for domain: "${domain}". Returning empty XML.`);
            return `<document type="freeswitch/xml"/>`;
        }

        let userXml = ''; // This will hold the generated <user> XML snippet
        let defaultVoicemailPin = '0000'; // Fallback PIN if not explicitly set
        let defaultVoicemailEmail = `voicemail@${domain}`; // Fallback email

        // --- Lookup Priority: ---
        // 1. SIP Client (for actual SIP registrations and their voicemail boxes)
        // 2. Group Voicemail Box (if userNumber matches a group's specific voicemail_box_id)
        // 3. DID Voicemail Box (if userNumber matches a DID number configured for voicemail failover)

        // --- 1. Attempt to match a SIP Client ---
        const sipClient = tenant.sip_clients?.find(client => client.user_id === userNumber);

        if (sipClient) {
            console.log(`DEBUG: Matched SIP client: ${sipClient.user_id}`);
            const voicemailPin = sipClient.voicemail_pin || defaultVoicemailPin;
            const voicemailEmail = sipClient.voicemail_email || defaultVoicemailEmail;

            userXml = `
                <user id="${sipClient.user_id}">
                    <params>
                        <param name="password" value="${sipClient.password || ''}"/>
                        ${sipClient.enable_voicemail ? `<param name="vm-password" value="${voicemailPin}"/>` : ''}
                    </params>
                    <variables>
                        <variable name="user_context" value="default"/>
                        <variable name="domain_name" value="${tenant.domain_name}"/>
                        <variable name="domain" value="${tenant.domain_name}"/>
                        <variable name="dial_string" value="{presence_id=${sipClient.user_id}@${tenant.domain_name}}"/>
                        ${sipClient.enable_voicemail && voicemailEmail ? `<variable name="email_address" value="${voicemailEmail}"/>` : ''}
                        <variable name="effective_caller_id_name" value="${sipClient.display_name || sipClient.user_id}"/>
                        <variable name="effective_caller_id_number" value="${sipClient.user_id}"/>
                    </variables>
                </user>
            `;
        }
        // --- 2. Attempt to match a Group Voicemail Box ---
        // The userNumber here would be the `voicemail_box_id` (e.g., "sales_vm")
        else {
            const groupVm = tenant.groups?.find(group =>
                group.enable_voicemail && group.voicemail_box_id === userNumber
            );

            if (groupVm) {
                console.log(`DEBUG: Matched Group Voicemail Box: "${groupVm.voicemail_box_id}" for group "${groupVm.name}"`);
                const voicemailPin = groupVm.voicemail_pin || defaultVoicemailPin;
                const voicemailEmail = groupVm.group_email || defaultVoicemailEmail; // Assuming group_email for notifications

                userXml = `
                    <user id="${userNumber}" mailbox="${groupVm.voicemail_box_id}">
                        <params>
                            <param name="password" value="NO_SIP_AUTH"/> <param name="vm-password" value="${voicemailPin}"/>
                        </params>
                        <variables>
                            <variable name="user_context" value="default"/>
                            <variable name="domain_name" value="${tenant.domain_name}"/>
                            <variable name="domain" value="${tenant.domain_name}"/>
                            ${voicemailEmail ? `<variable name="email_address" value="${voicemailEmail}"/>` : ''}
                            <variable name="effective_caller_id_name" value="${groupVm.name} Voicemail"/>
                            <variable name="effective_caller_id_number" value="${groupVm.voicemail_box_id}"/>
                        </variables>
                    </user>
                `;
            }
            // --- 3. Attempt to match a DID Voicemail Box ---
            // The userNumber here would be the DID number itself (e.g., "5125471930")
            else {
                const didVm = tenant.dids?.find(did =>
                    did.did_number === userNumber &&
                    did.failover_routing_type === "dialplan_extension" &&
                    did.failover_routing_target &&
                    did.failover_routing_target.startsWith("voicemail_")
                );

                if (didVm) {
                    const vmBoxIdFromDid = didVm.failover_routing_target.substring("voicemail_".length);
                    console.log(`DEBUG: Matched DID Voicemail Box: "${userNumber}" (actual mailbox ID: ${vmBoxIdFromDid})`);
                    const voicemailPin = didVm.voicemail_pin || defaultVoicemailPin;
                    const voicemailEmail = didVm.voicemail_email || defaultVoicemailEmail;

                    userXml = `
                        <user id="${userNumber}" mailbox="${vmBoxIdFromDid}">
                            <params>
                                <param name="password" value="NO_SIP_AUTH"/> <param name="vm-password" value="${voicemailPin}"/>
                            </params>
                            <variables>
                                <variable name="user_context" value="default"/>
                                <variable name="domain_name" value="${tenant.domain_name}"/>
                                <variable name="domain" value="${tenant.domain_name}"/>
                                ${voicemailEmail ? `<variable name="email_address" value="${voicemailEmail}"/>` : ''}
                                <variable name="effective_caller_id_name" value="${didVm.did_number} Voicemail"/>
                                <variable name="effective_caller_id_number" value="${didVm.did_number}"/>
                            </variables>
                        </user>
                    `;
                }
            }
        }

        // If no user/mailbox was found after all checks
        if (!userXml) {
            console.log(`INFO: No directory entry found for "${userNumber}" in domain "${domain}". Returning empty XML.`);
            return `<document type="freeswitch/xml"/>`;
        }

        // Construct the full XML response document
        const response = `
            <document type="freeswitch/xml">
                <section name="directory">
                    <domain name="${domain}">
                        <params>
                            <param name="dial-string" value="{presence_id=\${dialed_user}@\${dialed_domain}}\${sofia_contact(\${dialed_user}@\${dialed_domain})}"/>
                        </params>
                        ${userXml}
                    </domain>
                </section>
            </document>
        `;

        console.log(response);
        console.log('-------------------------DIRECTORY XML END------------------------------------');
        return response;
    }
};

module.exports = directoryController;