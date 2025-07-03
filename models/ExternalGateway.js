// models/ExternalGateway.js
const mongoose = require('mongoose');

// Schema for External SIP Gateway (e.g., SignalWire Trunk)
// This schema represents a global, shared gateway, not embedded within a tenant.
const ExternalGatewaySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Unique name for the gateway (e.g., "signalwire_us_east", "twilio_trunk_1")
  realm: { type: String, required: true }, // SIP domain/realm of the gateway
  username: { type: String, required: true }, // Username for registration/authentication
  password: { type: String, required: true }, // Password for registration/authentication **Hash this in production!**
  from_domain: { type: String, required: true }, // What to send in From: header
  extension: { type: String }, // Optional fallback extension if gateway doesn't route
  register: { type: Boolean, default: false }, // Whether FreeSWITCH should register to this gateway
  retry_seconds: { type: Number, default: 30 }, // How often to retry registration
  sip_acl: { type: String, default: 'none' }, // ACL name for this gateway
  proxy: { type: String }, // Outbound proxy for the gateway
  expire_seconds: { type: Number, default: 3600 }, // SIP registration expiry
  ping_factor: { type: Number, default: 1 }, // How often to send OPTIONS pings
  caller_id_in_from: { type: Boolean, default: true }, // Put Caller-ID in From header
  context: { type: String, default: 'default' }, // Inbound context for calls coming from this gateway (can be a generic 'public' context)
  accept_blind_auth: { type: Boolean, default: true },
  aggressive_nat_detection: { type: Boolean, default: true },
  auth_calls: { type: Boolean, default: true },
  manage_presence: { type: Boolean, default: false },
  dtmf_type: { type: String, default: 'rfc2833' },
  codec_prefs: { type: String, default: 'G711ulaw,G711alaw,G729' }, // Preferred inbound codecs
  codec_string: { type: String, default: 'G711ulaw,G711alaw,G729' }, // Preferred outbound codecs
  ext_sip_ip: { type: String, default: 'auto-nat' }, // For auto-nat or specific IPs
  ext_rtp_ip: { type: String, default: 'auto-nat' }, // For auto-nat or specific IPs
  force_register_domain: { type: Boolean, default: true }, // Force registration to specific domain
  register_transport: { type: String, default: 'udp' } // Transport for registration
}, { timestamps: true }); // Adds createdAt and updatedAt timestamps

// Add a unique index to ensure gateway names are unique globally
ExternalGatewaySchema.index({ 'name': 1 }, { unique: true });

module.exports = mongoose.model('ExternalGateway', ExternalGatewaySchema);