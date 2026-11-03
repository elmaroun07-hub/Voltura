# Security policy

Voltura is built and run by one person. If you've found a security problem, thank you. Please report it privately so it can be fixed before anyone else uses it.

## How to report

1. **Preferred:** open this repository's **Security** tab and click **Report a vulnerability**. Only I can see the report.
2. **Or email:** elmaroun07@gmail.com, with `[Voltura security]` in the subject line.

Please don't open a public issue or pull request, and don't post details anywhere public, until a fix is live.

A useful report includes:
- the URL or file and commit affected
- the steps to reproduce
- what an attacker could do with it

I read every report. I'm one person, so please allow a few days for a reply.

## Scope

**In scope**
- The code in this repository (`main` only; older commits and branches aren't maintained)
- https://voltura-web.onrender.com
- https://voltura-api.onrender.com

**Out of scope**
- The services Voltura runs on or calls: Render, Groq, OpenStreetMap/Nominatim, NASA POWER, and the public data publishers. Report problems there to them.
- Denial of service, load testing and traffic floods
- Using up the AI features' quota. They run on a small free allowance.
- Social engineering, phishing and spam

## Rules for testing

- Use only data you created yourself. If you reach someone else's data, stop, don't keep or share it, and report what you found.
- Don't change or delete data that isn't yours.
- Keep your traffic light. One request at a time is enough to prove most problems.

## What Voltura stores

Voltura has no user accounts, passwords or payment data. It stores the calculations people run (a place name or coordinates and energy inputs) and Assistant conversations, linked to a random browser session id: a version 4 UUID kept in the browser's local storage. The id is not signed. Anyone who has it can read that browser's calculations and conversations, so it works like a password. The privacy notice is at https://voltura-web.onrender.com/privacy.html.

## What is already in place

- Rate limits on the routes that do real work: calculations, history, the Assistant and the screening.
- Agency access keys (they show single-family houses in the screening) are random, stored only as a SHA-256 hash, revocable, and every use is logged. A wrong or revoked key is refused, never treated as the public view.
- Security headers on the API, and a Content Security Policy on the web page.
- No secrets in the repository. Keys live in the hosting environment. The full git history was scanned with gitleaks before the repository went public.
- Dependencies are checked with `pnpm audit`.

## Credit

Unless you ask me not to, I'll credit you in the fix.
