// services/signalwireService.js

const fetch = require('node-fetch'); // Ensure node-fetch is installed (v2.x for require) or use native fetch if Node.js 18+

// Load SignalWire credentials from environment variables
const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const SIGNALWIRE_API_TOKEN = process.env.SIGNALWIRE_API_TOKEN;
const SIGNALWIRE_SPACE_URL = process.env.SIGNALWIRE_SPACE_URL; // e.g., 'your-space.signalwire.com'

// Basic validation for credentials on startup
if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_API_TOKEN || !SIGNALWIRE_SPACE_URL) {
    console.warn('WARNING: SignalWire API credentials or Space URL are not fully configured in environment variables. CNAM lookups may fail.');
    console.warn('Please ensure SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, and SIGNALWIRE_SPACE_URL are set.');
}

const signalwireService = {
    /**
     * Performs a CNAM lookup for a given phone number using the SignalWire API.
     * This function contains the direct API interaction logic.
     *
     * @param {string} phoneNumber The phone number to lookup (e.g., "+15551234567" or "5551234567").
     * @returns {Promise<string|null>} The CNAM (Caller ID Name) if found, otherwise null.
     * @throws {Error} If the API call fails or returns an error status.
     */
    lookupCnam: async (phoneNumber) => {
        if (!phoneNumber) {
            throw new Error('Phone number is required for CNAM lookup.');
        }

        if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_API_TOKEN || !SIGNALWIRE_SPACE_URL) {
            throw new Error('SignalWire API credentials not configured.');
        }

        // Normalize phoneNumber to ensure it starts with +1 if it's a 10-digit US number
        // Assuming your input `phoneNumber` might be `5551234567` and needs `+1` prefix
        let formattedPhoneNumber = phoneNumber;
        if (phoneNumber.length === 10 && !phoneNumber.startsWith('+1')) {
            formattedPhoneNumber = `+1${phoneNumber}`;
        } else if (!phoneNumber.startsWith('+')) {
            // If it's not a 10-digit US number, and no '+', this might be an issue.
            // For safety, SignalWire generally expects E.164.
            // Add more robust number formatting here if needed.
            console.warn(`WARN: Phone number ${phoneNumber} might not be in E.164 format. Attempting lookup as is.`);
        }

        // SignalWire Relay REST Lookup API endpoint
        // Using the endpoint provided in your last message.
        const apiUrl = `https://${SIGNALWIRE_SPACE_URL}.signalwire.com/api/relay/rest/lookup/phone_number/${formattedPhoneNumber}?include=cnam`;

        console.log(`INFO: SignalWire API CNAM lookup initiated for: ${formattedPhoneNumber}`);

        try {
            // Basic authentication: username is Project ID, password is API Token
            const authHeader = 'Basic ' + Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`).toString('base64');

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json', // Request JSON response
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`ERROR: SignalWire API responded with status ${response.status} for ${formattedPhoneNumber}: ${errorBody}`);
                // Throw an error with details to be caught by the controller
                const error = new Error('SignalWire API error');
                error.statusCode = response.status;
                error.details = errorBody;
                throw error;
            }

            const cnamData = await response.json();

            // Based on your previous logic and typical CNAM lookup responses:
            // SignalWire Relay Lookups typically return under `data.cnam.caller_id`
            // Example response structure for Relay Lookup:
            // {
            //   "data": {
            //     "country_code": "US",
            //     "number_type": "mobile",
            //     "cnam": {
            //       "caller_id": "JOHN DOE"
            //     },
            //     "carrier": { ... }
            //   },
            //   "status": "success"
            // }
       

            if (cnamData) {
                console.log(`INFO: CNAM lookup successful for ${formattedPhoneNumber}: "${cnamData.cnam}"`);
                return cnamData;
            } else {
                console.log(`INFO: CNAM not found for ${formattedPhoneNumber} or expected field missing in response.`);
                console.log('DEBUG: Full SignalWire CNAM response data:', JSON.stringify(cnamData, null, 2));
                return null;
            }

        } catch (error) {
            console.error(`ERROR: Service-level CNAM lookup failed for ${formattedPhoneNumber}:`, error.message);
            throw error; // Re-throw to be handled by the controller
        }
    },
};

module.exports = signalwireService;