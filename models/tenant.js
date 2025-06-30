const mongoose = require('mongoose');

const SipClientSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  password: { type: String, required: true }, // **IMPORTANT: Hash this in a real application!**
  user_context: { type: String, default: '' },
  vm_enabled: { type: Boolean, default: true },
  vm_password: { type: String, default: '' },
  vm_email: { type: String, default: '' },
  call_forward_unconditional: { type: String, default: '' },
  call_forward_busy: { type: String, default: '' },
  call_forward_noanswer: { type: String, default: '' },
  no_answer_timeout: { type: Number, default: 30 }
}, { _id: false });

const DialplanActionSchema = new mongoose.Schema({
  // The structure here is simplified compared to the previous conceptual one
  // to align with how you might store actual actions for FreeSWITCH XML.
  // For dynamic values, ensure they are handled by the controller logic.
  // We'll use 'name' for the extension in the dialplan, and 'condition' to encapsulate its matching rule
  name: { type: String, required: true }, // Name of the extension (e.g., "local_extension", "check_voicemail")
  condition_field: { type: String, required: true }, // e.g., "destination_number"
  condition_expression: { type: String, required: true }, // e.g., "^\\*98$", "^${destination}$"
  actions: [ // Array of actions to perform
    {
      _id: false,
      application: { type: String, required: true }, // e.g., "set", "bridge", "playback"
      data: { type: String, required: true } // e.g., "domain_name=${tenant.domain_name}", "user/${destination}@${tenant.domain_name}"
    }
  ]
}, { _id: false });

const DialplanSchema = new mongoose.Schema({
  default: { type: [DialplanActionSchema], default: [] }
}, { _id: false });

const ProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sip_port: { type: Number, required: true },
  force_register_domain: { type: String, required: true },
  force_register_realm: { type: String, required: true },
  context: { type: String, required: true },
  auth_calls: { type: Boolean, default: true },
  sip_ip: { type: String, default: '127.0.0.1' },
  rtp_ip: { type: String, default: '127.0.0.1' },
  ext_sip_ip: { type: String, default: '127.0.0.1' },
  ext_rtp_ip: { type: String, default: '127.0.0.1' },
  nat_options_ping: { type: Boolean, default: false },
  apply_nat_acl: { type: String, default: 'none' },
  aggressive_nat_detection: { type: Boolean, default: false },
  accept_blind_reg: { type: Boolean, default: false },
  accept_blind_auth: { type: Boolean, default: false },
  nonce_ttl: { type: Number, default: 60 },
  manage_presence: { type: Boolean, default: true },
  dbname: { type: String, required: true }
}, { _id: false });


// Schema for Group Member (embedded in HuntGroup/RingGroup)
const GroupMemberSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  order: { type: Number }, // For sequential hunt groups, optional for others
}, { _id: false });

// Schema for a generic Group (Hunt or Ring)
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Group name (e.g., "sales_hunt", "support_ring")
  type: { type: String, required: true, enum: ['hunt', 'ring'] }, // "hunt" or "ring"
  timeout: { type: Number, default: 60 }, // Overall timeout for the group
  members: { type: [GroupMemberSchema], default: [] }, // Array of members belonging to this group
  strategy: { type: String, enum: ['sequential', 'simultaneous', 'random'] }, // Only for 'hunt' type
  // Optional: An action to take if no member answers within the timeout
  no_answer_action: {
    _id: false,
    application: { type: String },
    data: { type: String }
  }
});

// NEW: Schema for DID (Direct Inward Dialing)
const DIDSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true }, // The actual phone number
  routing_target_type: { type: String, required: true, enum: ['extension', 'group', 'ivr', 'custom'] }, // Type of routing target
  routing_target_id: { type: String, required: true }, // user_id, group name, IVR name, or custom string
  description: { type: String }
}, { _id: false });

// NEW: Schema for External SIP Gateway
const ExternalGatewaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  realm: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }, // **IMPORTANT: Hash this in a real application!**
  from_domain: { type: String, required: true },
  extension: { type: String }, // Optional fallback extension
  register: { type: Boolean, default: false },
  retry_seconds: { type: Number, default: 30 },
  sip_acl: { type: String, default: 'none' }, // ACL name
  proxy: { type: String }, // Outbound proxy
  expire_seconds: { type: Number, default: 3600 },
  ping_factor: { type: Number, default: 1 },
  caller_id_in_from: { type: Boolean, default: true },
  context: { type: String, default: 'default' }, // Inbound context for this gateway
  accept_blind_auth: { type: Boolean, default: true },
  aggressive_nat_detection: { type: Boolean, default: true },
  auth_calls: { type: Boolean, default: true },
  manage_presence: { type: Boolean, default: false },
  dtmf_type: { type: String, default: 'rfc2833' },
  codec_prefs: { type: String, default: 'G711ulaw,G711alaw,G729' },
  codec_string: { type: String, default: 'G711ulaw,G711alaw,G729' },
  // For auto-nat or specific IPs
  ext_sip_ip: { type: String, default: 'auto-nat' },
  ext_rtp_ip: { type: String, default: 'auto-nat' },
  force_register_domain: { type: Boolean, default: true },
  register_transport: { type: String, default: 'udp' }
}, { _id: false });


// Main Tenant Schema
const TenantSchema = new mongoose.Schema({
  domain_name: { type: String, required: true, unique: true },
  description: { type: String },
  profile: { type: ProfileSchema, required: true }, // Ensure profile is always present
  sip_clients: { type: [SipClientSchema], default: [] },
  dialplan: { type: DialplanSchema, default: { default: [] } }, // Ensure dialplan.default is an array
  groups: { type: [GroupSchema], default: [] }, // Embedded array for hunt and ring groups
  dids: { type: [DIDSchema], default: [] }, // Embedded array for DIDs
  external_gateways: { type: [ExternalGatewaySchema], default: [] } // NEW: Embedded array for external SIP gateways
}, { timestamps: true });

// Add a compound unique index to ensure group names are unique within a tenant
TenantSchema.index({ 'domain_name': 1, 'groups.name': 1 }, { unique: true, sparse: true });
// Add a compound unique index to ensure user_ids are unique within a tenant's sip_clients
TenantSchema.index({ 'domain_name': 1, 'sip_clients.user_id': 1 }, { unique: true, sparse: true });
// Add a compound unique index to ensure DID numbers are unique within a tenant
TenantSchema.index({ 'domain_name': 1, 'dids.number': 1 }, { unique: true, sparse: true });
// Add a compound unique index to ensure external gateway names are unique within a tenant
TenantSchema.index({ 'domain_name': 1, 'external_gateways.name': 1 }, { unique: true, sparse: true });


module.exports = mongoose.model('Tenant', TenantSchema);
