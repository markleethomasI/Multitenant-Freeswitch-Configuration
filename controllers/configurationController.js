const tenantService = require("../services/tenantService");

const configurationController = {
  lookup: async (body) => {
    const { key_value } = body;

    console.log("Requested config key:", key_value);

    if (key_value !== "sofia.conf") {
      return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml">
  <section name="result">
    <result status="not found" />
  </section>
</document>`;
    }

    const tenantsArray = await tenantService.getAllTenants();

    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="freeswitch/xml">
  <section name="configuration">
    <configuration name="sofia.conf" description="Sofia SIP Endpoint" autoload_profiles="true">
      <profiles>`;



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
    <param name="sip-port" value="$\${internal_sip_port}"/>
    <param name="dialplan" value="XML"/>
    <param name="dtmf-duration" value="2000"/>
    <param name="inbound-codec-prefs" value="$\${global_codec_prefs}"/>
    <param name="outbound-codec-prefs" value="$\${global_codec_prefs}"/>
    <param name="rtp-timer-name" value="soft"/>
    <param name="rtp-ip" value="127.0.0.1"/>
    <param name="sip-ip" value="127.0.0.1"/>
    <param name="hold-music" value="$\${hold_music}"/>
    <param name="apply-nat-acl" value="nat.auto"/>
    <param name="apply-inbound-acl" value="domains"/>
    <param name="local-network-acl" value="localnet.auto"/>
    <param name="record-path" value="$\${recordings_dir}"/>
    <param name="record-template" value="\${caller_id_number}.\${target_domain}.\${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
    <param name="manage-presence" value="true"/>
    <param name="presence-hosts" value="$\${domain},$\${local_ip_v4}"/>
    <param name="presence-privacy" value="$\${presence_privacy}"/>
    <param name="inbound-codec-negotiation" value="generous"/>
    <param name="tls" value="$\${internal_ssl_enable}"/>
    <param name="tls-only" value="false"/>
    <param name="tls-bind-params" value="transport=tls"/>
  </settings>
</profile>`


    xml += `
      </profiles>
    </configuration>
  </section>
</document>`;

    return xml;
  },
};

module.exports = configurationController;
