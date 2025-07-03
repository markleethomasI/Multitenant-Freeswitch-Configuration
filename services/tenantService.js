// services/tenantService.js
const Tenant = require('../models/Tenant'); // Import your Tenant model

const tenantService = {
  /**
   * Fetch tenant by domain name.
   * @param {string} domainName - Fully qualified domain name.
   * @returns {Promise<Object|null>} Tenant document object or null if not found.
   */
  getTenantByDomain: async (domainName) => {
    if (!domainName) return null;
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      return tenant ? tenant.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.getTenantByDomain:', error);
      throw error;
    }
  },

  /**
   * Get all tenants.
   * @returns {Promise<Array<Object>>} Array of tenant document objects.
   */
  getAllTenants: async () => {
    try {
      const tenants = await Tenant.find({});
      return tenants.map(t => t.toObject());
    } catch (error) {
      console.error('Error in tenantService.getAllTenants:', error);
      throw error;
    }
  },

  /**
   * Create a new tenant.
   * @param {Object} tenantData - Data for the new tenant.
   * @returns {Promise<Object>} The created tenant document object.
   * @throws {Error} If profile data is missing or tenant creation fails.
   */
  createTenant: async (tenantData) => {
    try {
      if (!tenantData.profile) {
        throw new Error('Profile data is required for a new tenant.');
      }
      if (!tenantData.sip_clients) tenantData.sip_clients = [];
      if (!tenantData.dialplan || !tenantData.dialplan.default) tenantData.dialplan = { default: [] };
      if (!tenantData.groups) tenantData.groups = [];
      if (!tenantData.dids) tenantData.dids = [];

      const newTenant = new Tenant(tenantData);
      await newTenant.save();
      return newTenant.toObject();
    } catch (error) {
      console.error('Error in tenantService.createTenant:', error);
      throw error;
    }
  },

  /**
   * Update an existing tenant by domain name.
   * @param {string} domainName - Domain name of the tenant to update.
   * @param {Object} updateData - Data to update the tenant with.
   * @returns {Promise<Object|null>} The updated tenant document object or null if not found.
   * @throws {Error} If tenant update fails.
   */
  updateTenant: async (domainName, updateData) => {
    try {
      const tenant = await Tenant.findOneAndUpdate(
        { domain_name: domainName },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      return tenant ? tenant.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.updateTenant:', error);
      throw error;
    }
  },

  /**
   * Delete a tenant by domain name.
   * @param {string} domainName - Domain name of the tenant to delete.
   * @returns {Promise<boolean>} True if a tenant was deleted, false otherwise.
   * @throws {Error} If tenant deletion fails.
   */
  deleteTenant: async (domainName) => {
    try {
      const result = await Tenant.deleteOne({ domain_name: domainName });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error in tenantService.deleteTenant:', error);
      throw error;
    }
  },

  // --- SIP Client (User) Operations ---
  /**
   * Get all SIP clients for a specific tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @returns {Promise<Array<Object>|null>} Array of SIP client objects or null if tenant not found.
   * @throws {Error} If fetching SIP clients fails.
   */
  getSipClients: async (domainName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      return tenant ? tenant.sip_clients.map(client => client.toObject()) : null;
    } catch (error) {
      console.error('Error in tenantService.getSipClients:', error);
      throw error;
    }
  },

  /**
   * Find a SIP client (user) under a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} userId - SIP user ID.
   * @returns {Promise<Object|null>} SIP client object or null if not found.
   * @throws {Error} If tenant not found or fetching SIP client fails.
   */
  findSipClient: async (domainName, userId) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');
      const client = tenant.sip_clients.find(c => c.user_id === userId);
      return client ? client.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.findSipClient:', error);
      throw error;
    }
  },

  /**
   * Add a new SIP client to a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {Object} clientData - Data for the new SIP client.
   * @returns {Promise<Object>} The added SIP client object.
   * @throws {Error} If tenant not found or SIP client already exists.
   */
  addSipClient: async (domainName, clientData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const existingClient = tenant.sip_clients.find(client => client.user_id === clientData.user_id);
      if (existingClient) {
        throw new Error(`User ID '${clientData.user_id}' already exists for tenant '${domainName}'`);
      }

      tenant.sip_clients.push(clientData);
      await tenant.save();
      return clientData;
    } catch (error) {
      console.error('Error in tenantService.addSipClient:', error);
      throw error;
    }
  },

  /**
   * Update an existing SIP client for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} userId - ID of the SIP user to update.
   * @param {Object} updateData - Data to update the SIP client with.
   * @returns {Promise<Object>} The updated SIP client object.
   * @throws {Error} If tenant or SIP client not found.
   */
  updateSipClient: async (domainName, userId, updateData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const client = tenant.sip_clients.find(c => c.user_id === userId);
      if (!client) throw new Error('SIP client not found');

      Object.assign(client, updateData);

      await tenant.save();
      return client.toObject();
    } catch (error) {
      console.error('Error in tenantService.updateSipClient:', error);
      throw error;
    }
  },

  /** Delete a SIP client from a tenant.
   * Also removes the SIP client from any groups they are a member of within the same tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} userId - ID of the SIP user to delete.
   * @returns {Promise<boolean>} True if SIP client was deleted, false otherwise.
   * @throws {Error} If tenant or SIP client not found.
   */
  deleteSipClient: async (domainName, userId) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const initialClientsLength = tenant.sip_clients.length;
      tenant.sip_clients = tenant.sip_clients.filter(client => client.user_id !== userId);
      if (tenant.sip_clients.length === initialClientsLength) {
        throw new Error('SIP client not found for deletion');
      }

      tenant.groups.forEach(group => {
        group.members = group.members.filter(member => member.user_id !== userId);
      });

      tenant.dids.forEach(did => {
        if (did.routing_target_type === 'extension' && did.routing_target_id === userId) {
          did.routing_target_type = 'custom';
          did.routing_target_id = 'unassigned';
          did.description = `Previously assigned to deleted extension ${userId}`;
        }
      });

      await tenant.save();
      return true;
    } catch (error) {
      console.error('Error in tenantService.deleteSipClient:', error);
      throw error;
    }
  },

  // --- Dialplan Extension Operations ---
  /**
   * Get all dialplan extensions for a specific tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @returns {Promise<Array<Object>|null>} Array of dialplan extension objects or null if tenant not found.
   * @throws {Error} If fetching dialplan extensions fails.
   */
  getDialplanExtensions: async (domainName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      return tenant ? tenant.dialplan.default.map(ext => ext.toObject()) : null;
    } catch (error) {
      console.error('Error in tenantService.getDialplanExtensions:', error);
      throw error;
    }
  },

  /**
   * Get dialplan for a specific tenant and context (default if not provided).
   * @param {Object} tenant - Tenant document object.
   * @param {string} context - Dialplan context (e.g., "default").
   * @returns {Array<Object>} Dialplan entries or empty array.
   */
  getDialplan: (tenant, context = "default") => {
    if (!tenant?.dialplan?.[context]) return [];
    return tenant.dialplan[context].map(ext => ext.toObject());
  },

  /**
   * Get a specific dialplan extension by name for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} extensionName - Name of the dialplan extension.
   * @returns {Promise<Object|null>} Dialplan extension object or null if not found.
   * @throws {Error} If tenant not found or fetching dialplan extension fails.
   */
  getDialplanExtension: async (domainName, extensionName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');
      const extension = tenant.dialplan.default.find(ext => ext.name === extensionName);
      return extension ? extension.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.getDialplanExtension:', error);
      throw error;
    }
  },

  /**
   * Add a new dialplan extension to a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {Object} extensionData - Data for the new dialplan extension.
   * @returns {Promise<Object>} The added dialplan extension object.
   * @throws {Error} If tenant not found or extension name already exists.
   */
  addDialplanExtension: async (domainName, extensionData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const existingExtension = tenant.dialplan.default.find(ext => ext.name === extensionData.name);
      if (existingExtension) {
        throw new Error(`Extension with name '${extensionData.name}' already exists for tenant '${domainName}'`);
      }

      tenant.dialplan.default.push(extensionData);
      await tenant.save();
      return extensionData;
    } catch (error) {
      console.error('Error in tenantService.addDialplanExtension:', error);
      throw error;
    }
  },

  /**
   * Update an existing dialplan extension for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} extensionName - Name of the dialplan extension to update.
   * @param {Object} updateData - Data to update the dialplan extension with.
   * @returns {Promise<Object>} The updated dialplan extension object.
   * @throws {Error} If tenant or dialplan extension not found.
   */
  updateDialplanExtension: async (domainName, extensionName, updateData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const extIndex = tenant.dialplan.default.findIndex(ext => ext.name === extensionName);
      if (extIndex === -1) throw new Error('Dialplan extension not found');

      Object.assign(tenant.dialplan.default[extIndex], updateData);
      await tenant.save();
      return tenant.dialplan.default[extIndex].toObject();
    } catch (error) {
      console.error('Error in tenantService.updateDialplanExtension:', error);
      throw error;
    }
  },

  /**
   * Delete a dialplan extension from a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} extensionName - Name of the dialplan extension to delete.
   * @returns {Promise<boolean>} True if dialplan extension was deleted, false otherwise.
   * @throws {Error} If tenant or dialplan extension not found.
   */
  deleteDialplanExtension: async (domainName, extensionName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const initialLength = tenant.dialplan.default.length;
      tenant.dialplan.default = tenant.dialplan.default.filter(ext => ext.name !== extensionName);
      if (tenant.dialplan.default.length === initialLength) {
        throw new Error('Dialplan extension not found for deletion');
      }
      await tenant.save();
      return true;
    } catch (error) {
      console.error('Error in tenantService.deleteDialplanExtension:', error);
      throw error;
    }
  },

  // --- Group Management Methods ---
  /**
   * Get all groups for a specific tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @returns {Promise<Array<Object>|null>} Array of group objects or null if tenant not found.
   * @throws {Error} If fetching groups fails.
   */
  getGroups: async (domainName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      return tenant ? tenant.groups.map(group => group.toObject()) : null;
    } catch (error) {
      console.error('Error in tenantService.getGroups:', error);
      throw error;
    }
  },

  /**
   * Get a specific group by name for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} groupName - Name of the group.
   * @returns {Promise<Object|null>} Group object or null if not found.
   * @throws {Error} If tenant or group not found.
   */
  getGroup: async (domainName, groupName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');
      const group = tenant.groups.find(g => g.name === groupName);
      return group ? group.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.getGroup:', error);
      throw error;
    }
  },

  /**
   * Add a new group to a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {Object} groupData - Data for the new group.
   * @returns {Promise<Object>} The added group object.
   * @throws {Error} If tenant not found or group name already exists.
   */
  addGroup: async (domainName, groupData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const existingGroup = tenant.groups.find(g => g.name === groupData.name);
      if (existingGroup) {
        throw new Error(`Group with name '${groupData.name}' already exists for tenant '${domainName}'`);
      }

      tenant.groups.push(groupData);
      await tenant.save();
      return groupData;
    } catch (error) {
      console.error('Error in tenantService.addGroup:', error);
      throw error;
    }
  },

  /**
   * Update an existing group for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} groupName - Name of the group to update.
   * @param {Object} updateData - Data to update the group with.
   * @returns {Promise<Object>} The updated group object.
   * @throws {Error} If tenant or group not found.
   */
  updateGroup: async (domainName, groupName, updateData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const group = tenant.groups.find(g => g.name === groupName);
      if (!group) throw new Error('Group not found');

      Object.assign(group, updateData);
      await tenant.save();
      return group.toObject();
    } catch (error) {
      console.error('Error in tenantService.updateGroup:', error);
      throw error;
    }
  },

  /**
   * Delete a group from a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} groupName - Name of the group to delete.
   * @returns {Promise<boolean>} True if group was deleted, false otherwise.
   * @throws {Error} If tenant or group not found.
   */
  deleteGroup: async (domainName, groupName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const initialLength = tenant.groups.length;
      tenant.groups = tenant.groups.filter(g => g.name !== groupName);
      if (tenant.groups.length === initialLength) {
        throw new Error('Group not found for deletion');
      }

      tenant.dids.forEach(did => {
        if (did.routing_target_type === 'group' && did.routing_target_id === groupName) {
          did.routing_target_type = 'custom';
          did.routing_target_id = 'unassigned';
          did.description = `Previously assigned to deleted group ${groupName}`;
        }
      });

      await tenant.save();
      return true;
    } catch (error) {
      console.error('Error in tenantService.deleteGroup:', error);
      throw error;
    }
  },

  // --- DID Management Methods ---
  /**
   * Get all DIDs for a specific tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @returns {Promise<Array<Object>|null>} Array of DID objects or null if tenant not found.
   * @throws {Error} If fetching DIDs fails.
   */
  getDids: async (domainName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      return tenant ? tenant.dids.map(did => did.toObject()) : null;
    } catch (error) {
      console.error('Error in tenantService.getDids:', error);
      throw error;
    }
  },

  /**
   * Get a specific DID by number for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} didNumber - The DID number.
   * @returns {Promise<Object|null>} DID object or null if not found.
   * @throws {Error} If tenant or DID not found.
   */
  getDid: async (domainName, didNumber) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');
      const did = tenant.dids.find(d => d.number === didNumber);
      return did ? did.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.getDid:', error);
      throw error;
    }
  },

  /**
   * Add a new DID to a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {Object} didData - Data for the new DID.
   * @returns {Promise<Object>} The added DID object.
   * @throws {Error} If tenant not found or DID number already exists.
   */
  addDid: async (domainName, didData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const existingDid = tenant.dids.find(did => did.number === didData.number);
      if (existingDid) {
        throw new Error(`DID number '${didData.number}' already exists for tenant '${domainName}'`);
      }

      tenant.dids.push(didData);
      await tenant.save();
      return didData;
    } catch (error) {
      console.error('Error in tenantService.addDid:', error);
      throw error;
    }
  },

  /**
   * Update an existing DID for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} didNumber - The DID number to update.
   * @param {Object} updateData - Data to update the DID with.
   * @returns {Promise<Object>} The updated DID object.
   * @throws {Error} If tenant or DID not found.
   */
  updateDid: async (domainName, didNumber, updateData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');
      const did = tenant.dids.find(d => {
        return d.did_number === didNumber
      }
        );
      if (!did) throw new Error('DID not found');

      Object.assign(did, updateData);
      await tenant.save();
      return did.toObject();
    } catch (error) {
      console.error('Error in tenantService.updateDid:', error);
      throw error;
    }
  },

  /**
   * Delete a DID from a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} didNumber - The DID number to delete.
   * @returns {Promise<boolean>} True if DID was deleted, false otherwise.
   * @throws {Error} If tenant or DID not found.
   */
  deleteDid: async (domainName, didNumber) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const initialLength = tenant.dids.length;
      tenant.dids = tenant.dids.filter(d => d.number !== didNumber);
      if (tenant.dids.length === initialLength) {
        throw new Error('DID not found for deletion');
      }
      await tenant.save();
      return true;
    } catch (error) {
      console.error('Error in tenantService.deleteDid:', error);
      throw error;
    }
  },


    /**
     * Finds a tenant and the specific DID object by its number.
     * @param {string} didNumber The DID number to search for.
     * @returns {object} An object containing the tenant and the matched DID, or nulls if not found.
     */
    getTenantAndDidByDidNumber: async (didNumber) => {
        try {
            // Find a tenant that contains the given DID number in its 'dids' array
            // and ensure the DID is active.
            const tenant = await Tenant.findOne({
                "dids.did_number": didNumber,
                "dids.active": true // Only consider active DIDs
            });

            if (!tenant) {
                console.log(`Tenant not found for DID number: ${didNumber}`);
                return { tenant: null, matchedDid: null };
            }

            // If a tenant is found, extract the specific DID from its array
            const matchedDid = tenant.dids.find(d => d.did_number === didNumber && d.active);

            if (!matchedDid) {
                // This case should ideally not happen if the initial findOne worked,
                // but good for robustness if active status was missed or array structure changes.
                console.log(`DID ${didNumber} not found within tenant ${tenant.domain_name} or is not active.`);
                return { tenant: null, matchedDid: null };
            }

            console.log(`Found tenant "${tenant.domain_name}" for DID "${didNumber}"`);
            return tenant;

        } catch (error) {
            console.error(`Error in tenantService.getTenantAndDidByDidNumber for DID ${didNumber}:`, error);
            // Depending on your error handling strategy, you might throw or return a specific error
            throw error;
        }
    },

  // Note: External Gateway methods have been moved to globalConfigService
  // as per the new architecture for a shared trunk.

  /**
   * @api {get} /api/tenants/:domain_name/phonebook Get Phonebook XML for Tenant
   * @apiName GetPhonebook
   * @apiGroup Phonebook
   * @apiDescription Retrieves a list of all SIP clients (users) for a tenant in an XML phonebook format suitable for IP phones.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiSuccess (200 OK) {String} xml_phonebook XML string containing the phonebook entries.
   * @apiSuccessExample {xml} Success-Response:
   * HTTP/1.1 200 OK
   * <?xml version="1.0" encoding="UTF-8"?>
   * <PhoneDirectory>
   * <Title>My Company Directory</Title>
   * <Entry>
   * <Name>John Doe</Name>
   * <Number>1001</Number>
   * </Entry>
   * <Entry>
   * <Name>Jane Smith</Name>
   * <Number>1002</Number>
   * </Entry>
   * </PhoneDirectory>
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getPhonebook: async (domainName) => {
    try {
      const sipClients = await tenantService.getSipClients(domainName);

      if (sipClients === null) {
        console.warn(`Phonebook: Tenant not found for domain ${domainName}`);
        return '<?xml version="1.0" encoding="UTF-8"?>\n<PhoneDirectory><Title>Tenant Not Found</Title></PhoneDirectory>';
      }

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<PhoneDirectory>\n';
      xml += `  <Title>${domainName} Directory</Title>\n`;
      xml += `  <Prompt>Select Entry</Prompt>\n`;

      sipClients.forEach(client => {
        xml += '  <DirectoryEntry>\n';
        xml += `    <Name>${client.user_id}</Name>\n`;
        xml += `    <Telephone>${client.user_id}</Telephone>\n`;
        xml += '  </DirectoryEntry>\n';
      });

      xml += '</PhoneDirectory>';
      return xml;

    } catch (error) {
      console.error('Error in tenantService.getPhonebook:', error);
      throw error;
    }
  }
};

module.exports = tenantService;
