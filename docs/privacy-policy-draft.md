# Privacy Policy — DRAFT, not legal advice

**This is a starting draft for a lawyer or the app owner to review and finalize before
publishing anywhere, including in App Store Connect or the Play Console.** It describes only
what the code in this repository actually does, generated from the schema and Edge Functions,
not a legal judgment about what disclosures are required in any jurisdiction.

_Last generated: reflects the schema and functions as of this repo's current state. Regenerate
this section whenever a new data type is collected._

## What we collect

- **Account info**: your email, or the name and email Apple/Google share when you sign in with
  them. Apple lets you hide your real email; we store whatever address they give us.
- **Profile info**: username, display name, bio, city/region/country, avatar photo — all things
  you choose to add.
- **Location and activity data**: precise GPS location while you are recording an activity,
  plus the resulting route, distance, pace, elevation, and time. This is the core purpose of the
  app and is never collected outside an active recording.
- **Photos** you attach to an activity.
- **Comments and kudos** you post.
- **Device and crash data**: device model, OS version, app version, and crash reports, used
  only to fix bugs — never linked to your location or activity content, and never used for
  advertising.
- **Push notification token**, so we can notify you about kudos, comments, and follows.

## What we do not do

- No advertising, no ad tracking, no sale of your data.
- No use of your fitness or location data for anything other than showing it back to you and
  the people you choose to share it with.
- No App Tracking Transparency prompt, because we do no cross-app tracking.

## Who can see your data

- Your activities are visible to everyone, to your followers, or only to you — your choice,
  per activity, changeable any time.
- The start and end of your route can be hidden near places you mark as private (home, work),
  independent of the activity's overall visibility.
- A private account requires your approval before someone can follow you and see anything
  beyond your name and photo.
- Anyone you block cannot see your activities, follow you, or comment on anything of yours,
  regardless of your visibility settings.

## Your controls

- Edit or delete your profile, activities, comments, and photos at any time.
- Delete your account entirely, in-app, under Settings → Delete account. This permanently
  removes your account, activities, photos, and all associated files, and cannot be undone.
- [NEEDS HUMAN] Add a contact email here for privacy questions and data requests, and a mailing
  address if your jurisdiction requires one.
- [NEEDS HUMAN] Add a data retention statement if you keep backups longer than the live
  database (see the master plan's weekly Storage backup job).

## Children

[NEEDS HUMAN] State the minimum age (the master plan recommends 16) and confirm the app does
not knowingly collect data from anyone under it.

## Changes to this policy

[NEEDS HUMAN] Add how you'll notify users of changes (e.g., in-app notice, email) and the
effective date of the current version.
