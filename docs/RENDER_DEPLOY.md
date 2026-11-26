# Deploy QoreSentinel on Render

The root `render.yaml` defines one public Starter web service with a 1 GB persistent disk. `Dockerfile.render` builds the React app and API into one container, and Express serves the app and `/api` routes from the same origin. SQLite is stored on the mounted disk so registered accounts and other application data survive restarts and redeploys.

## Persistence and plan

- Render Free web services cannot attach persistent disks. The Starter plan and attached disk are required for this SQLite deployment to retain data.
- The disk is mounted at `/var/data`, and `DATABASE_PATH` points to `/var/data/qoresentinel.sqlite`.
- Persistent disk storage and paid compute incur Render charges. Check the current [Render pricing](https://render.com/pricing) before creating or applying the Blueprint.
- Persistent disks are attached to one service instance; keep this service at a single instance while it uses SQLite.

Render documents persistent disks at [Persistent Disks](https://render.com/docs/disks) and Blueprint disk configuration in the [Blueprint YAML reference](https://render.com/docs/blueprint-spec).

## Deploy

1. Confirm that commit `main` contains `render.yaml` and `Dockerfile.render`.
2. Sign in to Render and choose **New → Blueprint**.
3. Connect the GitHub repository `Jiyansh-2006/qoresentinel` and select branch **main**. Keep the Blueprint path as `render.yaml`.
4. Review the resources. It should list one web service named `qoresentinel` on the **Starter** plan with a 1 GB disk mounted at `/var/data`.
5. Enter a strong `ADMIN_INVITATION_CODE` when prompted. Keep it private; use it once to register the first administrator.
6. Choose **Deploy Blueprint** and wait for the service to finish building and become live.
7. Open `https://qoresentinel-fkbp.onrender.com/health`. It should return JSON with `status: "HEALTHY"`.
8. Open `https://qoresentinel-fkbp.onrender.com`, register an administrator with the invitation code, then register a student account to try the demo workflow. Accounts created on the old ephemeral `/tmp` database are not transferred to the new disk; register them again after the disk-backed deployment is live.

Render reads the Blueprint from the connected Git branch and prompts for values marked `sync: false` during initial creation. See [Blueprint creation](https://render.com/docs/infrastructure-as-code) and the [Blueprint environment-variable reference](https://render.com/docs/blueprint-spec).

If the `qoresentinel` name is unavailable, change the `name` in `render.yaml` and update `APP_ORIGINS` to `https://<your-service-name>.onrender.com` before deploying.

## Demo and blockchain configuration

`DEMO_MODE=true` is set in the Blueprint. The workflow remains simulated and will not submit real QoreChain transactions. Do not change it until the GrantVault contract address and signing flow are configured and verified. Delegated agent credentials are not currently used as the payout signer.

`GROQ_API_KEY` and `VITE_WALLETCONNECT_PROJECT_ID` are optional. Add them through the Render service's Environment page if you need those features. Never commit API keys, wallet keys, mnemonics, or invitation codes.
