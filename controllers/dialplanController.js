// controllers/dialplanController.js
// Handles FreeSWITCH dialplan XML-Curl requests, fetching data from tenantService.

const tenantService = require('../services/tenantService');

/**
 * Extracts the domain from a SIP URI or channel name.
 * @param {string} s - The string to extract the domain from (e.g., "sip:user@domain.com", "sofia/internal/user@domain.com").
 * @returns {string|null} The extracted domain name, or null if not found.
 */
function extractDomain(s) {
    const match = s.match(/@([^ >]+)/);
    return match ? match[1] : null;
}

/**
 * Normalizes a string for comparison by converting to lowercase and
 * removing all non-alphanumeric characters. This creates a canonical form
 * to match against user_ids that might have variations in spacing/special chars
 * between FreeSWITCH's input and the database.
 * @param {string} str - The string to normalize.
 * @returns {string} The normalized string.
 */
function normalizeStringForComparison(str) {
    if (!str) return '';
    // Remove all non-alphanumeric characters (including spaces, hyphens, dots)
    // and convert to lowercase.
    return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}


const dialplanController = {
  /**
   * Handles FreeSWITCH XML-Curl dialplan lookup requests.
   * Retrieves tenant configuration, matches dialplan extensions or groups,
   * and generates the appropriate FreeSWITCH XML response.
   * @param {Object} body - The request body from FreeSWITCH XML-Curl, containing call variables.
   * @param {string} body.domain - The domain name from the FreeSWITCH request.
   * @param {string} body.variable_domain_name - Alternate domain name from FreeSWITCH.
   * @param {string} body.variable_sip_to_host - Another alternate domain name from FreeSWITCH.
   * @param {string} body["Caller-Destination-Number"] - The dialed number or extension.
   * @param {string} body.variable_sip_from_uri - The SIP URI of the caller.
   * @param {string} body["Caller-Channel-Name"] - The channel name of the caller.
   * @param {string} body.variable_sip_to_user - The user portion of the SIP To header.
   * @returns {Promise<string>} The FreeSWITCH XML dialplan response.
   */
  lookup: async (body) => {
    // Log call to console
    console.log("-----------------Dialplan query------------------");
    console.log("User: " + body.variable_sip_from_uri + " Dialed: " + body["Caller-Destination-Number"]);

    const domain = body.domain || body.variable_domain_name || body.variable_sip_to_host;
    const fromDomain = extractDomain(body["Caller-Channel-Name"]); // caller domain

    const tenant = await tenantService.getTenantByDomain(domain);
    const destination = body["Caller-Destination-Number"];

    // Determine the actual target identifier for lookups (user or group name)
    // This prioritizes variable_sip_to_user if available, otherwise parses destination.
    let dialedTargetIdentifier = body.variable_sip_to_user || (destination.includes('@') ? destination.split('@')[0] : destination);

    let xml = '<document type="freeswitch/xml"><section name="dialplan"><context name="default">';

    if (!tenant) {
        console.log(`Tenant not found for domain: ${domain}.`);
        xml += `
        <extension name="no_tenant_found">
          <condition field="destination_number" expression="^${destination}$">
            <action application="answer"/>
            <action application="playback" data="ivr/ivr-invalid_domain.wav"/>
            <action application="hangup"/>
          </condition>
        </extension>`;
        xml += "</context></section></document>";
        console.log("Generated Dialplan XML:" + xml);
        return xml;
    }

    // Block routing in between domains - This should ideally be handled by FreeSWITCH ACLs/Contexts
    // but kept here for now as per previous context
    if (body.variable_sip_to_host !== fromDomain && fromDomain !== null) { // Add null check for fromDomain
        console.log(`Blocking inter-domain call: From ${fromDomain} to ${body.variable_sip_to_host}`);
        xml += `
    <extension name="block-interdomain-call">
      <condition field="destination_number" expression="^${destination}$">
        <action application="hangup" data="CALL_REJECTED"/>
      </condition>
    </extension>`;
        xml += "</context></section></document>";
        console.log("Generated Dialplan XML:" + xml);
        return xml;
    }

    let matchedExtension = null;
    let bridgeTarget = '';
    let bridgeTimeout = ''; // To apply timeout to bridge application
    let isGroupMatch = false; // Flag to indicate if it's a group match
    let sipClient = null; // To hold the matched SIP client data

    // Rule 1: Check for specific system extensions (like *98 for voicemail)
    if (dialedTargetIdentifier === "*98") { // Use dialedTargetIdentifier for system features
        matchedExtension = {
            name: "check_voicemail",
            condition_field: "destination_number",
            condition_expression: `^${destination}$`, // Still match original destination for condition
            actions: [
                { application: "answer", data: "" },
                { application: "sleep", data: "1000" },
                { application: "voicemail", data: `check default ${tenant.domain_name}` }
            ]
        };
        console.log("Matched system voicemail extension (*98)");
    }

    // Rule 2: Check for Hunt/Ring Groups (by name match to dialedTargetIdentifier) - highest priority after system
    if (!matchedExtension) {
        const normalizedDialedTargetIdentifier = normalizeStringForComparison(dialedTargetIdentifier);
        const matchedGroup = tenant.groups.find(group => normalizeStringForComparison(group.name) === normalizedDialedTargetIdentifier);
        if (matchedGroup) {
            isGroupMatch = true;
            console.log(`Matched group: ${matchedGroup.name} (Type: ${matchedGroup.type})`);

            matchedExtension = {
                name: `group_${normalizeStringForComparison(matchedGroup.name)}`,
                condition_field: "destination_number",
                condition_expression: `^${destination}$`, // Still match original destination for condition
                actions: []
            };

            const membersBridgeStrings = matchedGroup.members.map(member => {
                // Ensure member.user_id is also normalized for FreeSWITCH internal apps
                return `user/${normalizeStringForComparison(member.user_id)}@${tenant.domain_name}`;
            });

            if (matchedGroup.type === 'hunt') {
                bridgeTarget = membersBridgeStrings.join('|'); // Sequential
                console.log(`Hunt group bridge target: ${bridgeTarget}`);
            } else if (matchedGroup.type === 'ring') {
                bridgeTarget = membersBridgeStrings.join(','); // Simultaneous
                console.log(`Ring group bridge target: ${bridgeTarget}`);
            }

            if (matchedGroup.timeout) {
                bridgeTimeout = `timeout=${matchedGroup.timeout},`;
            }

            matchedExtension.actions.push({
                application: "bridge",
                data: `${bridgeTimeout}${bridgeTarget}`
            });

            if (matchedGroup.no_answer_action && matchedGroup.no_answer_action.application) {
                matchedExtension.actions.push(matchedGroup.no_answer_action);
            } else {
                matchedExtension.actions.push({
                    application: "playback",
                    data: "ivr/ivr-call_cannot_be_completed_as_dialed.wav"
                });
                matchedExtension.actions.push({
                    application: "hangup",
                    data: ""
                });
            }
        }
    }

    // Rule 3: Check for explicit dialplan extensions stored in MongoDB (e.g., specific DIDs, feature codes)
    // This rule uses the full 'destination' for matching as it's for general patterns, DIDs, etc.
    if (!matchedExtension) {
        matchedExtension = tenant.dialplan.default.find(ext =>
            ext.condition_field === "destination_number" && new RegExp(ext.condition_expression).test(destination)
        );
        if (matchedExtension) {
            console.log(`Matched explicit dialplan extension: ${matchedExtension.name}`);
        }
    }

    // Rule 4 (Modified): Check for direct SIP Client (User) extension
    if (!matchedExtension) {
        // Normalize the dialedTargetIdentifier for lookup against database SIP client IDs
        const normalizedDialedTargetIdentifier = normalizeStringForComparison(dialedTargetIdentifier);

        sipClient = tenant.sip_clients.find(client =>
            normalizeStringForComparison(client.user_id) === normalizedDialedTargetIdentifier
        );

        if (sipClient) {
            console.log(`Matched direct SIP client: ${sipClient.user_id} (normalized dialed target: ${normalizedDialedTargetIdentifier})`);
            const callTimeout = sipClient?.no_answer_timeout || 30; // Use client-specific timeout

            // FreeSWITCH internal applications expect the user part without spaces or special chars.
            // Use the normalized version of the actual user_id from the database.
            const fsFriendlyUserId = normalizeStringForComparison(sipClient.user_id);

            matchedExtension = {
                name: `sip_client_${fsFriendlyUserId}`,
                condition_field: "destination_number",
                condition_expression: `^${destination}$`, // Still match the original destination for condition
                actions: [
                    { application: "export", data: `dialed_extension=${fsFriendlyUserId}`},
                    { application: "log", data: `INFO Dialing extension ${fsFriendlyUserId} in domain ${tenant.domain_name}`},
                    { application: "set", data: `user_exists=\${user_exists(${fsFriendlyUserId}@${tenant.domain_name})}`},
                    { application: "log", data: `INFO user_exists for ${fsFriendlyUserId}@${tenant.domain_name}: \${user_exists}`},
                    { application: "bind_meta_app", data: "1 b s execute_extension::dx XML features"},
                    { application: "bind_meta_app", data: "2 b s record_session::\${recordings_dir}/\${caller_id_number}.\${strftime(%Y-%m-%d-%H-%M-%S)}.wav"},
                    { application: "bind_meta_app", data: "3 b s execute_extension::cf XML features"},
                    { application: "bind_meta_app", data: "4 b s execute_extension::att_xfer XML features"},
                    { application: "set", data: "ringback=\${us-ring}"},
                    { application: "set", data: "transfer_ringback=\${hold_music}"},
                    { application: "set", data: `call_timeout=${callTimeout}`},
                    { application: "set", data: "hangup_after_bridge=true"},
                    { application: "set", data: "continue_on_fail=true"},
                    { application: "hash", data: `insert/\${domain_name}-call_return/${fsFriendlyUserId}/\${caller_id_number}`},
                    { application: "hash", data: `insert/\${domain_name}-last_dial_ext/${fsFriendlyUserId}/\${uuid}`},
                    { application: "set", data: `called_party_callgroup=\${user_data(${fsFriendlyUserId}@\${tenant.domain_name} var callgroup)}`},
                    { application: "hash", data: `insert/\${domain_name}-last_dial_ext/\${called_party_callgroup}/\${uuid}`},
                    { application: "hash", data: `insert/\${domain_name}-last_dial_ext/global/\${uuid}`},
                    { application: "hash", data: `insert/\${domain_name}-last_dial/\${called_party_callgroup}/\${uuid}`},
                    { application: "bridge", data: `user/${fsFriendlyUserId}@${tenant.domain_name}`},
                    { application: "answer", data: ""},
                    { application: "sleep", data: "1000"},
                    { application: "bridge", data: `loopback/app=voicemail:default ${tenant.domain_name} ${fsFriendlyUserId}`}
                ]
            };
        }
    }


    // Final XML generation based on match
    if (matchedExtension) {
        xml += `<extension name="${matchedExtension.name}">`;
        // The condition expression should always match the full 'destination' as received from FreeSWITCH.
        xml += `<condition field="${matchedExtension.condition_field}" expression="${matchedExtension.condition_expression}">`;

        matchedExtension.actions.forEach(action => {
            let actionData = action.data;

            // Replace common placeholders
            actionData = actionData.replace(/\${tenant\.domain_name}/g, tenant.domain_name);
            actionData = actionData.replace(/\${destination}/g, destination); // Keep original destination for general use
            actionData = actionData.replace(/\${dialed_domain}/g, domain);
            // dialed_user should now reflect the target identifier (e.g., markthomas) for internal FreeSWITCH variables
            actionData = actionData.replace(/\${dialed_user}/g, dialedTargetIdentifier);

            // Handle $1, $2, etc. from regex capture groups in condition_expression
            // This requires re-matching the regex against the destination
            if (matchedExtension.condition_expression.includes('$')) {
                 const regex = new RegExp(matchedExtension.condition_expression);
                 const match = destination.match(regex);
                 if (match) {
                     for (let i = 1; i < match.length; i++) {
                         actionData = actionData.replace(new RegExp(`\\$${i}`, 'g'), match[i]);
                     }
                 }
            }
            // Ensure caller_id_number is correctly replaced
            actionData = actionData.replace(/\${caller_id_number}/g, body['Caller-ID-Number'] || '');

            xml += `<action application="${action.application}" data="${actionData}"/>`;
        });
        xml += `</condition></extension>`;

    } else {
        console.log(`No specific dialplan, group, or SIP client matched for destination: ${destination}. Using invalid extension fallback.`);
        xml += `
          <extension name="invalid_extension">
            <condition field="destination_number" expression="^${destination}$">
              <action application="answer"/>
              <action application="playback" data="ivr/ivr-that_was_an_invalid_entry.wav"/>
              <action application="hangup"/>
            </condition>
          </extension>`;
    }

    xml += "</context></section></document>";
    console.log("Generated Dialplan XML:" + xml);

    return xml;
  },
};

module.exports = dialplanController;
