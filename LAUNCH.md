# Launching Shuchu: what's left, in order

Everything that can be done in code is done. What's below needs your accounts,
your name or your bank, so only you can do it. Tick them off in order; each
step works on its own, so you can stop after any of them.

## 1. Put the site live on Cloudflare (10 min, free)

- [ ] Make an account at cloudflare.com.
- [ ] Workers & Pages → Create → Import a repository → `shuchu-web`.
      Build command `npm run build`, deploy command `npx wrangler deploy`.
- [ ] Open the address it gives you (`shuchu.<name>.workers.dev`). Check:
      the site, `/app`, `/flight`, `/privacy`, `/terms`.
- [ ] Optional: your own domain (worker → Settings → Domains), about $10 a year.
- [ ] Delete the old Vercel project once Cloudflare works.

## 2. Fill in your details (5 min)

Search both repos for `[` and replace:

| Placeholder | Where | Example |
| --- | --- | --- |
| `[YOUR NAME OR BUSINESS NAME]` | `shuchu-web/privacy.html`, `terms.html` | Jane Doe, or Shuchu Ltd |
| `[COUNTRY]` | same | United Kingdom |
| `[CONTACT EMAIL]` | same, and `docs/play-store/listing.md` | a new address just for Shuchu |
| `[YOUR SITE]` | `docs/play-store/listing.md`, `docs/app-store/README.md` | shuchu.app |

Tip: make a separate email for Shuchu (support@ your domain, or a free one);
it goes on public pages.

## 3. The new Android app (15 min + waiting)

- [ ] In `shuchu/mobile`: `eas build --platform android --profile preview`.
- [ ] Install the `.apk` on your phone; link it to the web app with the QR code.
- [ ] Put the new download link in `shuchu-web/src/release.ts` (or send it to Claude).

## 4. Use it yourself for a week

- [ ] Catch real thoughts, plan real sessions, link phone and computer.
      The 14-day Sync trial means no payment setup is needed yet.
- [ ] Note anything that feels slow, confusing or wrong.

## 5. Turn on payments (30–45 min)

You must be 18 (or have a parent or guardian own these accounts).

- [ ] **Business bank account** (or a separate personal one) for Shuchu money.
- [ ] **Stripe**: sign up, verify your identity, add the bank account.
- [ ] **RevenueCat**: sign up; follow `shuchu-web/README.md` → *Hosting and selling Sync*:
      entitlement `sync`, the two plans, connect Stripe, make the Web Purchase Link.
- [ ] Put the purchase link in `shuchu-web/wrangler.jsonc` → `RC_WEB_PURCHASE_URL`.
- [ ] In Cloudflare (worker → Settings → Variables and Secrets), add secrets
      `RC_SECRET_KEY` and `RC_WEBHOOK_AUTH`; add the webhook in RevenueCat.
- [ ] Test with RevenueCat's sandbox (test card `4242 4242 4242 4242`).
- [ ] Decide your refund promise: the terms say web purchases can be refunded
      within 14 days. Change it in `terms.html` if you want something else.

## 6. Google Play (1–2 hours, then a 14-day test)

- [ ] Play Console account ($25 once, identity check).
- [ ] Create the app; paste everything from `docs/play-store/listing.md`;
      upload the images from `docs/play-store/images/`.
- [ ] Create the `shuchu_sync` subscription (monthly + yearly), connect Play to RevenueCat,
      put the Android public key in `mobile/app.json` → `expo.extra.revenuecat.android`.
- [ ] `eas build --platform android --profile production` → upload to **Internal testing**.
- [ ] New accounts: a **closed test with 12+ testers for 14 days** (friends and family),
      then apply for Production.

## 7. iPhone (when ready)

- [ ] Apple Developer Program ($99 a year).
- [ ] Follow `docs/app-store/README.md`: build, TestFlight, subscriptions, listing
      (screenshots are in `docs/app-store/images/`), App Privacy, review.

## 8. Money and tax (ongoing, mostly automatic)

- Stripe pays web sales into your bank every few days; Google and Apple monthly.
  Their fees are taken off first. Nothing to move by hand.
- [ ] Keep Shuchu money in its own account and set aside a share for tax.
- [ ] Check with a local accountant (or your country's tax office website) how
      to declare it: in many countries small online income is simple to report.
- [ ] Cloudflare: free until a few hundred daily users; then the $5/month plan
      (add a card under Billing when the dashboard suggests it).

## When something breaks

- The site and Sync: Cloudflare → Workers → `shuchu` → Logs.
- Payments: RevenueCat → Customers (search by the link id) and Stripe → Payments.
- Every push runs the automatic checks (GitHub → Actions); a red ✗ means don't deploy that change.
