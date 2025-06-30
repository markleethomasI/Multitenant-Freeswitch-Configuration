const tenantService = require('../services/tenantService')

const directoryController = {
        lookup: async (body) => {
            const domain = body.domain;
            // Directory lookup for SIP authentication
            console.log("Directory lookup in progress");
            console.log("Domain: " + domain)

            const userNumber = body.
            sip_auth_username || body.user

            const user = await tenantService.findSipClient(domain, userNumber)
        
            if (user) {

                const response = `
          <document type="freeswitch/xml">
            <section name="directory">
              <domain name="${domain}">
                <params>
                  <param name="dial-string" value="{presence_id=\${dialed_user}@\${dialed_domain}}\${sofia_contact(\${dialed_user}@\${dialed_domain})}"/>
                </params>
                <user id="${user.user_id}">
                    <params>
                        <param name="password" value="${user.password}"/>
                        <param name="vm-password" value="${user.password}"/>
                    </params>
                    <variables>
                        <variable name="user_context" value="default"/>
                        <variable name="dial_string" value="{presence_id=${user.user_id}@${domain}}"/>
                        <variable name="domain_name" value="${domain}"/>
                        <variable name="domain" value="${domain}"/>
                    </variables>
                </user>
              </domain>
            </section>
          </document>
        `

                console.log(response)
                return response
    } else {

    }

}
    
}

module.exports = directoryController;