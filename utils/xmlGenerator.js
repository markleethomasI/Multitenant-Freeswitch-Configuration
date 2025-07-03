// utils/xmlGenerator.js
// This file focuses solely on generating valid FreeSWITCH XML.

const xmlGenerator = {
    /**
     * Generates the FreeSWITCH dialplan XML based on a structured extension object.
     * @param {string} contextName - The name of the FreeSWITCH context.
     * @param {Object} extensionObject - A structured object defining the extension's name, condition, and actions.
     * Expected format: { name: string, condition_field: string, expression: string, actions: Array<{application: string, data: string}> }
     * @param {Object} rawBody - The original FreeSWITCH request body. Used only for fallback error XML if input is invalid.
     * @returns {string} The generated XML string.
     */
    generateDialplanXml: (contextName, extensionObject, rawBody) => {
        let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml"><section name="dialplan"><context name="${xmlGenerator._escapeAttribute(contextName)}">`; // FIX IS HERE! Was _escapeXml

        // Defensive check: ensure extensionObject is valid before proceeding
        if (!extensionObject || !extensionObject.name || !extensionObject.condition_field || !extensionObject.expression || !Array.isArray(extensionObject.actions)) {
            console.error("Invalid extension object provided to xmlGenerator, falling back to error XML:", extensionObject);
            const safeDestination = rawBody["Caller-Destination-Number"] ? xmlGenerator._escapeAttribute(rawBody["Caller-Destination-Number"]) : 'unknown';
            extensionObject = {
                name: "xml_generation_error_fallback",
                condition_field: "destination_number",
                expression: `^${safeDestination}$`,
                actions: [{ application: "answer" }, { application: "hangup", data: "NORMAL_CLEARING" }]
            };
        }

        xml += `<extension name="${xmlGenerator._escapeAttribute(extensionObject.name)}">`;
        xml += `<condition field="${xmlGenerator._escapeAttribute(extensionObject.condition_field)}" expression="${extensionObject.expression}">`;

        extensionObject.actions.forEach(action => {
            const safeApplication = xmlGenerator._escapeAttribute(action.application || '');
            const actionData = action.data || '';
            xml += `<action application="${safeApplication}" data="${actionData}"/>`;
        });

        xml += `</condition></extension>`;
        xml += "</context></section></document>";
        return xml;
    },

    /**
     * Generates a simple error XML response for FreeSWITCH.
     * @param {string} destination - The destination number that caused the error.
     * @returns {string} The error XML string.
     */
    generateErrorXml: (destination) => {
        const safeDestination = xmlGenerator._escapeAttribute(destination || 'unknown');
        return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml"><section name="dialplan"><context name="default">
  <extension name="application_error">
    <condition field="destination_number" expression="^${safeDestination}$">
      <action application="answer"/>
      <action application="playback" data="ivr/ivr-call_cannot_be_completed_as_dialed.wav"/>
      <action application="hangup"/>
    </condition>
  </extension>
</context></section></document>`;
    },

    /**
     * Internal helper to escape special characters for XML attribute values where plain text is expected.
     * This ensures the XML itself is well-formed, but avoids breaking FreeSWITCH's interpretation of special syntax.
     * @param {string} text - The string to escape.
     * @returns {string} The XML-escaped string.
     * @private
     */
    _escapeAttribute: (text) => {
        if (typeof text !== 'string') text = String(text);
        return text.replace(/[<>&'"]/g, char => {
            switch (char) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return char;
            }
        });
    }
};

module.exports = xmlGenerator;