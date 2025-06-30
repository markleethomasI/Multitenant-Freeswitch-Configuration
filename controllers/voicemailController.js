// controllers/voicemailController.js
const { findSipClient } = require('../services/tenantService');

/**
 * Handle voicemail lookup
 */
const lookup = async (body) => {
    const { domain, user } = body; // or req.query depending on your parser

        const sipClient = await findSipClient(domain, user);

        if (!sipClient) {
            return '<document type="freeswitch/xml"></document>'
        }

        const xmlResponse = `
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="${domain}">
      <user id="${user}">
        <params>
          <param name="vm-password" value="${user}" />
        </params>
        <variables>
          <variable name="user_context" value="default" />
        </variables>
      </user>
    </domain>
  </section>
</document>`;

        return xmlResponse


}

module.exports = {
    lookup,
};
