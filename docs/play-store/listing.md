# Shuchu on Google Play: everything to paste

Fill in the three `[BRACKETED]` items, then copy each part into Play Console.
Images are in [`images/`](images/).

---

## Store listing (Grow → Store presence → Main store listing)

**App name** (max 30)
```
Shuchu: Catch a Thought
```

**Short description** (max 80)
```
Catch a thought in three seconds. It waits, timed, for a calm plan later.
```

**Full description** (max 4,000)
```
Your head isn't a to-do list. Shuchu is.

Something pops into your head: call the dentist, reply to Mina, that idea for the logo. Open Shuchu, type it any old way, and it's caught. Three seconds, and it's out of your head.

CATCH IT THE MOMENT IT APPEARS
• No folders, no due dates, no priorities to pick. Messy is fine.
• Saved on your phone before the buzz, even with no signal.
• Shu, a little glass creature, keeps it safe.

IT KNOWS A QUICK ONE FROM A BIG ONE
• Every thought gets a time guess: "reply to 3 emails" is about 15 minutes.
• It learns your pace. Finish something and the next guess gets sharper.
• Errands are kept apart, for when you're out.

A CALM PLAN FOR THE TIME YOU HAVE
• Sit down and Shuchu asks one question: how long do you have?
• You get a short plan that fits, oldest worries first, with a first step.
• A quiet timer, then a little receipt of what you cleared.

ONE QUESTION EACH EVENING
• "Anything still in your head?" That's the only notification Shuchu will ever send.

YOUR COMPUTER, ONE SCAN AWAY
• Open Shuchu in any browser on your computer and scan the code. That's it: no account.
• What you catch on your phone waits at your desk within seconds, and the other way round.
• Encrypted on your devices before it syncs. Nobody else can read it, not even us.

GLASS, OR PORCELAIN
• A soft world of light and glass that tilts with your phone.
• Porcelain mode: the same calm, light and quick on any phone.

FREE, WITH SYNC IF YOU WANT IT
Shuchu is free on your phone, with no ads and no account. Shuchu Sync, which keeps your phone and computer in step, is free for 14 days, then $1.99 a month or $14.99 a year. Sync is the only part that costs anything to run, so it's the only part we charge for.

Made to lower your heart rate.
```

**App icon:** the existing icon (512 × 512 PNG): export `mobile/assets/icon.png` at 512 × 512.

**Feature graphic** (1024 × 500): [`images/feature-graphic.png`](images/feature-graphic.png)

**Phone screenshots** (1080 × 1920, in this order):
1. [`phone-1-catch.png`](images/phone-1-catch.png): Catch a thought in three seconds.
2. [`phone-2-inbox.png`](images/phone-2-inbox.png): Timed, and waiting calmly.
3. [`phone-3-linked.png`](images/phone-3-linked.png): Your computer, one scan away.
4. [`phone-4-night.png`](images/phone-4-night.png): Gentle, day and night.
5. [`phone-5-hello.png`](images/phone-5-hello.png): Made to lower your heart rate.

---

## Store settings

| Field | Answer |
| --- | --- |
| App or game | App |
| Category | **Productivity** |
| Tags | To-do list, Productivity, Notes, Planner, Focus |
| Contact email | [CONTACT EMAIL] |
| Website | https://[YOUR SITE] |
| Privacy policy | https://[YOUR SITE]/privacy |

---

## App content (Policy → App content)

**Privacy policy:** `https://[YOUR SITE]/privacy`

**Ads:** No, the app doesn't contain ads.

**App access:** All functionality is available without special access. (No login. Sync needs a computer to link with: reviewers can open `https://[YOUR SITE]/app` on any computer and scan its code; or note "Sync is optional".)

**Content rating** (questionnaire): Category *Utility, Productivity, Communication, or Other*. Answer **No** to everything: no violence, sexuality, language, controlled substances, gambling; users can't interact or share content with other users; no location sharing; no purchases of digital goods… **except**: "Does the app allow users to purchase digital goods?" → **Yes** (the Sync subscription). Expected rating: Everyone / PEGI 3.

**Target audience:** 18 and over is simplest (avoids the Families policy). 13+ is also accurate.

**News app:** No. **COVID-19 app:** No. **Data safety:** see below. **Government app:** No. **Financial features:** None. **Health:** No.

---

## Data safety (Policy → App content → Data safety)

Google lets apps leave out data that is truly end-to-end encrypted ("not readable by any intermediary, including the developer"). That covers the synced thoughts: they're sealed on the device with a key the server never sees. What does leave the device readably is the purchase record, through RevenueCat.

**Does your app collect or share any of the required user data types?** Yes

**Is all of the user data collected by your app encrypted in transit?** Yes

**Do you provide a way for users to request that their data is deleted?** Yes (in the app: Settings → Computer → Delete the synced copy; and by email)

**Data types:**

| Type | Collected | Shared | Optional? | Why |
| --- | --- | --- | --- | --- |
| Financial info → **Purchase history** | Yes | No | Optional (only if you subscribe) | App functionality (knowing a link is subscribed) |

Everything else: **not collected**.
- Tasks and notes: kept on the device; when synced, end-to-end encrypted (exempt).
- No name, email, contacts, location, photos, audio, health, messages, browsing, device or advertising IDs.
- Camera: used only on the device to read the link code; nothing is stored or sent.

(If Play ever flags "Device or other IDs" after adding RevenueCat, check that the merged manifest has no `com.google.android.gms.permission.AD_ID`; we don't use one.)

---

## Subscriptions (Monetize → Products → Subscriptions)

Create one subscription with two base plans, then connect Play to RevenueCat
(RevenueCat → Project → Google Play) and add both products to the `sync`
entitlement and the default offering.

| | Product ID | Base plan | Price | Renewal |
| --- | --- | --- | --- | --- |
| Shuchu Sync | `shuchu_sync` | `monthly` | $1.99 | every month |
| | | `yearly` | $14.99 | every year |

**Name:** Shuchu Sync
**Benefits** (shown on Play's purchase sheet, up to 4):
- Phone and computer in step within seconds
- Link with one scan, no account
- Encrypted on your devices
- Cancel any time; everything stays yours

The 14-day free trial is given by Shuchu itself from the day you link, so don't
add a Play free trial (it would stack with ours).

---

## Release (Test and release)

1. Build: in `mobile/`, `eas build --platform android --profile production` (makes the `.aab`).
2. **Internal testing** first: upload the `.aab`, add your own email as a tester, install from the link.
3. New personal developer accounts must run a **closed test with at least 12 testers for 14 days**
   before production is unlocked. Friends and family count; they just need to opt in from the link.
4. Then **Production** → Create release → upload → roll out.
