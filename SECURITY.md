# Security Policy

ASC Command Center is a browser UI for the `asc` CLI. It talks to the local `asc web-server`, which holds your App Store Connect API keys, and the account setup sheet reads a `.p8` private key in the browser to hand it to that server. A flaw in how the UI handles a key, chooses which server to talk to, or runs plugins matters. Thank you for reporting one privately.

## Supported versions

Only `main` gets security fixes. The hosted UI at [cc.asccli.app](https://cc.asccli.app) is deployed from `main` on every push.

## Reporting a vulnerability

**Don't open a public issue.** Report it privately on GitHub: [**Report a vulnerability**](https://github.com/tddworks/asc-command-center/security/advisories/new) (the Security tab → *Advisories*).

Please include:

- what an attacker can do, and what they need first (a malicious web page, a crafted plugin, a crafted API response, local access, …)
- the browser, and whether you used the hosted UI or `npm run dev`
- steps or a proof of concept that reproduce it

Leave out real `.p8` keys, Key IDs, Issuer IDs and app data. Redact them in logs and screenshots.

## What to expect

- A first reply within 7 days.
- A fix on `main`, credited to you in the advisory unless you'd rather stay anonymous.
- The advisory is published once the fix is deployed.

## Scope

In scope: this web UI, including how it handles credentials entered in the account setup sheet, how it resolves the API base URL (`asc.apiBaseUrl` in `localStorage`), the plugin loader and plugin settings storage, and the GitHub Pages deployment.

Out of scope: flaws in the `asc` CLI or `asc web-server` (report those at [tddworks/asc-cli](https://github.com/tddworks/asc-cli/security)), in App Store Connect itself (report to Apple), and plugins you install yourself, which run with the page's permissions by design.
