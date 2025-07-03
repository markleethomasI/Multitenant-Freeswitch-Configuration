// services/globalConfigService.js
const ExternalGateway = require('../models/ExternalGateway'); // Import the new global ExternalGateway model

const globalConfigService = {
  /**
   * Get all external gateways.
   * @returns {Promise<Array<Object>>} Array of external gateway objects.
   */
  getAllExternalGateways: async () => {
    try {
      const gateways = await ExternalGateway.find({});
      return gateways.map(gw => gw.toObject());
    } catch (error) {
      console.error('Error in globalConfigService.getAllExternalGateways:', error);
      throw error;
    }
  },

  /**
   * Get a specific external gateway by name.
   * @param {string} gatewayName - The name of the gateway.
   * @returns {Promise<Object|null>} Gateway object or null if not found.
   */
  getExternalGateway: async (gatewayName) => {
    try {
      const gateway = await ExternalGateway.findOne({ name: gatewayName });
      return gateway ? gateway.toObject() : null;
    } catch (error) {
      console.error('Error in globalConfigService.getExternalGateway:', error);
      throw error;
    }
  },

  /**
   * Add a new external gateway.
   * @param {Object} gatewayData - Data for the new gateway.
   * @returns {Promise<Object>} The added gateway object.
   * @throws {Error} If gateway name already exists.
   */
  addExternalGateway: async (gatewayData) => {
    try {
      const existingGateway = await ExternalGateway.findOne({ name: gatewayData.name });
      if (existingGateway) {
        throw new Error(`Gateway with name '${gatewayData.name}' already exists.`);
      }
      // In a real app, hash the password before saving!
      const newGateway = new ExternalGateway(gatewayData);
      await newGateway.save();
      return newGateway.toObject();
    } catch (error) {
      console.error('Error in globalConfigService.addExternalGateway:', error);
      throw error;
    }
  },

  /**
   * Update an existing external gateway by name.
   * @param {string} gatewayName - The name of the gateway to update.
   * @param {Object} updateData - Data to update the gateway with.
   * @returns {Promise<Object|null>} The updated gateway object or null if not found.
   */
  updateExternalGateway: async (gatewayName, updateData) => {
    try {
      const gateway = await ExternalGateway.findOneAndUpdate(
        { name: gatewayName },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      return gateway ? gateway.toObject() : null;
    } catch (error) {
      console.error('Error in globalConfigService.updateExternalGateway:', error);
      throw error;
    }
  },

  /**
   * Delete an external gateway by name.
   * @param {string} gatewayName - The name of the gateway to delete.
   * @returns {Promise<boolean>} True if gateway was deleted, false otherwise.
   */
  deleteExternalGateway: async (gatewayName) => {
    try {
      const result = await ExternalGateway.deleteOne({ name: gatewayName });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error in globalConfigService.deleteExternalGateway:', error);
      throw error;
    }
  },
};

module.exports = globalConfigService;
