// models/Tenant.js
const mongoose = require("mongoose");

const SipClientSchema = new mongoose.Schema(
    {
        user_id: { type: String, required: true },
        password: { type: String, required: true }, // **IMPORTANT: Hash this in a real application!**
        user_context: { type: String, default: "" },
        enable_voicemail: { type: Boolean, default: true },
        voicemail_pin: { type: String, default: "" },
        vm_email: { type: String, default: "" },
        call_forward_unconditional: { type: String, default: "" },
        call_forward_busy: { type: String, default: "" },
        call_forward_noanswer: { type: String, default: "" },
        no_answer_timeout: { type: Number, default: 30 },
        outbound_caller_id_name: { type: String, default: "" },
        outbound_caller_id_number: { type: String, default: "" },
    },
    { _id: false }
);

const DialplanActionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true }, // Name of the extension (e.g., "local_extension", "check_voicemail")
        condition_field: { type: String, required: true }, // e.g., "destination_number"
        condition_expression: { type: String, required: true }, // e.g., "^\\*98$", "^${destination}$"
        actions: [
            // Array of actions to perform
            {
                _id: false,
                application: { type: String, required: true }, // e.g., "set", "bridge", "playback"
                data: { type: String }, // e.g., "domain_name=${tenant.domain_name}", "user/${destination}@${tenant.domain_name}"
            },
        ],
    },
    { _id: false }
);

const DialplanSchema = new mongoose.Schema(
    {
        default: { type: [DialplanActionSchema], default: [] }, // For custom dialplan entries
    },
    { _id: false }
);

// Define CallerID Schema
const CallerIdSchema = new mongoose.Schema({
  name: String,
  number: String
})

const ProfileSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        sip_port: { type: Number, required: true },
        force_register_domain: { type: String, required: true },
        force_register_realm: { type: String, required: true },
        context: { type: String, required: true },
        auth_calls: { type: Boolean, default: true },
        sip_ip: { type: String, default: "127.0.0.1" },
        rtp_ip: { type: String, default: "127.0.0.1" },
        ext_sip_ip: { type: String, default: "127.0.0.1" },
        ext_rtp_ip: { type: String, default: "127.0.0.1" },
        nat_options_ping: { type: Boolean, default: false },
        apply_nat_acl: { type: String, default: "none" },
        aggressive_nat_detection: { type: Boolean, default: false },
        accept_blind_reg: { type: Boolean, default: false },
        accept_blind_auth: { type: Boolean, default: false },
        nonce_ttl: { type: Number, default: 60 },
        manage_presence: { type: Boolean, default: true },
        dbname: { type: String, required: true },
        defaultCallerId: { type: CallerIdSchema }
    },
    { _id: false }
);

// Schema for Group Member (embedded in HuntGroup/RingGroup)
const GroupMemberSchema = new mongoose.Schema(
    {
        user_id: { type: String, required: true },
        order: { type: Number }, // For sequential hunt groups, optional for others
    },
    { _id: false }
);

// Schema for a generic Group (Hunt or Ring)
const GroupSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Group name (e.g., "sales_hunt", "support_ring")
    type: { type: String, required: true, enum: ["hunt", "ring"] }, // "hunt" or "ring"
    timeout: { type: Number, default: 60 }, // Overall timeout for the group
    members: { type: [GroupMemberSchema], default: [] }, // Array of members belonging to this group
    strategy: { type: String, enum: ["sequential", "simultaneous", "random"] }, // Only for 'hunt' type
    // Optional: An action to take if no member answers within the timeout
    no_answer_action: {
        _id: false,
        application: { type: String },
        data: { type: String },
    },
});

// Define the DID Schema (this is what's nested inside Tenant.dids)
const DIDSchema = new mongoose.Schema(
    {
        did_number: {
            type: String,
            required: true,
            unique: true, // Unique per tenant
            trim: true,
            // Add a regex validation if you want to enforce number format (e.g., only digits)
            // match: /^\+?[0-9]{7,15}$/
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        // --- Routing Fields ---
        routing_type: {
            // e.g., 'extension', 'group', 'dialplan_extension', 'external'
            type: String,
            required: true,
            enum: ["extension", "group", "dialplan_extension", "external_number", "custom"],
            default: "extension", // A sensible default
        },
        routing_target: {
            // The actual ID/name of the target
            type: String,
            required: true,
            trim: true,
        },
        // Optional: Conditions/Actions specific to the DID, if needed for complex routing
        // For simpler cases, the main dialplan will handle the actions
        call_recording: {
            // Inherited from tenant, or specified per DID
            type: String,
            enum: ["never", "always", "on_demand", "inbound_only", "outbound_only"],
            default: "never",
        },
        failover_routing_type: {
            type: String,
            enum: ["extension", "group", "dialplan_extension", "external_number", "custom", "none"],
            default: "none",
        },
        failover_routing_target: {
            type: String,
            trim: true,
            default: "",
        },
        failover_timeout: { type: Number, default: 30 },
        active: {
            // To enable/disable a DID without deleting
            type: Boolean,
            default: true,
        },
        // ... any other fields like carrier, provision_date etc.
    },
    { _id: false }
);

// Main Tenant Schema
const TenantSchema = new mongoose.Schema(
    {
        domain_name: { type: String, required: true, unique: true },
        description: { type: String },
        profile: { type: ProfileSchema, required: true }, // Ensure profile is always present
        sip_clients: { type: [SipClientSchema], default: [] },
        dialplan: { type: DialplanSchema, default: { default: [] } }, // Ensure dialplan.default is an array
        groups: { type: [GroupSchema], default: [] }, // Embedded array for hunt and ring groups
        dids: { type: [DIDSchema], default: [] }, // Embedded array for DIDs
        // Removed external_gateways as it's now a global model
    },
    { timestamps: true }
);

// Add a compound unique index to ensure group names are unique within a tenant
TenantSchema.index({ domain_name: 1, "groups.name": 1 }, { unique: true, sparse: true });
// Add a compound unique index to ensure user_ids are unique within a tenant's sip_clients
TenantSchema.index({ domain_name: 1, "sip_clients.user_id": 1 }, { unique: true, sparse: true });
// Add a compound unique index to ensure DID numbers are unique within a tenant
TenantSchema.index({ domain_name: 1, "dids.number": 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Tenant", TenantSchema);
