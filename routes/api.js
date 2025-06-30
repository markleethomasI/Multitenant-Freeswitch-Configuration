// routes/api.js

const express = require('express');
const router = express.Router();
const tenantApiController = require('../controllers/tenantApiController'); // NEW: Import the new API controller

// --- Tenant Routes ---
router.get('/tenants', tenantApiController.getAllTenants);
router.get('/tenants/:domain_name', tenantApiController.getTenantByDomain);
router.post('/tenants', tenantApiController.createTenant);
router.put('/tenants/:domain_name', tenantApiController.updateTenant);
router.delete('/tenants/:domain_name', tenantApiController.deleteTenant); // Updated to use controller method

// // --- SIP Client (User) Routes ---
router.get('/tenants/:domain_name/users', tenantApiController.getSipClients);
router.get('/tenants/:domain_name/users/:user_id', tenantApiController.getSipClient);
router.post('/tenants/:domain_name/users', tenantApiController.addSipClient);
router.put('/tenants/:domain_name/users/:user_id', tenantApiController.updateSipClient);
router.delete('/tenants/:domain_name/users/:user_id', tenantApiController.deleteSipClient);

// // --- Dialplan Extension Routes ---
// router.get('/tenants/:domain_name/extensions', tenantApiController.getDialplanExtensions);
// router.get('/tenants/:domain_name/extensions/:extension_name', tenantApiController.getDialplanExtension);
// router.post('/tenants/:domain_name/extensions', tenantApiController.addDialplanExtension);
// router.put('/tenants/:domain_name/extensions/:extension_name', tenantApiController.updateDialplanExtension);
// router.delete('/tenants/:domain_name/extensions/:extension_name', tenantApiController.deleteDialplanExtension);

// --- Group Routes ---
router.get('/tenants/:domain_name/groups', tenantApiController.getGroups);
router.get('/tenants/:domain_name/groups/:group_name', tenantApiController.getGroup);
router.post('/tenants/:domain_name/groups', tenantApiController.addGroup);
router.put('/tenants/:domain_name/groups/:group_name', tenantApiController.updateGroup);
router.delete('/tenants/:domain_name/groups/:group_name', tenantApiController.deleteGroup);

module.exports = router;