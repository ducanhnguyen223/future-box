# FutureBoxes

An Expo / React Native app for creating personal time capsules and opening them at a chosen date.

## What it does

- Sign up and sign in with Supabase Auth.
- Save a note, an optional JPEG/PNG photo, an unlock time and an optional yes/no follow-up question.
- Browse countdowns and open boxes when server time allows; boxes can be edited or deleted only while locked.
- Register for push notifications. The repository includes a Supabase Edge Function for due-box notifications, but deploying and scheduling it is a separate setup step.

The `open_box` database function checks the unlock time on the server rather than trusting the device clock.

## Stack

Expo, React Native, TypeScript, Expo Router, Supabase Auth / Postgres / Storage, Expo Notifications.

## Run locally

1. Install dependencies with `npm ci`.
2. Create a Supabase project, then copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Apply `supabase/migrations/0001_init.sql` and `0002_guard_box_delete.sql` in order. Create a private Storage bucket named `box-photos` and configure owner-scoped policies for paths under `<user-id>/` as described in `design/database/schema.md`.
4. Start Expo with `npm start` and choose a target platform.

Only the public anon key belongs in the client configuration; never put a Supabase service-role key in the app.

## Checks

```sh
npm test
npm run lint
```

Push notifications also require deploying `supabase/functions/notify-due-boxes` with server-side Supabase credentials and configuring a schedule. This repository does not include a hosted-app deployment configuration.
