// controllers/tenantApiController.js
const tenantService = require('../services/tenantService');

const tenantApiController = {
  // --- Tenant CRUD ---
  /**
   * @api {get} /api/tenants Get All Tenants
   * @apiName GetAllTenants
   * @apiGroup Tenants
   * @apiDescription Retrieves a list of all tenants.
   * @apiSuccess {Object[]} tenants Array of tenant objects.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * [
   * {
   * "_id": "685eec202e1ded589169e328",
   * "domain_name": "tenant1.example.com",
   * "description": "Tenant 1 for example.com",
   * "profile": { ... },
   * "sip_clients": [ ... ],
   * "dialplan": { ... },
   * "groups": [ ... ],
   * "createdAt": "2025-06-29T...",
   * "updatedAt": "2025-06-29T..."
   * }
   * ]
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server while retrieving tenants.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 500 Internal Server Error
   * {
   * "error": "Failed to retrieve tenants"
   * }
   */
  getAllTenants: async (req, res) => {
    try {
      const tenants = await tenantService.getAllTenants();
      res.status(200).json(tenants);
    } catch (error) {
      console.error('API Error: Get All Tenants', error);
      res.status(500).json({ error: 'Failed to retrieve tenants' });
    }
  },

  /**
   * @api {get} /api/tenants/:domain_name Get Tenant by Domain Name
   * @apiName GetTenantByDomain
   * @apiGroup Tenants
   * @apiDescription Retrieves a single tenant by its domain name.
   * @apiParam {String} domain_name Domain name of the tenant to retrieve.
   * @apiSuccess {Object} tenant The tenant object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * {
   * "_id": "685eec202e1ded589169e328",
   * "domain_name": "tenant1.example.com",
   * "description": "Tenant 1 for example.com",
   * "profile": { ... },
   * "sip_clients": [ ... ],
   * "dialplan": { ... },
   * "groups": [ ... ],
   * "createdAt": "2025-06-29T...",
   * "updatedAt": "2025-06-29T..."
   * }
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 404 Not Found
   * {
   * "error": "Tenant not found"
   * }
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getTenantByDomain: async (req, res) => {
    try {
      const tenant = await tenantService.getTenantByDomain(req.params.domain_name);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      res.status(200).json(tenant);
    } catch (error) {
      console.error('API Error: Get Tenant by Domain', error);
      res.status(500).json({ error: 'Failed to retrieve tenant' });
    }
  },

  /**
   * @api {post} /api/tenants Create New Tenant
   * @apiName CreateTenant
   * @apiGroup Tenants
   * @apiDescription Creates a new tenant. Requires `domain_name` and a complete `profile` object.
   * @apiParam {String} domain_name Unique domain name for the tenant.
   * @apiParam {String} [description] Optional description for the tenant.
   * @apiParam {Object} profile Required profile configuration for the tenant.
   * @apiParam {Object[]} [sip_clients] Optional array of SIP client objects.
   * @apiParam {Object} [dialplan] Optional dialplan configuration object.
   * @apiParam {Object[]} [groups] Optional array of group objects.
   * @apiParamExample {json} Request-Example:
   * {
   * "domain_name": "newtenant.example.com",
   * "description": "A new tenant for testing",
   * "profile": {
   * "name": "default_profile",
   * "sip_port": 5060,
   * "force_register_domain": "newtenant.example.com",
   * "force_register_realm": "newtenant.example.com",
   * "context": "default",
   * "dbname": "sofia_reg_newtenant"
   * }
   * }
   * @apiSuccess (201 Created) {Object} tenant The newly created tenant object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 201 Created
   * {
   * "_id": "...",
   * "domain_name": "newtenant.example.com",
   * "description": "A new tenant for testing",
   * "profile": { ... },
   * "sip_clients": [],
   * "dialplan": { "default": [] },
   * "groups": [],
   * "createdAt": "...",
   * "updatedAt": "..."
   * }
   * @apiError (409 Conflict) TenantExists A tenant with the provided `domain_name` already exists.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 409 Conflict
   * {
   * "error": "Tenant with this domain name already exists."
   * }
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during tenant creation.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 500 Internal Server Error
   * {
   * "error": "Failed to create tenant"
   * }
   */
  createTenant: async (req, res) => {
    try {
      const newTenant = await tenantService.createTenant(req.body);
      res.status(201).json(newTenant);
    } catch (error) {
      console.error('API Error: Create Tenant', error);
      if (error.code === 11000) { // MongoDB duplicate key error code
          return res.status(409).json({ error: 'Tenant with this domain name already exists.' });
      }
      res.status(500).json({ error: 'Failed to create tenant' });
    }
  },

  /**
   * @api {put} /api/tenants/:domain_name Update Tenant
   * @apiName UpdateTenant
   * @apiGroup Tenants
   * @apiDescription Updates an existing tenant identified by its domain name.
   * @apiParam {String} domain_name Domain name of the tenant to update.
   * @apiParam {Object} updateData Data to update the tenant with. Only provided fields will be updated.
   * @apiParamExample {json} Request-Example:
   * {
   * "description": "Updated description for tenant1",
   * "profile.sip_port": 5061
   * }
   * @apiSuccess {Object} tenant The updated tenant object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * {
   * "_id": "...",
   * "domain_name": "tenant1.example.com",
   * "description": "Updated description for tenant1",
   * "profile": { "sip_port": 5061, ... },
   * ...
   * }
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 404 Not Found
   * {
   * "error": "Tenant not found"
   * }
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during tenant update.
   */
  updateTenant: async (req, res) => {
    try {
      const updatedTenant = await tenantService.updateTenant(req.params.domain_name, req.body);
      if (!updatedTenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      res.status(200).json(updatedTenant);
    } catch (error) {
      console.error('API Error: Update Tenant', error);
      res.status(500).json({ error: 'Failed to update tenant' });
    }
  },

  /**
   * @api {delete} /api/tenants/:domain_name Delete Tenant
   * @apiName DeleteTenant
   * @apiGroup Tenants
   * @apiDescription Deletes a tenant by its domain name.
   * @apiParam {String} domain_name Domain name of the tenant to delete.
   * @apiSuccess (204 No Content) NoContent Tenant successfully deleted.
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 404 Not Found
   * {
   * "error": "Tenant not found"
   * }
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during tenant deletion.
   */
  deleteTenant: async (req, res) => {
    try {
      const deleted = await tenantService.deleteTenant(req.params.domain_name);
      if (!deleted) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      res.status(204).send(); // No content for successful deletion
    } catch (error) {
      console.error('API Error: Delete Tenant', error);
      res.status(500).json({ error: 'Failed to delete tenant' });
    }
  },

  // --- SIP Client (User) Operations ---
  /**
   * @api {get} /api/tenants/:domain_name/users Get All SIP Clients for a Tenant
   * @apiName GetSipClients
   * @apiGroup SIPClients
   * @apiDescription Retrieves all SIP clients (users) associated with a specific tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiSuccess {Object[]} users Array of SIP client objects.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * [
   * { "user_id": "1001", "password": "...", "user_context": "tenant1", ... },
   * { "user_id": "1002", "password": "...", "user_context": "tenant1", ... }
   * ]
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getSipClients: async (req, res) => {
    try {
      const users = await tenantService.getSipClients(req.params.domain_name);
      if (users === null) return res.status(404).json({ error: 'Tenant not found' });
      res.status(200).json(users);
    } catch (error) {
      console.error('API Error: Get Tenant Users', error);
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  },

  /**
   * @api {get} /api/tenants/:domain_name/users/:user_id Get Specific SIP Client
   * @apiName GetSipClient
   * @apiGroup SIPClients
   * @apiDescription Retrieves a single SIP client by `user_id` for a given tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} user_id The ID of the SIP client to retrieve.
   * @apiSuccess {Object} user The SIP client object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * { "user_id": "1001", "password": "...", "user_context": "tenant1", ... }
   * @apiError (404 Not Found) NotFound The tenant or SIP client was not found.
   * @apiErrorExample {json} Error-Response:
   * HTTP/1.1 404 Not Found
   * {
   * "error": "User not found"
   * }
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getSipClient: async (req, res) => { // Using getSipClient for specific user by ID
    try {
      const user = await tenantService.findSipClient(req.params.domain_name, req.params.user_id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.status(200).json(user);
    } catch (error) {
      console.error('API Error: Get Specific User', error);
      res.status(500).json({ error: 'Failed to retrieve user' });
    }
  },

  /**
   * @api {post} /api/tenants/:domain_name/users Add New SIP Client
   * @apiName AddSipClient
   * @apiGroup SIPClients
   * @apiDescription Adds a new SIP client to a specified tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {Object} clientData SIP client data to add.
   * @apiParam {String} clientData.user_id Unique user ID for the SIP client.
   * @apiParam {String} clientData.password Password for the SIP client.
   * @apiParam {String} clientData.user_context Context for the user (e.g., tenant's domain).
   * @apiParamExample {json} Request-Example:
   * {
   * "user_id": "1003",
   * "password": "pass1003",
   * "user_context": "tenant1"
   * }
   * @apiSuccess (201 Created) {Object} user The newly created SIP client object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 201 Created
   * { "user_id": "1003", "password": "...", "user_context": "tenant1", ... }
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiError (409 Conflict) UserExists A SIP client with the same `user_id` already exists for this tenant.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during SIP client addition.
   */
  addSipClient: async (req, res) => {
    try {
      const newUser = await tenantService.addSipClient(req.params.domain_name, req.body);
      res.status(201).json(newUser);
    } catch (error) {
      console.error('API Error: Add SIP Client', error);
      if (error.message.includes('already exists')) {
          return res.status(409).json({ error: error.message });
      } else if (error.message.includes('Tenant not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add SIP client' });
    }
  },

  /**
   * @api {put} /api/tenants/:domain_name/users/:user_id Update SIP Client
   * @apiName UpdateSipClient
   * @apiGroup SIPClients
   * @apiDescription Updates an existing SIP client identified by `user_id` for a given tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} user_id The ID of the SIP client to update.
   * @apiParam {Object} updateData Data to update the SIP client with. Only provided fields will be updated.
   * @apiParamExample {json} Request-Example:
   * {
   * "password": "new_password",
   * "vm_enabled": false
   * }
   * @apiSuccess {Object} user The updated SIP client object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * { "user_id": "1001", "password": "new_password", "vm_enabled": false, ... }
   * @apiError (404 Not Found) NotFound The tenant or SIP client was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during SIP client update.
   */
  updateSipClient: async (req, res) => {
    try {
      const updatedUser = await tenantService.updateSipClient(req.params.domain_name, req.params.user_id, req.body);
      res.status(200).json(updatedUser);
    } catch (error) {
      console.error('API Error: Update SIP Client', error);
      if (error.message.includes('Tenant not found') || error.message.includes('SIP client not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update SIP client' });
    }
  },

  /**
   * @api {delete} /api/tenants/:domain_name/users/:user_id Delete SIP Client
   * @apiName DeleteSipClient
   * @apiGroup SIPClients
   * @apiDescription Deletes a SIP client by `user_id` from a tenant. Also removes the client from any groups.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} user_id The ID of the SIP client to delete.
   * @apiSuccess (204 No Content) NoContent SIP client successfully deleted.
   * @apiError (404 Not Found) NotFound The tenant or SIP client was not found for deletion.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during SIP client deletion.
   */
  deleteSipClient: async (req, res) => {
    try {
      const deleted = await tenantService.deleteSipClient(req.params.domain_name, req.params.user_id);
      if (!deleted) {
        return res.status(404).json({ error: 'User not found for deletion' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('API Error: Delete SIP Client', error);
      if (error.message.includes('Tenant not found') || error.message.includes('SIP client not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete SIP client' });
    }
  },

  // --- Dialplan Extension Operations ---
  /**
   * @api {get} /api/tenants/:domain_name/extensions Get All Dialplan Extensions for a Tenant
   * @apiName GetDialplanExtensions
   * @apiGroup DialplanExtensions
   * @apiDescription Retrieves all dialplan extensions associated with a specific tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiSuccess {Object[]} extensions Array of dialplan extension objects.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * [
   * { "name": "local_1001", "condition_field": "destination_number", "condition_expression": "^1001$", ... },
   * { "name": "voicemail_check", "condition_field": "destination_number", "condition_expression": "^*98$", ... }
   * ]
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getDialplanExtensions: async (req, res) => {
    try {
      const extensions = await tenantService.getDialplanExtensions(req.params.domain_name);
      if (extensions === null) return res.status(404).json({ error: 'Tenant not found' });
      res.status(200).json(extensions);
    } catch (error) {
      console.error('API Error: Get Tenant Extensions', error);
      res.status(500).json({ error: 'Failed to retrieve extensions' });
    }
  },

  /**
   * @api {get} /api/tenants/:domain_name/extensions/:extension_name Get Specific Dialplan Extension
   * @apiName GetDialplanExtension
   * @apiGroup DialplanExtensions
   * @apiDescription Retrieves a single dialplan extension by `extension_name` for a given tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} extension_name The name of the dialplan extension to retrieve.
   * @apiSuccess {Object} extension The dialplan extension object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * { "name": "local_1001", "condition_field": "destination_number", "condition_expression": "^1001$", ... }
   * @apiError (404 Not Found) NotFound The tenant or dialplan extension was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getDialplanExtension: async (req, res) => {
    try {
      const extension = await tenantService.getDialplanExtension(req.params.domain_name, req.params.extension_name);
      if (!extension) return res.status(404).json({ error: 'Extension not found' });
      res.status(200).json(extension);
    } catch (error) {
      console.error('API Error: Get Specific Extension', error);
      res.status(500).json({ error: 'Failed to retrieve extension' });
    }
  },

  /**
   * @api {post} /api/tenants/:domain_name/extensions Add New Dialplan Extension
   * @apiName AddDialplanExtension
   * @apiGroup DialplanExtensions
   * @apiDescription Adds a new dialplan extension to a specified tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {Object} extensionData Dialplan extension data to add.
   * @apiParam {String} extensionData.name Unique name for the extension within the tenant's dialplan.
   * @apiParam {String} extensionData.condition_field Field to match (e.g., "destination_number").
   * @apiParam {String} extensionData.condition_expression Regular expression for the condition.
   * @apiParam {Object[]} extensionData.actions Array of action objects ({application: String, data: String}).
   * @apiParamExample {json} Request-Example:
   * {
   * "name": "new_local_extension",
   * "condition_field": "destination_number",
   * "condition_expression": "^(1234)$",
   * "actions": [
   * { "application": "set", "data": "domain_name=${tenant.domain_name}" },
   * { "application": "bridge", "data": "user/$1@${tenant.domain_name}" }
   * ]
   * }
   * @apiSuccess (201 Created) {Object} extension The newly created dialplan extension object.
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiError (409 Conflict) ExtensionExists An extension with the same `name` already exists for this tenant.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during extension addition.
   */
  addDialplanExtension: async (req, res) => {
    try {
      const newExtension = await tenantService.addDialplanExtension(req.params.domain_name, req.body);
      res.status(201).json(newExtension);
    } catch (error) {
      console.error('API Error: Add Dialplan Extension', error);
      if (error.message.includes('already exists')) {
          return res.status(409).json({ error: error.message });
      } else if (error.message.includes('Tenant not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add dialplan extension' });
    }
  },

  /**
   * @api {put} /api/tenants/:domain_name/extensions/:extension_name Update Dialplan Extension
   * @apiName UpdateDialplanExtension
   * @apiGroup DialplanExtensions
   * @apiDescription Updates an existing dialplan extension identified by `extension_name` for a given tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} extension_name The name of the dialplan extension to update.
   * @apiParam {Object} updateData Data to update the extension with. Only provided fields will be updated.
   * @apiParamExample {json} Request-Example:
   * {
   * "actions": [
   * { "application": "bridge", "data": "user/new_target@${tenant.domain_name}" }
   * ]
   * }
   * @apiSuccess {Object} extension The updated dialplan extension object.
   * @apiError (404 Not Found) NotFound The tenant or dialplan extension was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during extension update.
   */
  updateDialplanExtension: async (req, res) => {
    try {
      const updatedExtension = await tenantService.updateDialplanExtension(req.params.domain_name, req.params.extension_name, req.body);
      res.status(200).json(updatedExtension);
    } catch (error) {
      console.error('API Error: Update Dialplan Extension', error);
      if (error.message.includes('Tenant not found') || error.message.includes('Dialplan extension not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update dialplan extension' });
    }
  },

  /**
   * @api {delete} /api/tenants/:domain_name/extensions/:extension_name Delete Dialplan Extension
   * @apiName DeleteDialplanExtension
   * @apiGroup DialplanExtensions
   * @apiDescription Deletes a dialplan extension by `extension_name` from a tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} extension_name The name of the dialplan extension to delete.
   * @apiSuccess (204 No Content) NoContent Dialplan extension successfully deleted.
   * @apiError (404 Not Found) NotFound The tenant or dialplan extension was not found for deletion.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during extension deletion.
   */
  deleteDialplanExtension: async (req, res) => {
    try {
      const deleted = await tenantService.deleteDialplanExtension(req.params.domain_name, req.params.extension_name);
      if (!deleted) {
        return res.status(404).json({ error: 'Dialplan extension not found for deletion' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('API Error: Delete Dialplan Extension', error);
      if (error.message.includes('Tenant not found') || error.message.includes('Dialplan extension not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete dialplan extension' });
    }
  },

  // --- Group Operations ---
  /**
   * @api {get} /api/tenants/:domain_name/groups Get All Groups for a Tenant
   * @apiName GetGroups
   * @apiGroup Groups
   * @apiDescription Retrieves all hunt and ring groups associated with a specific tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiSuccess {Object[]} groups Array of group objects.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * [
   * { "name": "sales_hunt", "type": "hunt", "timeout": 60, "members": [ ... ], ... },
   * { "name": "support_ring", "type": "ring", "timeout": 30, "members": [ ... ], ... }
   * ]
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getGroups: async (req, res) => {
    try {
      const groups = await tenantService.getGroups(req.params.domain_name);
      if (groups === null) {
          return res.status(404).json({ error: 'Tenant not found' });
      }
      res.status(200).json(groups);
    } catch (error) {
      console.error('API Error: Get Tenant Groups', error);
      res.status(500).json({ error: 'Failed to retrieve groups' });
    }
  },

  /**
   * @api {get} /api/tenants/:domain_name/groups/:group_name Get Specific Group
   * @apiName GetGroup
   * @apiGroup Groups
   * @apiDescription Retrieves a single hunt or ring group by `group_name` for a given tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} group_name The name of the group to retrieve.
   * @apiSuccess {Object} group The group object.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * { "name": "sales_hunt", "type": "hunt", "timeout": 60, "members": [ ... ], ... }
   * @apiError (404 Not Found) NotFound The tenant or group was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  getGroup: async (req, res) => {
    try {
      const group = await tenantService.getGroup(req.params.domain_name, req.params.group_name);
      if (!group) {
          return res.status(404).json({ error: 'Group not found' });
      }
      res.status(200).json(group);
    } catch (error) {
      console.error('API Error: Get Specific Group', error);
      res.status(500).json({ error: 'Failed to retrieve group' });
    }
  },

  /**
   * @api {post} /api/tenants/:domain_name/groups Add New Group
   * @apiName AddGroup
   * @apiGroup Groups
   * @apiDescription Adds a new hunt or ring group to a specified tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {Object} groupData Group data to add.
   * @apiParam {String} groupData.name Unique name for the group within the tenant.
   * @apiParam {String="hunt","ring"} groupData.type Type of the group.
   * @apiParam {Number} [groupData.timeout=60] Overall timeout for the group in seconds.
   * @apiParam {Object[]} [groupData.members=[]] Array of group members.
   * @apiParam {String="sequential","simultaneous","random"} [groupData.strategy] Strategy for hunt groups (required if type is 'hunt').
   * @apiParam {Object} [groupData.no_answer_action] Optional action to take if no member answers.
   * @apiParamExample {json} Request-Example:
   * {
   * "name": "support_ring",
   * "type": "ring",
   * "timeout": 30,
   * "members": [
   * { "user_id": "1003" },
   * { "user_id": "1004" }
   * ],
   * "no_answer_action": {
   * "application": "playback",
   * "data": "ivr/no_agent_available.wav"
   * }
   * }
   * @apiSuccess (201 Created) {Object} group The newly created group object.
   * @apiError (404 Not Found) TenantNotFound The tenant with the specified `domain_name` was not found.
   * @apiError (409 Conflict) GroupExists A group with the same `name` already exists for this tenant.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during group addition.
   */
  addGroup: async (req, res) => {
    try {
      const newGroup = await tenantService.addGroup(req.params.domain_name, req.body);
      res.status(201).json(newGroup);
    } catch (error) {
      console.error('API Error: Add Group', error);
      if (error.message.includes('already exists')) {
          return res.status(409).json({ error: error.message });
      } else if (error.message.includes('Tenant not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add group' });
    }
  },

  /**
   * @api {put} /api/tenants/:domain_name/groups/:group_name Update Group
   * @apiName UpdateGroup
   * @apiGroup Groups
   * @apiDescription Updates an existing hunt or ring group identified by `group_name` for a given tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} group_name The name of the group to update.
   * @apiParam {Object} updateData Data to update the group with. Only provided fields will be updated.
   * @apiParamExample {json} Request-Example:
   * {
   * "timeout": 45,
   * "members": [
   * { "user_id": "1003" }
   * ]
   * }
   * @apiSuccess {Object} group The updated group object.
   * @apiError (404 Not Found) NotFound The tenant or group was not found.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server during group update.
   */
  updateGroup: async (req, res) => {
    try {
      const updatedGroup = await tenantService.updateGroup(req.params.domain_name, req.params.group_name, req.body);
      res.status(200).json(updatedGroup);
    } catch (error) {
      console.error('API Error: Update Group', error);
      if (error.message.includes('Tenant not found') || error.message.includes('Group not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update group' });
    }
  },

  /**
   * @api {delete} /api/tenants/:domain_name/groups/:group_name Delete Group
   * @apiName DeleteGroup
   * @apiGroup Groups
   * @apiDescription Deletes a hunt or ring group by `group_name` from a tenant.
   * @apiParam {String} domain_name Domain name of the tenant.
   * @apiParam {String} group_name The name of the group to delete.
   * @apiSuccess (204 No Content) NoContent Group successfully deleted.
   * @apiError (404 Not Found) NotFound The tenant or group was not found for deletion.
   * @apiError (500 Internal Server Error) ServerError An error occurred on the server.
   */
  deleteGroup: async (req, res) => {
    try {
      const deleted = await tenantService.deleteGroup(req.params.domain_name, req.params.group_name);
      if (!deleted) {
        return res.status(404).json({ error: 'Group not found for deletion' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('API Error: Delete Group', error);
      if (error.message.includes('Tenant not found') || error.message.includes('Group not found')) {
          return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete group' });
    }
  }
};

module.exports = tenantApiController;
