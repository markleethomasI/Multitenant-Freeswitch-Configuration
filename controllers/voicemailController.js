const tenantService = require('../services/tenantService');

/**
 * Handles FreeSWITCH voicemail lookups via mod_xml_curl.
 * This endpoint provides voicemail-specific information (like vm-password and email)
 * for mailboxes associated with SIP clients, groups, or DIDs.
 *
 * FreeSWITCH sends a POST request with parameters like:
 * - domain: The domain the voicemail lookup is for.
 * - user: The mailbox ID being looked up (e.g., '1001', 'sales_vm', '5125471930').
 *
 * @param {Object} body - The request body from FreeSWITCH.
 * @returns {string} The XML document containing voicemail parameters.
 */
const lookup = async (body) => {
    const { domain, user: mailboxId } = body; // Rename 'user' to 'mailboxId' for clarity

    console.log(`INFO: Voicemail lookup request for mailbox ID: "${mailboxId}" in domain: "${domain}"`);
    console.log('------------------------VOICEMAIL XML Provided------------------------------------');

    if (!domain || !mailboxId) {
        console.warn("WARN: Missing domain or mailbox ID in voicemail lookup request. Returning empty XML.");
        return `<document type="freeswitch/xml"></document>`;
    }

    // Fetch the tenant and all its associated data (SIP clients, groups, DIDs).
    // This relies on tenantService.getTenantByDomain populating these arrays.
    const tenant = await tenantService.getTenantByDomain(domain);

    if (!tenant) {
        console.warn(`WARN: Tenant not found for domain: "${domain}". Returning empty XML.`);
        return `<document type="freeswitch/xml"></document>`;
    }

    let userXml = ''; // This will hold the generated <user> XML snippet
    let voicemailPin = null;
    let voicemailEmail = null;
    let effectiveMailboxId = mailboxId; // Use this for the mailbox="" attribute if different from user ID
    let currentMatchName = null; // To help with logging/debugging

    // --- Lookup Priority to find the mailbox's details ---

    // 1. Check SIP Clients (mailboxId might be a SIP user_id)
    const sipClient = tenant.sip_clients?.find(client => client.enable_voicemail && client.user_id === mailboxId);
    if (sipClient) {
        console.log(`DEBUG: Matched SIP client for voicemail: ${sipClient.user_id}`);
        voicemailPin = sipClient.voicemail_pin || '0000';
        voicemailEmail = sipClient.voicemail_email;
        currentMatchName = `SIP Client (${sipClient.user_id})`;
        effectiveMailboxId = mailboxId; // For SIP clients, ID and mailbox ID are usually the same
    }

    // 2. Check Group Voicemail Boxes (mailboxId might be a group's voicemail_box_id)
    if (!userXml) { // Only proceed if no match yet
        const groupVm = tenant.groups?.find(group =>
            group.enable_voicemail && group.voicemail_box_id === mailboxId
        );
        if (groupVm) {
            console.log(`DEBUG: Matched Group Voicemail Box: "${groupVm.voicemail_box_id}" for group "${groupVm.name}"`);
            voicemailPin = groupVm.voicemail_pin || '0000';
            voicemailEmail = groupVm.group_email;
            currentMatchName = `Group VM (${groupVm.name})`;
            effectiveMailboxId = mailboxId; // For group VM, ID and mailbox ID are usually the same
        }
    }

    // 3. Check DID Voicemail Boxes (mailboxId might be a DID number or a specific vm_box_id from DID config)
    if (!userXml) { // Only proceed if no match yet
        const didVm = tenant.dids?.find(did =>
            did.failover_routing_type === "dialplan_extension" &&
            did.failover_routing_target &&
            did.failover_routing_target.startsWith("voicemail_") &&
            (did.did_number === mailboxId || did.failover_routing_target.substring("voicemail_".length) === mailboxId)
        );
        if (didVm) {
            // This is the variable that was causing the issue, now correctly scoped
            let didActualVmBoxId = didVm.failover_routing_target.substring("voicemail_".length);
            console.log(`DEBUG: Matched DID Voicemail Box: "${mailboxId}" (actual mailbox ID: ${didActualVmBoxId})`);
            voicemailPin = didVm.voicemail_pin || '0000';
            voicemailEmail = didVm.voicemail_email;
            currentMatchName = `DID VM (${didVm.did_number})`;
            effectiveMailboxId = didActualVmBoxId; // The mailbox attribute should point to this actual ID
        }
    }


    // If a match was found and we have a voicemail PIN, construct the XML response
    if (voicemailPin !== null) {
        userXml = `
            <user id="${mailboxId}" ${mailboxId !== effectiveMailboxId ? `mailbox="${effectiveMailboxId}"` : ''}>
                <params>
                    <param name="vm-password" value="${voicemailPin}" />
                </params>
                <variables>
                    <variable name="user_context" value="default" />
                    ${voicemailEmail ? `<variable name="email_address" value="${voicemailEmail}"/>` : ''}
                    <variable name="effective_caller_id_name" value="${currentMatchName || mailboxId} Voicemail"/>
                    <variable name="effective_caller_id_number" value="${mailboxId}"/>
                </variables>
            </user>
        `;
    }


    // Final XML document construction
    if (userXml) {
        const xmlResponse = `
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="${domain}">
      ${userXml}
    </domain>
  </section>
</document>`;
        console.log(xmlResponse);
        console.log('-------------------------VOICEMAIL XML END------------------------------------');
        return xmlResponse;
    } else {
        console.log(`INFO: No voicemail box found for mailbox ID: "${mailboxId}" in domain: "${domain}". Returning empty XML.`);
        return `<document type="freeswitch/xml"></document>`;
    }
};

module.exports = {
    lookup,
};