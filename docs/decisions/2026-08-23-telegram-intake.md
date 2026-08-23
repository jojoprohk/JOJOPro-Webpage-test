# ADR: Use Telegram Intake Before WhatsApp API

Date: 2026-08-23

## Decision

Use a Telegram bot as the first automated intake channel for venue posts. Do not use WhatsApp Business App scraping or unofficial automation.

## Reason

Mercy already has a WhatsApp Business App number for human outreach, but WhatsApp Business App does not provide a stable official API for outside systems to read messages automatically. Unofficial automation risks account bans.

Telegram bots are free, stable, and easy to connect to AI and a database. The MVP mainly needs Mercy and trusted contributors to forward posts, so Telegram is sufficient for validation.

## Later Review

Revisit WhatsApp Cloud API or a provider after 30 days if:

- 20+ valid posts arrive per week;
- venue operators ask to send posts directly through WhatsApp;
- the intake workflow clearly saves time.

At that point, use a separate number for the bot and keep Mercy's existing WhatsApp Business App number for human contact.
