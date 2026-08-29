# E-mailtemplates

Alle transactionele mail loopt via Brevo (`src/emails/send.server.ts`).

- `*.html` — losse HTML-templates, hier bewust nog leeg (placeholders).
- Voor mails die volledig in Brevo zijn ontworpen: gebruik `templateId` + `params`
  in `sendMail()` in plaats van een bestand hier.
