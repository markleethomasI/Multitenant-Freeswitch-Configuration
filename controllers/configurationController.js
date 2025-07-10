// controllers/configurationController.js
// This controller is responsible for generating FreeSWITCH's sofia.conf XML.

const { config } = require('dotenv');
const globalConfigService = require('../services/globalConfigService'); // Import the global config service

const configurationController = {
  /**
   * Handles FreeSWITCH XML-Curl configuration lookup requests for sofia.conf.
   * It fetches all globally configured external gateways and dynamically generates
   * both the 'internal' and 'external' SIP profiles for FreeSWITCH.
   * @param {Object} body - The request body from FreeSWITCH XML-Curl, containing the requested config key.
   * @param {string} body.key_value - The configuration file name requested (e.g., "sofia.conf").
   * @returns {Promise<string>} The FreeSWITCH XML configuration response.
   */
  lookup: async (body) => {
    const { key_value } = body;

    console.log("Requested config key:", key_value);

    // Only respond to sofia.conf requests
    if (key_value !== "sofia.conf") {
      // Return a "not found" XML string if the key_value is not sofia.conf
      return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml">
  <section name="result">
    <result status="not found" />
  </section>
</document>`;
    }

    try {
      // Fetch all global external gateways from the database
      const globalGateways = await globalConfigService.getAllExternalGateways();

      // Define default values for FreeSWITCH variables that are hardcoded in the XML
      // These replace variables like ${global_codec_prefs} that FreeSWITCH expects to be resolved.
      const defaultGlobalCodecPrefs = "opus,G722,PCMU,PCMA,G729"; // Common codecs
      const defaultInternalSipPort = "5060"; // Or 5080, depending on your setup
      // FreeSWITCH variables that should be passed as-is (with ${...} syntax) need to be literal strings in JS.
      const defaultHoldMusic = "${hold_music}";
      const defaultPresencePrivacy = "clear";
      const defaultInternalSslEnable = "false";
      const defaultRecordingsDir = "/usr/local/freeswitch/recordings"; // A literal path
      const defaultRecordTemplate = "${caller_id_number}.${target_domain}.${strftime(%Y-%m-%d-%H-%M-%S)}.wav";


      let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml">
  <section name="configuration">
    <configuration name="sofia.conf" description="Sofia SIP Endpoint" autoload_profiles="true">
      <profiles>`;

      // --- Generate Internal Profile ---
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
            <param name="inbound-codec-prefs" value="PCMA,PCMU"/>
            <param name="outbound-codec-prefs" value="PCMA,PCMU"/>
            <param name="rtp-timer-name" value="soft"/>
            <param name="track-calls" value="true"/>
            <param name="rtp-ip" value="auto"/>
            <param name="sip-ip" value="auto"/>
            <param name="hold-music" value="${defaultHoldMusic}"/>
            <param name="apply-nat-acl" value="nat.auto"/>
            <param name="apply-inbound-acl" value="domains"/>
            <param name="local-network-acl" value="localnet.auto"/>
            <param name="record-path" value="${defaultRecordingsDir}"/>
            <param name="record-template" value="${defaultRecordTemplate}"/>
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
      // This profile will contain all globally configured external gateways fetched from MongoDB.
      xml += `
        <profile name="signal">
          <aliases>
            <alias name="external_sip_trunks"/>
          </aliases>
          <gateways>`;

      // Iterate over the fetched global gateways and add them to the XML
      if (globalGateways && globalGateways.length > 0) {
        globalGateways.forEach(gateway => {
xml += `
            <gateway name="${gateway.name}">
              ${gateway.realm ? `<param name="realm" value="${gateway.realm}"/>` : ''}
              ${gateway.username ? `<param name="username" value="${gateway.username}"/>` : ''}
              ${gateway.password ? `<param name="password" value="${gateway.password}"/>` : ''}
              ${gateway.proxy ? `<param name="proxy" value="${gateway.proxy}"/>` : ''}
              <param name="register" value="${gateway.register ? 'true' : 'false'}"/>
              <param name="extension" value="auto_to_user"/>
              <param name="dtmf-type" value="${gateway.dtmf_type || 'rfc2833'}"/>
              <param name="caller-id-in-from" value="false"/>
              <param name="sip-options-ping-interval" value="30"/>
              <param name="sip-options-ping-tries" value="3"/>
              <param name="sip-options-ping-puts-gateway-on-fail" value="true"/>
              <param name="register-expires" value="260"/>
              <param name="expire-seconds" value="260"/>
              <param name="register-retry-seconds" value="1"/>
              <param name="ping" value="true"/>
              <param name="codec-prefs" value="OPUS,G722,PCMU,PCMA,G729,VP8,H264" />
                          <param name="sip-options-ping-interval" value="30"/>
            <param name="sip-options-ping-tries" value="3"/>
            <param name="register-expires" value="30"/>
            <param name="register-retry-seconds" value="1"/>
            <param name="rtp-hold-timeout-sec" value="30"/>
              <param name="inbound-codec-negotiation" value="generous" />
                <param name="inbound-late-negotiation" value="true" />
                <param name="manage-presence" value="false" />
                <param name="auth-calls" value="false" />
              ${gateway.register_transport ? `<param name="register-transport" value="${gateway.register_transport}"/>` : ''}
              ${gateway.rtp_secure_media ? `
                            <param name="debug" value="1"/>
            <param name="track-calls" value="true"/>
            <param name="auth-calls" value="false"/>
            <param name="inbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
            <param name="outbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
            <param name="rtp-timeout-sec" value="30"/>
            <param name="session-expires" value="120"/>

              <variables>
                <variable name="rtp_secure_media" value="${gateway.rtp_secure_media}"/>
              </variables>` : ''}
            </gateway>`;

        });

        xml += `
          </gateways>
          <settings>
            <param name="debug" value="1"/>
            <param name="user-agent" value="FreeSWITCH-FS-Trunk"/>
            <param name="nonce-ttl" value="60"/>
            <param name="auth-calls" value="false"/>
            <param name="inbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
            <param name="outbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
           
            <param name="session-expires" value="120"/>
            <param name="sip-options-ping-interval" value="30"/>
            <param name="sip-options-ping-tries" value="3"/>
            <param name="sip-options-ping-puts-gateway-on-fail" value="true"/>
            <param name="register-expires" value="260"/>
            <param name="register-retry-seconds" value="1"/>
            <param name="rtp-hold-timeout-sec" value="30"/>
            <param name="context" value="public"/>
            <param name="aggressive-nat-detection" value="true"/>
            <param name="rtp-ip" value="0.0.0.0" />
            <param name="sip-ip" value="0.0.0.0" />
            <param name="ext-rtp-ip" value="$\${external_rtp_ip}" />
            <param name="ext-sip-ip" value="$\${external_sip_ip}" />
            <param name="apply-nat-acl" value="nat.auto"/>
            <param name="manage-presence" value="false"/>
            <param name="sip-port" value="5080"/>
            <param name="challenge-realm" value="\${domain}"/>
            <param name="ping" value="true"/>
          </settings>
        </profile>`;
      } else {
        console.warn('No external gateways found in the database. Generating external profile without gateways.');
        xml += `
        <profile name="external">
          <gateways></gateways>
          <settings>
            <param name="debug" value="1" />
            <param name="dialplan" value="signalwire" />
            <param name="context" value="default" />
            <param name="rtp-timer-name" value="soft" />
            <param name="rtp-ip" value="10.0.0.2" />
            <param name="sip-ip" value="10.0.0.2" />
            <param name="ext-rtp-ip" value="67.217.242.171" />
            <param name="ext-sip-ip" value="67.217.242.171" />
            <param name="rtp-timeout-sec" value="300" />
            <param name="rtp-hold-timeout-sec" value="1800" />
            <param name="sip-port" value="6050" />
            <param name="tls" value="True" />
            <param name="tls-only" value="true" />
            <param name="tls-bind-params" value="transport=tls" />
            <param name="tls-sip-port" value="6050" />
            <param name="tls-verify-date" value="true" />
            <param name="tls-verify-policy" value="none" />
            <param name="tls-verify-depth" value="2" />
            <param name="codec-prefs" value="OPUS,G722,PCMU,PCMA,VP8,H264" />
            <param name="inbound-codec-negotiation" value="generous" />
            <param name="inbound-late-negotiation" value="true" />
            <param name="manage-presence" value="false" />
            <param name="auth-calls" value="false" />
          </settings>
        </profile>`;
    }


    xml += `
      </profiles>
    </configuration>
  </section>
</document>`;

      // Log the generated XML for debugging purposes
      console.log("--- Generated sofia.conf XML from configurationController ---");
      console.log(xml);
      console.log("--- End Generated sofia.conf XML ---");

      // Return the generated XML string directly
      return xml;
    } catch (error) {
      console.error('FreeSWITCH Configuration XML-Curl Error:', error);
      // Return an error XML string
      return '<document type="freeswitch/xml"><section name="configuration"><result status="error"/></section></document>';
    }
  }
};

module.exports = configurationController