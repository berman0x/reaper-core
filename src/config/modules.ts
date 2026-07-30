// Configurable action modules for the Reaper monitor dashboard.
// Add / remove entries here — the UI reads this array at render time.
// The `module` string is what gets sent to the backend over WebSocket.

export type ModuleField = {
  key: "target" | "port" | "value";
  label: string;
  placeholder?: string;
  type?: "text" | "number";
  required?: boolean;
};

export type ModuleConfig = {
  id: string;              // stable UI key
  module: string;          // backend module identifier
  name: string;            // display name
  description?: string;
  category?: string;
  fields: ModuleField[];
};

export const MODULES: ModuleConfig[] = [
  {
    id: "scan",
    module: "scan",
    name: "Scan",
    description: "Run a generic scan against a target.",
    category: "recon",
    fields: [
      { key: "target", label: "Target", placeholder: "example.com", required: true },
      { key: "port", label: "Port", placeholder: "443", type: "number" },
    ],
  },
  {
    id: "enum",
    module: "enum",
    name: "Enumerate",
    description: "Enumerate resources on the target.",
    category: "recon",
    fields: [
      { key: "target", label: "Target", placeholder: "example.com", required: true },
    ],
  },
  {
    id: "detect",
    module: "detect",
    name: "Detect",
    description: "Fingerprint the target and detect stack details.",
    category: "recon",
    fields: [
      { key: "target", label: "Target", placeholder: "example.com", required: true },
    ],
  },
  {
    id: "inspect",
    module: "inspect",
    name: "Inspect",
    description: "Inspect a specific endpoint or resource.",
    category: "analysis",
    fields: [
      { key: "target", label: "Target URL", placeholder: "https://example.com", required: true },
    ],
  },
  {
    id: "monitor",
    module: "monitor",
    name: "Monitor",
    description: "Continuously monitor a target for changes.",
    category: "ops",
    fields: [
      { key: "target", label: "Target", placeholder: "example.com", required: true },
      { key: "port", label: "Interval (s)", placeholder: "30", type: "number" },
    ],
  },
  {
    id: "report",
    module: "report",
    name: "Report",
    description: "Generate a report for the given target.",
    category: "ops",
    fields: [
      { key: "target", label: "Target", placeholder: "example.com", required: true },
    ],
  },
  {
    id: "dns-telemetry",
    module: "dns-telemetry",
    name: "DNS Telemetry",
    description: "Read-only DNS record lookup (TXT, AAAA, MX) to verify domain configuration.",
    category: "network",
    fields: [
      { key: "target", label: "Domain", placeholder: "example.com", required: true },
    ],
  },
  {
    id: "host-posture-check",
    module: "host-posture-check",
    name: "Host Posture Check",
    description: "Inventory OS/patch level, running services, and open ports on hosts you own.",
    category: "posture",
    fields: [
      { key: "target", label: "Host", placeholder: "host.internal", required: true },
      { key: "port", label: "SSH Port", placeholder: "22", type: "number" },
    ],
  },
  {
    id: "ssh-key-inventory",
    module: "ssh-key-inventory",
    name: "SSH Key Inventory",
    description: "Enumerate authorized_keys on your own hosts and flag weak or duplicated keys.",
    category: "posture",
    fields: [
      { key: "target", label: "Host", placeholder: "host.internal", required: true },
      { key: "port", label: "SSH Port", placeholder: "22", type: "number" },
    ],
  },
];
