// controllers/dialplanController.js

// --- START: Imports ---
const xmlGenerator = require("../utils/xmlGenerator");
const tenantService = require("../services/tenantService"); // IMPORTED
const globalConfigService = require("../services/globalConfigService"); // IMPORTED
const signalwireService = require("../services/signalwireService")
// --- END: Imports ---

// --- START: Inlined Constants ---
const SIGNALWIRE_TRUNK_PROFILE_NAME = "signalwire";
const IVR_SOUND_PATH_INVALID_DOMAIN = "ivr/ivr-call_cannot_be_completed_as_dialed.wav";
const IVR_SOUND_PATH_CALL_CANNOT_BE_COMPLETED = "ivr/ivr-call_cannot_be_completed_as_dialed.wav";
const IVR_SOUND_PATH_INVALID_ENTRY = "ivr/ivr-that_was_an_invalid_entry.wav";
const VOICEMAIL_CHECK_EXTENSION = "*98";
// --- END: Inlined Constants ---

// --- START: Inlined Utility Functions ---
function extractDomain(s) {
    if (!s) return null;
    const match = s.match(/@([^ >]+)/);
    return match ? match[1] : null;
}

function normalizeStringForComparison(str) {
    if (!str) return "";
    return String(str)
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
}

function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
        return ""; // Handle null/undefined input gracefully
    }
    let normalized = String(phoneNumber).trim();

    // Strip '+1' prefix if present
    if (normalized.startsWith("+1")) {
        normalized = normalized.substring(2);
        console.log(`DEBUG: Stripped '+1' prefix. Result: ${normalized}`);
    }

    // Optionally, strip all non-digit characters if you only want pure digits
    // For Caller ID, often you want to preserve internal prefixes or special characters,
    // so this is usually left out unless specifically required to match a pure digit extension.
    // normalized = normalized.replace(/\D/g, '');

    return normalized;
}

function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// --- END: Inlined Utility Functions ---

// --- DATA ACCESS PLACEHOLDERS REMOVED FROM HERE ---
// The functions getTenantByDomain and getAllExternalGateways are now in their respective service files.

/**
 * Common fallback for when no specific route is found.
 * @param {string} destination - The original destination number.
 * @returns {Object} A structured extension object for XML generation.
 */
const getNoMatchFallback = (destination) => {
    console.log(`No specific route matched for destination: ${destination}. Using invalid extension fallback.`);
    return {
        name: "invalid_extension_fallback",
        condition_field: "destination_number",
        expression: `^${escapeRegExp(destination)}$`,
        actions: [{ application: "answer" }, { application: "playback", data: IVR_SOUND_PATH_INVALID_ENTRY }, { application: "hangup" }],
    };
};

/**
 * Handles incoming calls (typically from 'public' context or DID matches in 'default').
 * @param {Object} body - FreeSWITCH request body.
 * @param {Object} tenant - Tenant data.
 * @param {string} domain - Domain name.
 * @param {string} effectiveDestination - The number being routed (can be DID or `destination_number`).
 * @returns {Promise<Object|null>} Structured extension object if matched, null otherwise.
 */
async function handleInboundCall(body, domain, effectiveDestination) {
    console.log(`INFO: Attempting to handle as inbound call for DID: ${effectiveDestination}`);
    console.log(`INCOMING_DEBUG_HANDLER: Effective Destination being checked: "${effectiveDestination}"`);

    // Lookup cnam
    const cnamData = await signalwireService.lookupCnam(body["Caller-Caller-ID-Number"])

    let effectiveCallerIdName;

    if(cnamData){
        effectiveCallerIdName = `${cnamData.national_number_formatted}, ${cnamData.cnam.caller_id}, ${cnamData.location}` 
    } else {
        effectiveCallerIdName = body["Caller-Caller-ID-Name"];
    }

    let effectiveCallerIdNumber = body["Caller-Caller-ID-Number"];
    

    // Apply normalization to the incoming caller ID number
    effectiveCallerIdNumber = normalizePhoneNumber(effectiveCallerIdNumber);
    effectiveCallerIdName = normalizePhoneNumber(effectiveCallerIdName);

    tenant = await tenantService.getTenantAndDidByDidNumber(effectiveDestination);

    let actions = [];
    // Set and Export Caller ID Name and Number for both A and B legs
    actions.push({ application: "set", data: `caller_id_name=${effectiveCallerIdName}` });
    actions.push({ application: "export", data: `caller_id_name=${effectiveCallerIdName}` });

    actions.push({ application: "set", data: `caller_id_number=${effectiveCallerIdNumber}` });
    actions.push({ application: "export", data: `caller_id_number=${effectiveCallerIdNumber}` });

    actions.push({ application: "set", data: `effective_caller_id_name=${effectiveCallerIdName}` });
    actions.push({ application: "export", data: `effective_caller_id_name=${effectiveCallerIdName}` });

    actions.push({ application: "set", data: `effective_caller_id_number=${effectiveCallerIdNumber}` });
    actions.push({ application: "export", data: `effective_caller_id_number=${effectiveCallerIdNumber}` });

    // --- CRITICAL ADDITIONS: SET AND EXPORT SIP-SPECIFIC VARIABLES ---
    if (tenant && tenant.domain_name) {
        console.log(`DEBUG: Setting and exporting sip_invite_domain and sip_from_host to tenant domain: ${tenant.domain_name}`);

        actions.push({ application: "set", data: `sip_invite_domain=${tenant.domain_name}` });
        actions.push({ application: "export", data: `sip_invite_domain=${tenant.domain_name}` }); // <-- EXPORT IT!

        actions.push({ application: "set", data: `sip_from_host=${tenant.domain_name}` });
        actions.push({ application: "export", data: `sip_from_host=${tenant.domain_name}` }); // <-- EXPORT IT!

        // These variables are often helpful for explicitly controlling the SIP From header
        actions.push({ application: "set", data: `sip_from_user=${effectiveCallerIdNumber}` });
        actions.push({ application: "export", data: `sip_from_user=${effectiveCallerIdNumber}` }); // <-- EXPORT IT!

        actions.push({ application: "set", data: `sip_from_display=${effectiveCallerIdName}` });
        actions.push({ application: "export", data: `sip_from_display=${effectiveCallerIdName}` }); // <-- EXPORT IT!

        actions.push({ application: "set", data: `sip_from_uri=${effectiveCallerIdNumber}@${tenant.domain_name}` });
        actions.push({ application: "export", data: `sip_from_uri=${effectiveCallerIdNumber}@${tenant.domain_name}` }); // <-- EXPORT IT!
    } else {
        console.warn(`WARN: Tenant or tenant.domain_name not available. Cannot set correct SIP domain for outbound leg.`);
    }

    console.log(`INCOMING_DEBUG_HANDLER: Tenant's DIDs for comparison:`, tenant.dids);

    // IMPORTANT: Normalize effectiveDestination to match your stored DID format if necessary.
    // Your DB stores "+15125471930". So, if FreeSWITCH sends "5125471930", you need to prefix it.
    // Or, if FreeSWITCH always sends the +1 format, then no normalization is needed on effectiveDestination.
    // Let's assume for now FreeSWITCH sends "+15125471930" or "5125471930" and we want to match exactly.
    // Given your DB has +1, it's safest to ensure effectiveDestination also has +1 for comparison.
    // Add defensive check for effectiveDestination type.
    let normalizedEffectiveDestination = String(effectiveDestination); // Ensure it's a string

    // Example normalization: if it's 10 digits and doesn't start with '+1', add '+1'
    if (normalizedEffectiveDestination.match(/^\d{10}$/)) {
        normalizedEffectiveDestination = `+1${normalizedEffectiveDestination}`;
        console.log(`INCOMING_DEBUG_HANDLER: Normalized 10-digit effectiveDestination to E.164: ${normalizedEffectiveDestination}`);
    }

    // FIX HERE: Change 'did.number' to 'did.did_number'
    const matchedDid = tenant.dids?.find((did) => {
        console.log(`INCOMING_DEBUG_HANDLER: Comparing stored DID "${did.did_number}" with normalized incoming DID "${normalizedEffectiveDestination}"`);
        return did.did_number === normalizedEffectiveDestination;
    });

    if (matchedDid) {
        console.log(`INCOMING_DEBUG_HANDLER: !!! Successfully Matched DID: ${matchedDid.did_number}. Routing to ${matchedDid.routing_type}: ${matchedDid.routing_target}`);
        let routingApplication = "";
        let routingData = "";
        let targetFound = false;
        actions.push({ application: "set", data: "continue_on_fail=true" });
        actions.push({ application: "set", data: "hangup_after_bridge=true" });

        // FIX HERE: Change 'matchedDid.routing_target_type' to 'matchedDid.routing_type'
        if (matchedDid.routing_type === "extension") {
            // FIX HERE: Change 'matchedDid.routing_target_id' to 'matchedDid.routing_target'
            const targetExtension = tenant.sip_clients.find((client) => client.user_id === matchedDid.routing_target);
            if (targetExtension) {
                routingApplication = "bridge";
                routingData = `user/${targetExtension.user_id}@${tenant.domain_name}`;
                targetFound = true;
                console.log(`INCOMING_DEBUG_HANDLER: Routing to extension: ${routingData}`);
            } else {
                console.warn(`INCOMING_DEBUG_HANDLER: Target extension ${matchedDid.routing_target} not found for DID ${matchedDid.did_number}`);
            }
        } else if (matchedDid.routing_type === "group") {
            const targetGroup = tenant.groups.find((group) => group.name === matchedDid.routing_target);
            if (targetGroup) {
                routingApplication = "bridge";
                const membersBridgeStrings = targetGroup.members.map((member) => `user/${member.user_id}@${tenant.domain_name}`);
                routingData = targetGroup.type === "hunt" ? membersBridgeStrings.join("|") : membersBridgeStrings.join(",");
                targetFound = true;
                console.log(`INCOMING_DEBUG_HANDLER: Routing to group: ${routingData}`);
            } else {
                console.warn(`INCOMING_DEBUG_HANDLER: Target group ${matchedDid.routing_target} not found for DID ${matchedDid.did_number}`);
            }
            // FIX HERE: Change 'matchedDid.routing_target_type' to 'matchedDid.routing_type'
        } else if (matchedDid.routing_type === "ivr") {
            routingApplication = "transfer";
            // FIX HERE: Change 'matchedDid.routing_target_id' to 'matchedDid.routing_target'
            routingData = `${matchedDid.routing_target} XML ${tenant.domain_name}_ivr_context`;
            targetFound = true;
            console.log(`INCOMING_DEBUG_HANDLER: Routing DID to IVR: ${matchedDid.routing_target}`);
            // FIX HERE: Change 'matchedDid.routing_target_type' to 'matchedDid.routing_type'
        } else {
            // 'custom' or other types
            routingApplication = "transfer";
            // FIX HERE: Change 'matchedDid.routing_target_id' to 'matchedDid.routing_target'
            routingData = matchedDid.routing_target;
            targetFound = true;
            console.warn(`INCOMING_DEBUG_HANDLER: DID routing to custom target: ${matchedDid.routing_target}. Handling as generic transfer.`);
        }

        if (targetFound) {
            actions.push({ application: routingApplication, data: routingData });
            if (matchedDid.failover_routing_type === "dialplan_extension" && matchedDid.failover_routing_target) {
                console.log(`INCOMING_DEBUG_HANDLER: Adding failover to: ${matchedDid.failover_routing_target}`);
                actions.push({ application: "log", data: `INFO Primary DID route for ${matchedDid.did_number} failed. Attempting failover.` });
                if (matchedDid.failover_routing_target.startsWith("voicemail_")) {
                    const vmBoxId = matchedDid.failover_routing_target.substring("voicemail_".length);
                    console.log(`DEBUG: DID failover to specific voicemail box: ${vmBoxId}`);
                    actions.push({ application: "answer", data: "" }); // Essential for external DIDs before voicemail
                    actions.push({ application: "sleep", data: "1000" }); // Short pause before voicemail greeting
                    actions.push({ application: "voicemail", data: `default ${tenant.domain_name} ${vmBoxId}` }); // Direct voicemail application
                    actions.push({ application: "log", data: `INFO Sent DID call to voicemail for ${vmBoxId}. Originate Disposition: \${originate_disposition}` });
                    actions.push({ application: "hangup", data: "" });
                }
            } else {

                console.log(`INCOMING_DEBUG_HANDLER: No specific failover or failover type not 'dialplan_extension'. Adding generic hangup fallback.`);
                actions.push({ application: "answer", data: "" }); // Answer before playback for better UX on hangup
                actions.push({ application: "playback", data: IVR_SOUND_PATH_CALL_CANNOT_BE_COMPLETED });
                actions.push({ application: "hangup", data: "" });
            }

            return {
                name: `did_inbound_${matchedDid.did_number.replace(/[^a-zA-Z0-9\+]/g, "")}`, // Sanitize name, keep '+'
                condition_field: "destination_number",
                expression: `^${escapeRegExp(effectiveDestination)}$`,
                actions: actions,
            };
        } else {
            console.log(`INCOMING_DEBUG_HANDLER: DID target ${matchedDid.routing_type}: ${matchedDid.routing_target} not found or invalid for DID ${matchedDid.did_number}.`);
            return null;
        }
    } else {
        console.log(`INCOMING_DEBUG_HANDLER: No DID match found for effectiveDestination: ${effectiveDestination}`);
    }
    return null;
}

/**
 * Handles outbound calls (routing to external PSTN gateways).
 * @param {Object} body - FreeSWITCH request body.
 * @param {string} effectiveDestination - The number being dialed.
 * @returns {Promise<Object|null>} Structured extension object if matched, null otherwise.
 */
async function handleOutboundCall(body, effectiveDestination) {
    console.log(`INFO: Attempting to handle as outbound call for: ${effectiveDestination}`);
    const pstnRegex = /^(\+?1?)?(\d{10})$/;
    const match = effectiveDestination.match(pstnRegex);

    if (match) {
        // --- CALLING THE SERVICE ---
        const globalGateways = await globalConfigService.getAllExternalGateways();
        // --- END SERVICE CALL ---

        if (globalGateways && globalGateways.length > 0) {
            const targetGateway = globalGateways[0];
            console.log(`Matched outbound PSTN number: ${effectiveDestination}. Routing via global gateway: ${targetGateway.name}`);
            const raw10DigitNumber = match[2];
            const formattedNumberForTrunk = `+1${raw10DigitNumber}`;

            return {
                name: `outbound_pstn_${raw10DigitNumber}`,
                condition_field: "destination_number",
                expression: `^${escapeRegExp(effectiveDestination)}$`,
                actions: [
                    { application: "bridge", data: `sofia/gateway/${SIGNALWIRE_TRUNK_PROFILE_NAME}/${formattedNumberForTrunk}` },
                    { application: "playback", data: IVR_SOUND_PATH_CALL_CANNOT_BE_COMPLETED },
                    { application: "hangup", data: "" },
                ],
            };
        } else {
            console.warn(`No global external gateways configured to route outbound call: ${effectiveDestination}`);
        }
    }
    return null;
}

/**
 * Handles local (internal) calls within a tenant's domain.
 * @param {Object} body - FreeSWITCH request body.
 * @param {Object} tenant - Tenant data.
 * @param {string} domain - Domain name.
 * @param {string} effectiveDestination - The number/extension being dialed.
 * @returns {Promise<Object|null>} Structured extension object if matched, null otherwise.
 */
const handleLocalCall = async (body, tenant, domain, effectiveDestination) => {
    console.log(`INFO: Attempting to handle as local call for: ${effectiveDestination}`);
    // Log the entire incoming request body (keep this for future debugging if needed)
    // console.log("DEBUG: Incoming body for handleLocalCall:", JSON.stringify(body, null, 2));

    const dialedTargetIdentifier = effectiveDestination.includes("@") ? effectiveDestination.split("@")[0] : effectiveDestination;
    const normalizedEffectiveDestination = normalizeStringForComparison(effectiveDestination);

    const actions = [];

    // --- Determine Caller ID for Local Calls ---
    let callerIdName = tenant.profile.defaultCallerID?.name || "Anonymous";
    let callerIdNumber = tenant.profile.defaultCallerID?.number || "0000000000";

    // --- FIX: Use 'Caller-Caller-ID-Number' from the body ---
    // This is the key FreeSWITCH is actually sending for the originating number
    const originatingCallerIdNumberFromFS = body["Caller-Caller-ID-Number"];

    console.log(`DEBUG: Looking for originating SIP client using Caller-Caller-ID-Number from FreeSWITCH: "${originatingCallerIdNumberFromFS}" (type: ${typeof originatingCallerIdNumberFromFS})`);

    if (!tenant) {
        console.warn(`WARN: Tenant not found for domain: ${domain}. Cannot find originating SIP client.`);
    } else if (!tenant.sip_clients) {
        console.warn(`WARN: Tenant found, but tenant.sip_clients array is missing or null. Cannot find originating SIP client.`);
    } else {
        console.log(`DEBUG: Tenant has ${tenant.sip_clients.length} SIP clients loaded.`);
        // Optional: Log some of the available SIP client user_ids for comparison
        // if (tenant.sip_clients.length > 0) {
        //     console.log("DEBUG: First 5 loaded SIP client user_ids (normalized):");
        //     tenant.sip_clients.slice(0, 5).forEach(client => {
        //         console.log(`  - "${normalizeStringForComparison(client.user_id)}"`);
        //     });
        // }
    }

    // Use the extracted originatingCallerIdNumberFromFS for the lookup
    const originatingSipClient = tenant.sip_clients?.find((client) => {
        const normalizedClientUserId = normalizeStringForComparison(client.user_id);
        const normalizedOriginatingCallerIdNumber = normalizeStringForComparison(originatingCallerIdNumberFromFS); // Use the new variable

        // console.log(`DEBUG: Comparing Normalized Client ID "${normalizedClientUserId}" with Normalized Incoming ID "${normalizedOriginatingCallerIdNumber}"`);

        return normalizedClientUserId === normalizedOriginatingCallerIdNumber;
    });

    if (originatingSipClient) {
        console.log(`DEBUG: Originating SIP client identified: ${originatingSipClient.user_id}`);

        if (originatingSipClient.local_caller_id_name) {
            callerIdName = originatingSipClient.local_caller_id_name;
            console.log(`DEBUG: Set Caller ID Name from SIP client local_caller_id_name: ${callerIdName}`);
        } else if (originatingSipClient.display_name) {
            callerIdName = originatingSipClient.display_name;
            console.log(`DEBUG: Set Caller ID Name from SIP client display_name: ${callerIdName}`);
        } else {
            callerIdName = originatingSipClient.user_id;
            console.log(`DEBUG: Set Caller ID Name from SIP client user_id: ${callerIdName}`);
        }

        callerIdNumber = originatingSipClient.user_id;
        console.log(`DEBUG: Set Caller ID Number to SIP client user_id: ${callerIdNumber}`);
    } else {
        console.log(`DEBUG: Originating SIP client not found. Falling back to tenant default Caller ID.`);
        console.log(`DEBUG: FreeSWITCH sent Caller-Caller-ID-Number as "${originatingCallerIdNumberFromFS}". Ensure this matches a sip_client.user_id in your database.`);
    }

    actions.push({ application: "set", data: `caller_id_name=${callerIdName}` });
    actions.push({ application: "set", data: `caller_id_number=${callerIdNumber}` });
    actions.push({ application: "set", data: `effective_caller_id_name=${callerIdName}` });
    actions.push({ application: "set", data: `effective_caller_id_number=${callerIdNumber}` });

    // ... (rest of your handleLocalCall function remains the same) ...

    // Rule 1: System extensions (*98 for voicemail)
    if (dialedTargetIdentifier === VOICEMAIL_CHECK_EXTENSION) {
        console.log("Matched system voicemail extension (*98)");
        actions.push({ application: "answer" });
        actions.push({ application: "sleep", data: "1000" });
        actions.push({ application: "voicemail", data: `check default ${tenant.domain_name}` });
        actions.push({ application: "hangup", data: "" });
        return {
            name: "check_voicemail",
            condition_field: "destination_number",
            expression: `^${escapeRegExp(effectiveDestination)}$`,
            actions: actions,
        };
    }

    // Rule 2: Check for Hunt/Ring Groups
    const matchedGroup = tenant.groups?.find((group) => group.name === effectiveDestination);
    if (matchedGroup) {
        console.log(`Matched group: ${matchedGroup.name} (Type: ${matchedGroup.type})`);
        const membersBridgeStrings = matchedGroup.members.map((member) => `user/${member.user_id}@${tenant.domain_name}`);
        const bridgeTarget = matchedGroup.type === "hunt" ? membersBridgeStrings.join("|") : membersBridgeStrings.join(",");
        const bridgeTimeout = matchedGroup.timeout ? `timeout=${matchedGroup.timeout},` : "";

        actions.push({ application: "set", data: "continue_on_fail=true" });
        actions.push({ application: "set", data: "hangup_after_bridge=true" });
        actions.push({ application: "bridge", data: `${bridgeTimeout}${bridgeTarget}` });

        if (matchedGroup.enable_voicemail && matchedGroup.voicemail_box_id) {
            console.log(`INFO: Adding voicemail fallback for group ${matchedGroup.name} to box ${matchedGroup.voicemail_box_id}`);
            actions.push({ application: "answer", data: "" });
            actions.push({ application: "sleep", data: "1000" });
            actions.push({ application: "voicemail", data: `default ${tenant.domain_name} ${matchedGroup.voicemail_box_id}` });
            actions.push({ application: "log", data: `INFO Sent call to group voicemail for ${matchedGroup.name}. Originate Disposition: \${originate_disposition}` });
            actions.push({ application: "hangup", data: "" });
        } else if (matchedGroup.no_answer_action && matchedGroup.no_answer_action.application) {
            actions.push(matchedGroup.no_answer_action);
        } else {
            console.log(`INFO: No specific failover or voicemail for group ${matchedGroup.name}. Playing fallback message.`);
            actions.push({ application: "answer", data: "" });
            actions.push({ application: "playback", data: IVR_SOUND_PATH_CALL_CANNOT_BE_COMPLETED });
            actions.push({ application: "hangup", data: "" });
        }
        return {
            name: `group_${matchedGroup.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
            condition_field: "destination_number",
            expression: `^${escapeRegExp(effectiveDestination)}$`,
            actions: actions,
        };
    }

    // Rule 3: Explicit dialplan extensions (from tenant.dialplan.default)
    const matchedExplicitExtension = tenant.dialplan?.default?.find((ext) => ext.condition_field === "destination_number" && new RegExp(ext.condition_expression).test(effectiveDestination));
    if (matchedExplicitExtension) {
        console.log(`Matched explicit dialplan extension: ${matchedExplicitExtension.name}`);
        actions.push(...matchedExplicitExtension.actions);
        return {
            name: matchedExplicitExtension.name,
            condition_field: matchedExplicitExtension.condition_field,
            expression: matchedExplicitExtension.condition_expression,
            actions: actions,
        };
    }

    // Rule 4: Direct SIP Client (User) extension - lowest internal routing priority
    const sipClient = tenant.sip_clients?.find((client) => normalizeStringForComparison(client.user_id) === normalizedEffectiveDestination);
    if (sipClient) {
        console.log(`Matched direct SIP client: ${sipClient.user_id}`);
        const callTimeout = sipClient?.no_answer_timeout || 30;

        actions.push({ application: "export", data: `dialed_extension=${sipClient.user_id}` });
        actions.push({ application: "log", data: `INFO Dialing extension ${sipClient.user_id} in domain ${tenant.domain_name}` });
        actions.push({ application: "set", data: `user_exists=\${user_exists(${sipClient.user_id}@${tenant.domain_name})}` });
        actions.push({ application: "log", data: `INFO user_exists for ${sipClient.user_id}@${tenant.domain_name}: \${user_exists}` });
        actions.push({ application: "export", data: `sip_invite_domain=${tenant.domain_name}` });
        actions.push({ application: "export", data: `sip_invite_user=${sipClient.user_id}` });
        actions.push({ application: "bind_meta_app", data: "1 b s execute_extension::dx XML features" });
        actions.push({ application: "bind_meta_app", data: "2 b s record_session::${recordings_dir}/${caller_id_number}.${strftime(%Y-%m-%d-%H-%M-%S)}.wav" });
        actions.push({ application: "bind_meta_app", data: "3 b s execute_extension::cf XML features" });
        actions.push({ application: "bind_meta_app", data: "4 b s execute_extension::att_xfer XML features" });
        actions.push({ application: "set", data: "ringback=${us-ring}" });
        actions.push({ application: "set", data: "transfer_ringback=${hold_music}" });
        actions.push({ application: "set", data: `call_timeout=${callTimeout}` });
        actions.push({ application: "set", data: "hangup_after_bridge=true" });
        actions.push({ application: "set", data: "continue_on_fail=true" });
        actions.push({ application: "hash", data: `insert/\${domain_name}-call_return/${sipClient.user_id}/\${caller_id_number}` });
        actions.push({ application: "hash", data: `insert/\${domain_name}-last_dial_ext/${sipClient.user_id}/\${uuid}` });
        actions.push({ application: "set", data: `called_party_callgroup=\${user_data(${sipClient.user_id}@\${domain_name} var callgroup)}` });
        actions.push({ application: "hash", data: `insert/\${domain_name}-last_dial_ext/\${called_party_callgroup}/\${uuid}` });
        actions.push({ application: "hash", data: `insert/\${domain_name}-last_dial_ext/global/\${uuid}` });
        actions.push({ application: "hash", data: `insert/\${domain_name}-last_dial/\${called_party_callgroup}/\${uuid}` });
        actions.push({ application: "bridge", data: `user/${sipClient.user_id}@${tenant.domain_name}` });

        if (sipClient.enable_voicemail) {
            console.log(`INFO: Adding voicemail fallback for SIP client ${sipClient.user_id}`);
            actions.push({ application: "answer", data: "" });
            actions.push({ application: "sleep", data: "1000" });
            actions.push({ application: "voicemail", data: `default ${tenant.domain_name} ${sipClient.user_id}` });
            actions.push({ application: "log", data: `INFO Sent call to voicemail for ${sipClient.user_id}. Originate Disposition: \${originate_disposition}` });
            actions.push({ application: "hangup", data: "" });
        } else {
            console.log(`INFO: Voicemail not enabled for SIP client ${sipClient.user_id}. Playing fallback message.`);
            actions.push({ application: "answer", data: "" });
            actions.push({ application: "playback", data: IVR_SOUND_PATH_CALL_CANNOT_BE_COMPLETED });
            actions.push({ application: "hangup", data: "" });
        }

        return {
            name: `sip_client_${sipClient.user_id.replace(/[^a-zA-Z0-9]/g, "_")}`,
            condition_field: "destination_number",
            expression: `^${escapeRegExp(effectiveDestination)}$`,
            actions: actions,
        };
    }

    // Rule 5: Outbound Dialing (if destination_number looks like an external number)
    if (/^\+?\d{10,15}$/.test(effectiveDestination)) {
        console.log(`INFO: Routing local call to external number: ${effectiveDestination}`);
        actions.push({ application: "bridge", data: `sofia/gateway/signalwire/${effectiveDestination}` });
        actions.push({ application: "hangup", data: "" });
        return {
            name: `outbound_${effectiveDestination.replace(/\D/g, "_")}`,
            condition_field: "destination_number",
            expression: `^${escapeRegExp(effectiveDestination)}$`,
            actions: actions,
        };
    }

    // Fallback: If no specific rule matches, play a message and hangup
    console.log(`INFO: No specific local call rule matched for destination: ${effectiveDestination}. Playing fallback message.`);
    actions.push({ application: "answer", data: "" });
    actions.push({ application: "playback", data: IVR_SOUND_PATH_CALL_CANNOT_BE_COMPLETED });
    actions.push({ application: "hangup", data: "" });

    return {
        name: `fallback_local_call`,
        condition_field: "destination_number",
        expression: `^${escapeRegExp(effectiveDestination)}$`,
        actions: actions,
    };
};

const dialplanController = {
    /**
     * Main entry point for FreeSWITCH XML-Curl dialplan lookups.
     * Orchestrates call routing based on context and destination number.
     * @param {Object} body - The raw request body from FreeSWITCH XML-Curl.
     * @returns {Promise<string>} The FreeSWITCH XML dialplan response.
     */
    lookup: async (body) => {
        console.log("-----------------Dialplan query------------------");
        console.log("FreeSWITCH Request Body:", JSON.stringify(body, null, 2));

        const domain = body.domain || body.variable_domain_name || body.variable_sip_to_host;

        const requestedContext = body["Caller-Context"] || body.variable_dialplan_context || "default";
        const destination = body["Caller-Destination-Number"] || body.destination_number;

        const fromDomain = extractDomain(body["Caller-Channel-Name"]);
        const effectiveDestination = body.variable_signalwire_actual_did || destination;

        let matchedExtension = null;
        let finalContext = requestedContext;

        try {
            // --- CALLING THE TENANT SERVICE ---
            const tenant = await tenantService.getTenantByDomain(domain);
            // --- END SERVICE CALL ---

            if (!tenant && requestedContext !== "public") {
                console.log(`Tenant not found for domain: ${domain}.`);
                matchedExtension = {
                    name: "no_tenant_found",
                    condition_field: "destination_number",
                    expression: `^${escapeRegExp(effectiveDestination)}$`,
                    actions: [
                        { application: "answer", data: "" },
                        { application: "playback", data: IVR_SOUND_PATH_INVALID_DOMAIN },
                        { application: "hangup", data: "" },
                    ],
                };
            } else if (requestedContext === "public") {
                const actualDidFromTrunk = body.variable_sip_to_user || body.variable_sip_dest_user;

                if (actualDidFromTrunk) {
                    console.log(`INFO: Incoming call in 'public' context. Actual DID: ${actualDidFromTrunk}. Transferring to default context.`);
                    matchedExtension = await handleInboundCall(body, domain, actualDidFromTrunk);
                } else {
                    console.log(`WARNING: Incoming call in 'public' context but no actual DID found. Hanging up.`);
                    matchedExtension = {
                        name: `public_no_did_found`,
                        condition_field: "destination_number",
                        expression: `^${escapeRegExp(destination)}$`,
                        actions: [
                            { application: "answer", data: "" },
                            { application: "playback", data: IVR_SOUND_PATH_CALL_CANNOT_BE_COMPLETED },
                            { application: "hangup", data: "NORMAL_CLEARING" },
                        ],
                    };
                }
            } else if (requestedContext === "default") {
                if (fromDomain && domain && normalizeStringForComparison(domain) !== normalizeStringForComparison(fromDomain)) {
                    console.log(`Blocking inter-domain call: From ${fromDomain} to ${domain}`);
                    matchedExtension = {
                        name: "block-interdomain-call",
                        condition_field: "destination_number",
                        expression: `^${escapeRegExp(effectiveDestination)}$`,
                        actions: [{ application: "hangup", data: "CALL_REJECTED" }],
                    };
                }

                if (!matchedExtension) {
                    matchedExtension = await handleOutboundCall(body, effectiveDestination);
                }

                if (!matchedExtension) {
                    matchedExtension = await handleLocalCall(body, tenant, domain, effectiveDestination);
                }

                if (!matchedExtension) {
                    matchedExtension = getNoMatchFallback(effectiveDestination);
                }
            } else {
                console.warn(`WARNING: Request for unhandled context "${requestedContext}".`);
                matchedExtension = getNoMatchFallback(destination);
            }

            const xmlResponse = xmlGenerator.generateDialplanXml(finalContext, matchedExtension, body);

            return xmlResponse;
        } catch (error) {
            console.error("Error processing dialplan request:", error);
            return xmlGenerator.generateErrorXml(body["Caller-Destination-Number"]);
        }
    },
};

module.exports = dialplanController;
