# Central-Hub auth email branding

Two independent things control how the auth emails look:

## 1. Email content + branding (free, do this now)

Dashboard → **Authentication → Email Templates**. For each template, set the
subject and paste the matching HTML file here into the **Message body**:

| Template (dashboard) | File | Suggested subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirm your email — Central-Hub` |
| Magic Link | `magic-link.html` | `Your sign-in link — Central-Hub` |
| Invite user | `invite.html` | `You've been added to a tour — Central-Hub` |

These use Supabase's template variables (`{{ .ConfirmationURL }}`, `{{ .Email }}`) —
leave those exactly as written; Supabase fills them in. Styling is inline (email
clients ignore `<style>` blocks and external fonts), so the heading uses a serif
fallback rather than the app's Fraunces.

> The current sign-in flow is the **email link / OTP**, so the **Magic Link**
> template is the one users see most. "Confirm signup" shows on first account
> creation. "Invite user" is for the Phase B band/crew invites.

## 2. The sender name + from-address (needs Custom SMTP)

The body above is brandable for free, but the **sender** stays
`Supabase Auth <noreply@mail.app.supabase.io>` until you configure **Custom SMTP**
(Project Settings → **Auth → SMTP Settings**). Custom SMTP also lifts the built-in
mailer's **rate limit** (a few emails/hour — testing only), which you'll need once
real people sign up.

Steps:
1. Pick an email provider — **Resend** (simplest, generous free tier, clean docs),
   SendGrid, Postmark, Mailgun, or AWS SES.
2. Verify a sending domain (or use the provider's test domain to start). DNS:
   add the SPF/DKIM records the provider gives you so mail isn't marked spam.
3. In Supabase → Auth → SMTP Settings, enter the provider's host/port/user/pass and:
   - **Sender name:** `Central-Hub`
   - **Sender email:** e.g. `no-reply@yourdomain` (must be on the verified domain)
4. Save and send a test. The email now arrives as **`Central-Hub <no-reply@yourdomain>`**
   with the branded body above and no "powered by Supabase" framing.

Until a domain is ready, the free-tier templates (step 1) already make the *content*
feel like Central-Hub — only the from-line stays generic.
