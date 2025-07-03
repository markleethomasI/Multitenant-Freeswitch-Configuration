// controllers/globalConfigApiController.js
const globalConfigService = require('../services/globalConfigService'); // Import the new globalConfigService

const globalConfigApiController = {
  /**
   * @api {get} /api/gateways Get All Global External Gateways
   * @apiName GetAllGlobalExternalGateways
   * @apiGroup GlobalGateways
   * @apiDescription Retrieves a list of all globally configured external SIP gateways (trunks).
   * @apiSuccess {Object[]} gateways Array of external gateway objects.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * [
   * {
   * "_id": "685eec202e1ded589169e328",
   * "name": "signalwire_us_east",
   * "realm": "gw.signalwire.com",
   * "username": "...",
   * "password": "...",
   * "from_domain": "gw.signalwire.com",
   * "register": true,
   * "context": "public",
   * "proxy": "gw.signalwire.com",
   * "createdAt": "2025-06-29T...",
   * "updatedAt": "2025-06-29T..."
   * }
   * ]
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server while retrieving gateways.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 500 Internal Server Error
   * {
   * "error": "Failed to retrieve external gateways"
   * }
   */
  getAllExternalGateways: async (req, res) => {
    try {
      const gateways = await globalConfigService.getAllExternalGateways();
      res.status(200).json(gateways);
    } catch (error) {
      console.error('API Error: Get All External Gateways', error);
      res.status(500).json({ error: 'Failed to retrieve external gateways' });
    }
  },

  /**
   * @api {get} /api/gateways/:gateway_name Get Specific Global External Gateway
   * @apiName GetGlobalExternalGateway
   * @apiGroup GlobalGateways
   * @apiDescription Retrieves a single globally configured external SIP gateway by its name.
   * @apiParam {String} gateway_name The unique name of the gateway to retrieve.
   * @apiSuccess {Object} gateway The external gateway object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * {
   * "_id": "...",
   * "name": "signalwire_us_east",
   * "realm": "gw.signalwire.com",
   * // ... rest of gateway data ...
   * }
   * @apiError (404 Not Found) GatewayNotFound The gateway with the specified `gateway_name` was not found.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 404 Not Found
   * {
   * "error": "External gateway not found"
   * }
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getExternalGateway: async (req, res) => {
    try {
      const gateway = await globalConfigService.getExternalGateway(req.params.gateway_name);
      if (!gateway) {
        return res.status(404).json({ error: 'External gateway not found' });
      }
      res.status(200).json(gateway);
    } catch (error) {
      console.error('API Error: Get Specific External Gateway', error);
      res.status(500).json({ error: 'Failed to retrieve external gateway' });
    }
  },

  /**
   * @api {post} /api/gateways Add New Global External Gateway
   * @apiName AddGlobalExternalGateway
   * @apiGroup GlobalGateways
   * @apiDescription Adds a new globally configured external SIP gateway (trunk).
   * @apiParam {String} name Unique name for the gateway.
   * @apiParam {String} realm SIP domain/realm of the gateway.
   * @apiParam {String} username Username for registration/authentication.
   * @apiParam {String} password Password for registration/authentication.
   * @apiParam {String} from_domain What to send in From: header.
   * @apiParam {Boolean} [register=false] Whether FreeSWITCH should register to this gateway.
   * @apiParam {String} [context=default] Inbound context for calls coming from this gateway.
   * @apiParamExample {json} Request-Example:
   * {
   * "name": "signalwire_us_west",
   * "realm": "gw.signalwire.com",
   * "username": "your_project_id_west",
   * "password": "your_token_west",
   * "from_domain": "gw.signalwire.com",
   * "register": true,
   * "context": "public",
   * "proxy": "gw.signalwire.com",
   * "register_transport": "tls"
   * }
   * @apiSuccess (201 Created) {Object} gateway The newly created external gateway object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 201 Created
   * {
   * "_id": "...",
   * "name": "signalwire_us_west",
   * // ... rest of gateway data ...
   * }
   * @apiError (409 Conflict) GatewayExists A gateway with the same `name` already exists.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 409 Conflict
   * {
   * "error": "Gateway with name 'signalwire_us_west' already exists."
   * }
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during gateway creation.
   */
  addExternalGateway: async (req, res) => {
    try {
      const newGateway = await globalConfigService.addExternalGateway(req.body);
      res.status(201).json(newGateway);
    } catch (error) {
      console.error('API Error: Add External Gateway', error);
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add external gateway' });
    }
  },

  /**
   * @api {put} /api/gateways/:gateway_name Update Global External Gateway
   * @apiName UpdateGlobalExternalGateway
   * @apiGroup GlobalGateways
   * @apiDescription Updates an existing globally configured external SIP gateway by its name.
   * @apiParam {String} gateway_name The unique name of the gateway to update.
   * @apiParam {Object} updateData Data to update the gateway with. Only provided fields will be updated.
   * @apiParamExample {json} Request-Example:
   * {
   * "password": "new_secure_password",
   * "register": false
   * }
   * @apiSuccess {Object} gateway The updated external gateway object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * {
   * "_id": "...",
   * "name": "signalwire_us_east",
   * "register": false,
   * // ... rest of updated gateway data ...
   * }
   * @apiError (404 Not Found) GatewayNotFound The gateway with the specified `gateway_name` was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during gateway update.
   */
  updateExternalGateway: async (req, res) => {
    try {
      const updatedGateway = await globalConfigService.updateExternalGateway(req.params.gateway_name, req.body);
      if (!updatedGateway) {
        return res.status(404).json({ error: 'External gateway not found' });
      }
      res.status(200).json(updatedGateway);
    } catch (error) {
      console.error('API Error: Update External Gateway', error);
      res.status(500).json({ error: 'Failed to update external gateway' });
    }
  },

  /**
   * @api {delete} /api/gateways/:gateway_name Delete Global External Gateway
   * @apiName DeleteGlobalExternalGateway
   * @apiGroup GlobalGateways
   * @apiDescription Deletes a globally configured external SIP gateway by its name.
   * @apiParam {String} gateway_name The unique name of the gateway to delete.
   * @apiSuccess (204 No Content) NoContent Gateway successfully deleted.
   * @apiError (404 Not Found) GatewayNotFound The gateway with the specified `gateway_name` was not found for deletion.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during gateway deletion.
   */
  deleteExternalGateway: async (req, res) => {
    try {
      const deleted = await globalConfigService.deleteExternalGateway(req.params.gateway_name);
      if (!deleted) {
        return res.status(404).json({ error: 'External gateway not found for deletion' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('API Error: Delete External Gateway', error);
      res.status(500).json({ error: 'Failed to delete external gateway' });
    }
  },

  /**
   * Handles FreeSWITCH XML-Curl configuration lookup requests.
   * This method is specifically for FreeSWITCH's `sofia.conf` requests.
   * It fetches all global external gateways and renders them into the sofia.conf XML.
   * @param {Object} body - The request body from FreeSWITCH XML-Curl.
   * @param {string} body.key_value - The configuration file name requested (e.g., "sofia.conf").
   * @returns {Promise<string>} The FreeSWITCH XML configuration response.
   */
  handleFreeswitchConfiguration: async (req, res) => {
    const { key_value } = req.body;

    console.log("FreeSWITCH Configuration Requested:", key_value);

    if (key_value !== "sofia.conf") {
      res.set('Content-Type', 'application/xml');
      return res.status(404).send(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml">
  <section name="result">
    <result status="not found" />
  </section>
</document>`);
    }

    try {
      const globalGateways = await globalConfigService.getAllExternalGateways();

      // Define default values for FreeSWITCH variables that are hardcoded in the XML
      // These replace variables like ${global_codec_prefs} that FreeSWITCH expects to be resolved.
      const defaultGlobalCodecPrefs = "opus,G722,PCMU,PCMA,G729"; // Common codecs
      const defaultInternalSipPort = "5060"; // Or 5080, depending on your setup
      const defaultHoldMusic = "$${hold_music}"; // This one is usually a FreeSWITCH variable itself
      const defaultPresencePrivacy = "clear"; // Or "full"
      const defaultInternalSslEnable = "false"; // Or "true" if TLS is enabled for internal profile


      let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml">
  <section name="configuration">
    <configuration name="sofia.conf" description="Sofia SIP Endpoint" autoload_profiles="true">
      <profiles>`;

      // --- Generate Internal Profile (static for now, but could be dynamic) ---
      // This internal profile will be used by all tenants for their internal SIP clients.
      xml += `
        <profile name="internal">
          <aliases>
          </aliases>
          <gateways>
          </gateways>
          <domains>
            <domain name="all" alias="true" parse="false"/>
          </domains>
          <settings>
            <param name="debug" value="0"/>
            <param name="sip-trace" value="no"/>
            <param name="sip-capture" value="no"/>
            <param name="watchdog-enabled" value="no"/>
            <param name="watchdog-step-timeout" value="30000"/>
            <param name="watchdog-event-timeout" value="30000"/>
            <param name="log-auth-failures" value="false"/>
            <param name="forward-unsolicited-mwi-notify" value="false"/>
            <param name="context" value="default"/>
            <param name="rfc2833-pt" value="101"/>
            <param name="sip-port" value="${defaultInternalSipPort}"/>
            <param name="dialplan" value="XML"/>
            <param name="dtmf-duration" value="2000"/>
            <param name="inbound-codec-prefs" value="${defaultGlobalCodecPrefs}"/>
            <param name="outbound-codec-prefs" value="${defaultGlobalCodecPrefs}"/>
            <param name="rtp-timer-name" value="soft"/>
            <param name="rtp-ip" value="127.0.0.1"/>
            <param name="sip-ip" value="127.0.0.1"/>
            <param name="hold-music" value="${defaultHoldMusic}"/>
            <param name="apply-nat-acl" value="nat.auto"/>
            <param name="apply-inbound-acl" value="domains"/>
            <param name="local-network-acl" value="localnet.auto"/>
            <param name="record-path" value="\${recordings_dir}"/>
            <param name="record-template" value="\${caller_id_number}.\${target_domain}.\${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
            <param name="manage-presence" value="true"/>
            <param name="presence-hosts" value="\${domain},\${local_ip_v4}"/>
            <param name="presence-privacy" value="${defaultPresencePrivacy}"/>
            <param name="inbound-codec-negotiation" value="generous"/>
            <param name="tls" value="${defaultInternalSslEnable}"/>
            <param name="tls-only" value="false"/>
            <param name="tls-bind-params" value="transport=tls"/>
          </settings>
        </profile>`;

      // --- Generate External SIP Trunk Profile and Gateways ---
      // This profile will contain all globally configured external gateways.
      xml += `
        <profile name="external">
          <aliases>
            <alias name="external_sip_trunks"/>
          </aliases>
          <gateways>`;

      if (globalGateways && globalGateways.length > 0) {
        globalGateways.forEach(gateway => {
          xml += `
            <gateway name="${gateway.name}">
              <param name="realm" value="${gateway.realm}"/>
              <param name="username" value="${gateway.username}"/>
              <param name="password" value="${gateway.password}"/>
              <param name="from-domain" value="${gateway.from_domain}"/>
              ${gateway.extension ? `<param name="extension" value="${gateway.extension}"/>` : ''}
              <param name="ext-sip-ip" value="${gateway.ext_sip_ip || 'auto-nat'}"/>
              <param name="ext-rtp-ip" value="${gateway.ext_rtp_ip || 'auto-nat'}"/>
              <param name="force-register-domain" value="${gateway.force_register_domain ? 'true' : 'false'}"/>
              <param name="register-transport" value="${gateway.register_transport || 'udp'}"/>
              <param name="register" value="${gateway.register ? 'true' : 'false'}"/>
              <param name="retry-seconds" value="${gateway.retry_seconds || '30'}"/>
              <param name="sip-acl" value="${gateway.sip_acl || 'none'}"/>
              <param name="rtp-acl" value="${gateway.sip_acl || 'none'}"/>
              ${gateway.proxy ? `<param name="proxy" value="${gateway.proxy}"/>` : ''}
              <param name="expire-seconds" value="${gateway.expire_seconds || '3600'}"/>
              <param name="ping-factor" value="${gateway.ping_factor || '1'}"/>
              <param name="caller-id-in-from" value="${gateway.caller_id_in_from ? 'true' : 'false'}"/>
              <param name="context" value="${gateway.context || 'default'}"/>
              <param name="accept-blind-auth" value="${gateway.accept_blind_auth ? 'true' : 'false'}"/>
              <param name="aggressive-nat-detection" value="${gateway.aggressive_nat_detection ? 'true' : 'false'}"/>
              <param name="auth-calls" value="${gateway.auth_calls ? 'true' : 'false'}"/>
              <param name="manage-presence" value="${gateway.manage_presence ? 'true' : 'false'}"/>
              <param name="dtmf-type" value="${gateway.dtmf_type || 'rfc2833'}"/>
              <param name="parse-unampped-digits" value="false"/>
              <param name="codec-prefs" value="${gateway.codec_prefs || 'G711ulaw,G711alaw,G729'}"/>
              <param name="codec-string" value="${gateway.codec_string || 'G711ulaw,G711alaw,G729'}"/>
            </gateway>`;
        });

        xml += `
          </gateways>
          <settings>
            <param name="debug" value="0"/>
            <param name="user-agent" value="FreeSWITCH-FS-Trunk"/>
            <param name="nonce-ttl" value="60"/>
            <param name="auth-calls" value="false"/>
            <param name="inbound-codec-prefs" value="G711ulaw,G711alaw,G729"/>
            <param name="outbound-codec-prefs" value="G711ulaw,G711alaw,G729"/>
            <param name="rtp-timeout-sec" value="300"/>
            <param name="rtp-hold-timeout-sec" value="1800"/>
            <param name="aggressive-nat-detection" value="true"/>
            <param name="apply-nat-acl" value="nat.auto"/>
            <param name="manage-presence" value="false"/>
            <param name="challenge-realm" value="\${domain}"/>
          </settings>
        </profile>`;
      } else {
        console.warn('No external gateways found in the database. Generating external profile without gateways.');
        xml += `
        <profile name="external">
          <gateways></gateways>
          <settings>
            <param name="debug" value="0"/>
            <param name="user-agent" value="FreeSWITCH-FS-Trunk"/>
            <param name="nonce-ttl" value="60"/>
            <param name="auth-calls" value="false"/>
            <param name="inbound-codec-prefs" value="G711ulaw,G711alaw,G729"/>
            <param name="outbound-codec-prefs" value="G711ulaw,G711alaw,G729"/>
            <param name="rtp-timeout-sec" value="300"/>
            <param name="rtp-hold-timeout-sec" value="1800"/>
            <param name="aggressive-nat-detection" value="true"/>
            <param name="apply-nat-acl" value="nat.auto"/>
            <param name="manage-presence" value="false"/>
            <param name="challenge-realm" value="\${domain}"/>
          </settings>
        </profile>`;
    }


    xml += `
      </profiles>
    </configuration>
  </section>
</document>`;

      res.set('Content-Type', 'application/xml');
      res.status(200).send(xml);
    } catch (error) {
      console.error('FreeSWITCH Configuration XML-Curl Error:', error);
      res.status(500).send('<document type="freeswitch/xml"><section name="configuration"><result status="error"/></section></document>');
    }
  }
};

module.exports = globalConfigApiController;
