const Tenant = require("../models/tenant");

/**
 * Get all tenants.
 * @returns {Array<Object>} - Array of tenants
 */
const getAllTenants = async () => {
    const tenantsArray = await Tenant.find();
    return tenantsArray;
};

/**
 * Fetch tenant by domain name.
 * @param {string} domainName - Fully qualified domain name.
 * @returns {Promise<Object|null>} Tenant document object or null if not found.
 */
const getTenantByDomain = async (domainName) => {
    if (!domainName) return null; // Added check from user's provided code
    try {
        const tenant = await Tenant.findOne({ domain_name: domainName });
        return tenant ? tenant.toObject() : null;
    } catch (error) {
        console.error("Error in tenantService.getTenantByDomain:", error);
        throw error;
    }
};

/** Create a new tenant.
 * @param {Object} tenantData - Data for the new tenant.
 * @returns {Promise<Object>} The created tenant document object.
 * @throws {Error} If profile data is missing or tenant creation fails.
 */
const createTenant = async (tenantData) => {
    try {
        // Ensure default embedded arrays/objects are set for new tenants
        if (!tenantData.profile) {
            throw new Error("Profile data is required for a new tenant.");
        }
        if (!tenantData.sip_clients) tenantData.sip_clients = [];
        if (!tenantData.dialplan || !tenantData.dialplan.default) tenantData.dialplan = { default: [] };
        if (!tenantData.groups) tenantData.groups = [];

        const newTenant = new Tenant(tenantData);
        await newTenant.save();
        return newTenant.toObject();
    } catch (error) {
        console.error("Error in tenantService.createTenant:", error);
        throw error;
    }
};

/** Update an existing tenant by domain name.
 * @param {string} domainName - Domain name of the tenant to update.
 * @param {Object} updateData - Data to update the tenant with.
 * @returns {Promise<Object|null>} The updated tenant document object or null if not found.
 * @throws {Error} If tenant update fails.
 */
const updateTenant = async (domainName, updateData) => {
    try {
        const tenant = await Tenant.findOneAndUpdate({ domain_name: domainName }, { $set: updateData }, { new: true, runValidators: true });
        return tenant ? tenant.toObject() : null;
    } catch (error) {
        console.error("Error in tenantService.updateTenant:", error);
        throw error;
    }
};

/** Delete a tenant by domain name.
 * @param {string} domainName - Domain name of the tenant to delete.
 * @returns {Promise<boolean>} True if a tenant was deleted, false otherwise.
 * @throws {Error} If tenant deletion fails.
 */
const deleteTenant = async (domainName) => {
    try {
        const result = await Tenant.deleteOne({ domain_name: domainName });
        return result.deletedCount > 0;
    } catch (error) {
        console.error("Error in tenantService.deleteTenant:", error);
        throw error;
    }
};

// /** Find a SIP client (user) under a tenant.
//  * @param {string} tenantId - Tenant ID.
//  * @param {string} userId - SIP user ID.
//  * @returns {Object|null}
//  */
// const findSipClient = async (tenantId, userId) => {
//     const tenant = await getTenantByDomain(tenantId);
//     if (!tenant || !tenant.sip_clients) return null;
//     const user = tenant.sip_clients.find((client) => {
//         return client.user_id === userId;
//     });
//     return user;
// };

/**
   * Get all SIP clients for a specific tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @returns {Promise<Array<Object>|null>} Array of SIP client objects or null if tenant not found.
   * @throws {Error} If fetching SIP clients fails.
   */
  const getSipClients = async (domainName) => { // Existing Canvas function
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      return tenant ? tenant.sip_clients.map(client => client.toObject()) : null;
    } catch (error) {
      console.error('Error in tenantService.getSipClients:', error);
      throw error;
    }
  }

  /**
   * Find a SIP client (user) under a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} userId - SIP user ID.
   * @returns {Promise<Object|null>} SIP client object or null if not found.
   * @throws {Error} If tenant not found or fetching SIP client fails.
   */
  const findSipClient = async (domainName, userId) => { // Renamed from getSipClient, updated with JSDoc
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found'); // Added specific error
      const client = tenant.sip_clients.find(c => c.user_id === userId);
      return client ? client.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.findSipClient:', error);
      throw error;
    }
  }

  /**
   * Add a new SIP client to a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {Object} clientData - Data for the new SIP client.
   * @returns {Promise<Object>} The added SIP client object.
   * @throws {Error} If tenant not found or SIP client already exists.
   */
  const addSipClient = async (domainName, clientData) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const existingClient = tenant.sip_clients.find(client => client.user_id === clientData.user_id);
      if (existingClient) {
          throw new Error(`User ID '${clientData.user_id}' already exists for tenant '${domainName}'`);
      }

      // In a real app, hash the password before adding
      // clientData.password = crypto.createHash('sha256').update(clientData.password).digest('hex');

      tenant.sip_clients.push(clientData);
      await tenant.save();
      return clientData;
    } catch (error) {
      console.error('Error in tenantService.addSipClient:', error);
      throw error;
    }
  }

  /**
   * Update an existing SIP client for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} userId - ID of the SIP user to update.
   * @param {Object} updateData - Data to update the SIP client with.
   * @returns {Promise<Object>} The updated SIP client object.
   * @throws {Error} If tenant or SIP client not found.
   */
  const updateSipClient = async (domainName, userId, updateData) => {
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
  }

   /** Delete a SIP client from a tenant.
   * Also removes the SIP client from any groups they are a member of within the same tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} userId - ID of the SIP user to delete.
   * @returns {Promise<boolean>} True if SIP client was deleted, false otherwise.
   * @throws {Error} If tenant or SIP client not found.
   */
  const deleteSipClient = async (domainName, userId) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      // 1. Remove SIP client from the sip_clients array
      const initialClientsLength = tenant.sip_clients.length;
      tenant.sip_clients = tenant.sip_clients.filter(client => client.user_id !== userId);
      if (tenant.sip_clients.length === initialClientsLength) {
          throw new Error('SIP client not found for deletion');
      }

      // 2. Remove SIP client from all groups
   
      tenant.groups.forEach(group => {
          group.members = group.members.filter(member => member.user_id !== userId);
      });

      await tenant.save();
      return true;
    } catch (error) {
      console.error('Error in tenantService.deleteSipClient:', error);
      throw error;
    }
  }

/** Get dialplan for a specific tenant and context (default if not provided).
 * @param {Object} tenant - Tenant document.
 * @param {string} context - Dialplan context (e.g., "default").
 * @returns {Array<Object>} - Dialplan entries or empty array.
 */
const getDialplan = (tenant, context = "default") => {
    if (!tenant?.dialplan?.[context]) return [];
    return tenant.dialplan[context];
};

// --- Group Management Methods ---
  /**
   * Get all groups for a specific tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @returns {Promise<Array<Object>|null>} Array of group objects or null if tenant not found.
   * @throws {Error} If fetching groups fails.
   */
  const getGroups = async (domainName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      return tenant ? tenant.groups.map(group => group.toObject()) : null;
    } catch (error) {
      console.error('Error in tenantService.getGroups:', error);
      throw error;
    }
  }

  /**
   * Get a specific group by name for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} groupName - Name of the group.
   * @returns {Promise<Object|null>} Group object or null if not found.
   * @throws {Error} If tenant or group not found.
   */
  const getGroup = async (domainName, groupName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');
      const group = tenant.groups.find(g => g.name === groupName);
      return group ? group.toObject() : null;
    } catch (error) {
      console.error('Error in tenantService.getGroup:', error);
      throw error;
    }
  }

  /**
   * Add a new group to a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {Object} groupData - Data for the new group.
   * @returns {Promise<Object>} The added group object.
   * @throws {Error} If tenant not found or group name already exists.
   */
  const addGroup = async (domainName, groupData) => {
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
  }

  /**
   * Update an existing group for a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} groupName - Name of the group to update.
   * @param {Object} updateData - Data to update the group with.
   * @returns {Promise<Object>} The updated group object.
   * @throws {Error} If tenant or group not found.
   */
  const updateGroup = async (domainName, groupName, updateData) => {
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
  }

  /**
   * Delete a group from a tenant.
   * @param {string} domainName - Domain name of the tenant.
   * @param {string} groupName - Name of the group to delete.
   * @returns {Promise<boolean>} True if group was deleted, false otherwise.
   * @throws {Error} If tenant or group not found.
   */
  const deleteGroup = async (domainName, groupName) => {
    try {
      const tenant = await Tenant.findOne({ domain_name: domainName });
      if (!tenant) throw new Error('Tenant not found');

      const initialLength = tenant.groups.length;
      tenant.groups = tenant.groups.filter(g => g.name !== groupName);
      if (tenant.groups.length === initialLength) {
          throw new Error('Group not found for deletion');
      }
      await tenant.save();
      return true;
    } catch (error) {
      console.error('Error in tenantService.deleteGroup:', error);
      throw error;
    }
  }

module.exports = {
    getAllTenants,
    getTenantByDomain,
    createTenant,
    updateTenant,
    deleteTenant,
    findSipClient,
    getSipClients,
    addSipClient,
    updateSipClient,
    deleteSipClient,
    getGroup,
    getGroups,
    addGroup,
    updateGroup,
    deleteGroup,
    getDialplan,
};
