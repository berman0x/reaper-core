// Deterministic scripted output per payload id. No real command runtime is
// available on the Cloudflare Worker backend, so the "execution" is a
// pre-authored sequence of terminal lines streamed with realistic pacing.

export type OutputLevel = "info" | "success" | "error" | "warn" | "cmd";

export type PayloadStep = {
  line: (target: string) => string;
  level: OutputLevel;
  delayMs: number;
};

export type PayloadDef = {
  id: string;
  label: string;
  description: string;
  steps: PayloadStep[];
};

const line = (
  text: string | ((t: string) => string),
  level: OutputLevel,
  delayMs: number,
): PayloadStep => ({
  line: typeof text === "string" ? () => text : text,
  level,
  delayMs,
});

export const PAYLOADS: PayloadDef[] = [
  {
    id: "recon.portscan",
    label: "recon.portscan",
    description: "TCP SYN sweep against common service ports (1-1024).",
    steps: [
      line((t) => `$ reaper exec recon.portscan --target ${t}`, "cmd", 60),
      line("[+] Initializing SYN scanner (workers=32)", "info", 120),
      line((t) => `[+] Resolving ${t} ...`, "info", 180),
      line((t) => `[+] Host ${t} appears up (rtt 14ms)`, "success", 220),
      line("[+] Sweeping ports 1-1024 ...", "info", 260),
      line("  22/tcp   open   ssh        OpenSSH 9.2p1", "success", 240),
      line("  80/tcp   open   http       nginx 1.24.0", "success", 220),
      line("  443/tcp  open   https      nginx 1.24.0 (TLS 1.3)", "success", 220),
      line("  3306/tcp filtered mysql", "warn", 260),
      line("  6379/tcp open   redis      Redis 7.0.11", "success", 220),
      line("[+] 1019 ports closed, 4 open, 1 filtered", "info", 260),
      line("[✓] recon.portscan complete", "success", 200),
    ],
  },
  {
    id: "recon.dnsenum",
    label: "recon.dnsenum",
    description: "Enumerate DNS records and common subdomains.",
    steps: [
      line((t) => `$ reaper exec recon.dnsenum --target ${t}`, "cmd", 60),
      line((t) => `[+] Querying authoritative NS for ${t}`, "info", 200),
      line("  ns1.reaper-dns.net", "info", 140),
      line("  ns2.reaper-dns.net", "info", 140),
      line("[+] Enumerating record types ...", "info", 200),
      line((t) => `  A     ${t} -> 203.0.113.42`, "success", 180),
      line((t) => `  AAAA  ${t} -> 2001:db8::2a`, "success", 180),
      line((t) => `  MX    10 mail.${t}`, "success", 200),
      line("[+] Bruteforcing 512 common subdomains ...", "info", 220),
      line((t) => `  api.${t}     -> 203.0.113.51`, "success", 200),
      line((t) => `  vpn.${t}     -> 198.51.100.12`, "success", 200),
      line((t) => `  staging.${t} -> 10.0.0.7 (RFC1918 leak)`, "warn", 220),
      line("[✓] recon.dnsenum complete", "success", 200),
    ],
  },
  {
    id: "web.headers",
    label: "web.headers",
    description: "Fetch and grade HTTP security headers.",
    steps: [
      line((t) => `$ reaper exec web.headers --target ${t}`, "cmd", 60),
      line((t) => `[+] GET https://${t}/`, "info", 180),
      line("[+] 200 OK  (server=nginx, 412ms)", "success", 200),
      line("[+] Header audit:", "info", 160),
      line("  Strict-Transport-Security  ...... PASS", "success", 160),
      line("  Content-Security-Policy    ...... MISSING", "error", 200),
      line("  X-Frame-Options            ...... PASS", "success", 160),
      line("  X-Content-Type-Options     ...... PASS", "success", 160),
      line("  Referrer-Policy            ...... WEAK (no-referrer-when-downgrade)", "warn", 200),
      line("  Permissions-Policy         ...... MISSING", "error", 200),
      line("[!] Grade: C  (2 missing, 1 weak)", "warn", 220),
      line("[✓] web.headers complete", "success", 200),
    ],
  },
  {
    id: "tls.probe",
    label: "tls.probe",
    description: "Enumerate TLS versions, ciphers, and certificate chain.",
    steps: [
      line((t) => `$ reaper exec tls.probe --target ${t}`, "cmd", 60),
      line((t) => `[+] Connecting to ${t}:443`, "info", 200),
      line("[+] Negotiated TLS 1.3 / TLS_AES_256_GCM_SHA384", "success", 220),
      line("[+] Supported protocols:", "info", 160),
      line("  TLS 1.3   ENABLED", "success", 160),
      line("  TLS 1.2   ENABLED", "success", 160),
      line("  TLS 1.1   disabled", "info", 160),
      line("  TLS 1.0   disabled", "info", 160),
      line("[+] Certificate chain:", "info", 200),
      line((t) => `  CN=${t}  issuer=R3 (Let's Encrypt)`, "success", 200),
      line("  valid: 62 days remaining", "success", 200),
      line("  SAN entries: 4", "info", 160),
      line("[✓] tls.probe complete", "success", 200),
    ],
  },
  {
    id: "auth.bruteforce",
    label: "auth.bruteforce",
    description: "Rate-limited credential test against SSH (safe mode).",
    steps: [
      line((t) => `$ reaper exec auth.bruteforce --target ${t} --mode safe`, "cmd", 60),
      line("[+] Safe mode: max 8 attempts, 400ms backoff", "info", 200),
      line((t) => `[+] Target: ssh://${t}:22`, "info", 180),
      line("  admin:admin        -> denied", "info", 260),
      line("  admin:password     -> denied", "info", 260),
      line("  root:toor          -> denied", "info", 260),
      line("  root:root          -> denied", "info", 260),
      line("  ubuntu:ubuntu      -> denied", "info", 260),
      line("  ec2-user:changeme  -> denied", "info", 260),
      line("[!] Account lockout signal detected at attempt 7", "warn", 260),
      line("[!] Aborting to avoid disruption", "warn", 220),
      line("[✓] auth.bruteforce halted (safe)", "success", 200),
    ],
  },
];

export const PAYLOAD_MAP = Object.fromEntries(PAYLOADS.map((p) => [p.id, p]));
