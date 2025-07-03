// controllers/signalwireApiController.js

const signalwireService = require('../services/signalwireService'); // Import the new service

const signalwireApiController = {
    /**
     * Express.js controller to perform a CNAM lookup.
     * Expects a 'phoneNumber' query parameter (e.g., /cnam-lookup?phoneNumber=5551234567).
     *
     * @param {object} req - The Express request object.
     * @param {object} res - The Express response object.
     */
    lookupCnam: async (req, res) => {
        const { phoneNumber } = req.query; // Get phoneNumber from query parameters

        if (!phoneNumber) {
            console.warn('WARN: CNAM lookup request received without a phoneNumber query parameter.');
            return res.status(400).json({ error: 'Missing phoneNumber query parameter.' });
        }

        try {
            const cnamName = await signalwireService.lookupCnam(phoneNumber);

            if (cnamName) {
                return res.json({
                    phoneNumber: phoneNumber,
                    cnam: cnamName,
                    found: true
                });
            } else {
                return res.json({
                    phoneNumber: phoneNumber,
                    cnam: null,
                    found: false,
                    message: "CNAM not found or no name provided by SignalWire."
                });
            }

        } catch (error) {
            // Handle errors thrown by the service
            console.error(`ERROR: Controller-level handling of CNAM lookup for ${phoneNumber} failed:`, error.message);

            const statusCode = error.statusCode || 500; // Use status from error if available, else 500
            const errorMessage = error.details || 'Internal server error during CNAM lookup.';

            return res.status(statusCode).json({
                error: 'CNAM lookup failed.',
                details: errorMessage
            });
        }
    },
};

module.exports = signalwireApiController;