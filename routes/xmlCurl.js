// routes/xmlCurl.js
const express = require('express');
const router = express.Router();

const directoryController = require('../controllers/directoryController.js');
const voicemailController = require('../controllers/voicemailController.js');
const dialplanController = require('../controllers/dialplanController.js')
const configurationController = require('../controllers/configurationController.js');
const { config } = require('dotenv');

// XML Curl Entry Point
router.post('/', async (req, res) => {
  try {
    const { section, action } = req.body;

    if (!section) {
      return res.status(400).send('Missing section');
    }

    let xmlResponse;

    switch (section) {
      case 'directory':
        if (action === 'voicemail-lookup') {
          xmlResponse = await voicemailController.lookup(req.body);
        } else {
          xmlResponse = await directoryController.lookup(req.body);
        }
      break;
      case 'configuration':
        console.log('CONFIGURATION REQUESTED')
        xmlResponse = await configurationController.lookup(req.body)
      break;

      case 'dialplan':
        xmlResponse = await dialplanController.lookup(req.body)
      break;
        
      // Add other sections here if needed
      // case 'dialplan':

      // case 'phrases':

      default:
        console.warn(`Unhandled XML Curl section: ${section}`);
        return res.status(404).send('Unhandled section');
    }

    res.set('Content-Type', 'application/xml');
    res.send(xmlResponse);

  } catch (err) {
    console.error('XML Curl error:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
