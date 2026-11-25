# Deploy QoreSentinel on Render

This repository includes a Render Blueprint at `render.yaml`. It creates:

- A public Nginx web service for the React app.
- A private API service reachable by the web service over Render's private network.
- A 1 GB persistent disk for the API's SQLite database.

The API's persistent disk and Starter service are paid Render resources. The web service is configured on the Free plan. Confirm the current prices in your Render account before creating the Blueprint. The SQLite database is persistent, but this single-instance storage setup is intended for a demo, not production scale.

## Create the Render services

1. Push the repository to GitHub and make sure the desired commit is on `main`.
2. In Render, choose **New → Blueprint** and connect `Jiyansh-2006/qoresentinel`.
3. Select the `main` branch and apply the Blueprint from `render.yaml`.
4. When prompted, enter a strong value for `ADMIN_INVITATION_CODE`. Store it in a password manager; use it when registering the first administrator.
5. Wait for both services to finish their first deploy. The frontend service is named `qoresentinel-web` and the API is private.
6. Open `https://qoresentinel-web.onrender.com/health`. A successful response is JSON with `status: "HEALTHY"`.
7. Open the frontend URL, register an administrator using the invitation code, then register a student account to exercise the demo workflow.

If Render reports that the `qoresentinel-web` name is unavailable, choose a unique service name in `render.yaml` and change the API's `APP_ORIGINS` value to that service's exact `https://<name>.onrender.com` URL before applying the Blueprint.

## Demo mode and secrets

The Blueprint sets `DEMO_MODE=true`; review and payout demonstrations do not submit blockchain transactions. Do not turn this off until GrantVault is deployed, the contract address and network are verified, and the live wallet flow has been checked. The project does not currently use a delegated agent authenticator as the payout signer.

`GROQ_API_KEY` and `VITE_WALLETCONNECT_PROJECT_ID` are optional. Add them through the Render service's Environment page if you need those integrations. Never commit API keys, wallet keys, mnemonics, or invitation codes.

## Persistence and service behavior

Render's filesystem is ephemeral unless a persistent disk is attached. The API's SQLite path is set to `/var/data/qoresentinel.sqlite`, which is inside the Blueprint's disk mount. Do not remove or rename that disk mount after users have created accounts or grant records.

The free web service can spin down while idle. Its first request after idle may take longer while Render starts it again. The API's Starter service remains available so its attached disk can be mounted.

## Optional QoreChain configuration

The app remains in demo mode until live configuration is supplied. For Diana Testnet, configure `QORECHAIN_CONTRACT_ADDRESS` in the API service only after you deploy and verify the GrantVault contract on chain ID `9800`. Keep the API private and keep all wallet secrets out of frontend environment variables. Live testnet operation has not been verified by this repository setup.
