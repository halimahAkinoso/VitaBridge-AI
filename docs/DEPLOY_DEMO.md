# Deploy the VitaBridge demo on Render

This Blueprint deploys the Expo web app and FastAPI backend together, with a
Render-managed PostgreSQL database. The web app uses the same origin for its
API, so no public API URL or browser CORS configuration is needed.

## Before deploying

- This is a temporary public demo. Use synthetic data only; do not enter real
  patient or other sensitive health information.
- Render's free web service can sleep after inactivity, and its free PostgreSQL
  database expires after 30 days. This is not a production or clinical hosting
  setup.
- Cognitive scores are not fabricated. The demo administrator account can
  enter clinician-reviewed results; it does not replace an approved instrument
  or clinical review.

## Create the Render service

1. Sign in to [Render](https://render.com/) and choose **New → Blueprint**.
2. Connect `halimahAkinoso/VitaBridge-AI` and select the branch containing
   `render.yaml` (normally `master`).
3. Review the Blueprint. It creates one free web service and one free PostgreSQL
   database in Frankfurt. If the service name is already taken, give it a
   unique name before continuing.
4. When prompted, enter the email and a unique password (at least 12
   characters) for the initial demo administrator. Render keeps these values
   as environment variables; never add them to the repository.
5. Start the deployment and wait for the service to become healthy.

Open the service URL shown by Render. The initial administrator can sign in
through Practitioner Access and create clinician accounts. Register separate
adult or parent accounts for the participant journeys.

## Local production-image check

From the repository root, run:

```powershell
docker build -t vitabridge-ai-demo .
```

For native mobile builds, set `EXPO_PUBLIC_API_URL` to the deployed service
URL. The relative `/api` default is intended for the deployed web app.
