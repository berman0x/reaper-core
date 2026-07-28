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
];
