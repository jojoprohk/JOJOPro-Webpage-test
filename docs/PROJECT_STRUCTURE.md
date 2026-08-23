# JoPoJo Project Structure Rules

Last updated: 2026-08-23

## Purpose

This project starts as an AI-assisted Hong Kong short-term booth, pop-up, and exhibition-space information service.

The first product is not a full marketplace. It is a controlled intake and publishing workflow:

1. Receive venue posts from a Telegram bot.
2. Use AI to extract structured fields.
3. Let Mercy review and edit.
4. Publish approved listings to a website.
5. Generate social post drafts for Instagram and Facebook.

## Hard Constraints

- Solo operation only.
- Keep cash spend minimal before validating demand.
- Do not hold rent, deposits, or buyer payments.
- Do not sign contracts on behalf of users.
- Do not use unofficial WhatsApp automation that risks account bans.
- Do not commit raw chat exports, phone numbers, API keys, tokens, or personal data.
- Every user-facing listing must show its source and last-updated time.

## Folder Rules

```text
docs/
  specs/          Approved product and technical specs
  operations/     Manual and automated operating procedures
  decisions/      Short records of important decisions

apps/
  web/            Public website and review console

packages/
  ai/             Shared parsing and content-generation logic

supabase/
  migrations/     Database schema changes
```

## Data Rules

- Raw messages go to the database or local ignored storage, never Git.
- Public listings should contain only information that a venue operator or source has already published for rental promotion.
- Phone numbers and WhatsApp links may be displayed when included in the original promotional post, but the platform does not verify ownership unless a later verified-source process exists.
- AI-generated fields must keep confidence markers until Mercy approves them.
- Approved listings must have a source URL, source type, source label, and last-reviewed timestamp.

## Naming Rules

- Code, commands, and database fields use English.
- User-facing copy uses Cantonese/Traditional Chinese by default.
- File names use kebab-case.
- Dates use `YYYY-MM-DD`.

## Cleanup Rules

- Temporary downloads go to `/tmp` or another ignored folder.
- Each spec must state what is out of scope.
- Remove stale automation drafts once a stable workflow is documented.
- Before changing a workflow rule, update the relevant document first.
