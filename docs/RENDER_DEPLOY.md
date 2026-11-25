# Deploy QoreSentinel on Render's Free plan

The root `render.yaml` defines one public Free web service. `Dockerfile.render` builds the React app and API into one container, and Express serves the app and `/api` routes from the same origin. This avoids a paid API service and private networking.

## Free-plan tradeoffs

- Render stops a Free web service after 15 minutes without inbound requests. The next request starts it again and can take about a minute.
- The service filesystem is temporary. This configuration stores SQLite at `/tmp/qoresentinel.sqlite`; accounts, applications, pools, and audit records can disappear when Render restarts, sleeps, or redeploys the service.
- Free services can restart at any time and share 750 included instance hours per workspace each month.
- This is suitable for a preview or short demo, not durable production data. Render's Free Postgres also expires after 30 days, and this app currently uses SQLite at runtime.

Render documents the Free service limits at [Deploy for Free](https://render.com/docs/free).

## Deploy

1. Confirm that commit `main` contains `render.yaml` and `Dockerfile.render`.
2. Sign in to Render and choose **New → Blueprint**.
3. Connect the GitHub repository `Jiyansh-2006/qoresentinel` and select branch **main**. Keep the Blueprint path as `render.yaml`.
4. Review the resources. It should list exactly one web service named `qoresentinel`, with the **Free** plan and no attached disk or separate API service.
5. Enter a strong `ADMIN_INVITATION_CODE` when prompted. Keep it private; use it once to register the first administrator.
6. Choose **Deploy Blueprint** and wait for the service to finish building and become live.
7. Open `https://qoresentinel-fkbp.onrender.com/health`. It should return JSON with `status: "HEALTHY"`.
8. Open `https://qoresentinel-fkbp.onrender.com`, register an administrator with the invitation code, then register a student account to try the demo workflow.

Render reads the Blueprint from the connected Git branch and prompts for values marked `sync: false` during initial creation. See [Blueprint creation](https://render.com/docs/infrastructure-as-code) and the [Blueprint environment-variable reference](https://render.com/docs/blueprint-spec).

If the `qoresentinel` name is unavailable, change the `name` in `render.yaml` and update `APP_ORIGINS` to `https://<your-service-name>.onrender.com` before deploying.

## Demo and blockchain configuration

`DEMO_MODE=true` is set in the Blueprint. The workflow remains simulated and will not submit real QoreChain transactions. Do not change it until the GrantVault contract address and signing flow are configured and verified. Delegated agent credentials are not currently used as the payout signer.

`GROQ_API_KEY` and `VITE_WALLETCONNECT_PROJECT_ID` are optional. Add them through the Render service's Environment page if you need those features. Never commit API keys, wallet keys, mnemonics, or invitation codes.
