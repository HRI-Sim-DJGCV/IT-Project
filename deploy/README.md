# Backend on EC2

| | |
|---|---|
| Instance | `i-085e917feb2ee6886` (t3.small, Amazon Linux 2023, ap-southeast-2) |
| Elastic IP | `32.236.180.226` |
| API URL | `https://32-236-180-226.sslip.io/v1` |
| Access | SSM Session Manager only (no SSH; security group allows 80/443) |

The account is on the AWS free plan ($100 credits). Everything is tagged `Project=walking-meditation`.

## First deploy

Connect (AWS console → EC2 → instance → Connect → Session Manager, or `aws ssm start-session --target i-085e917feb2ee6886 --region ap-southeast-2` with the Session Manager plugin installed), then:

```bash
sudo -i
cd /opt/walking-meditation
git clone https://github.com/HRI-Sim-DJGCV/IT-Project.git app
cd app
cp deploy/.env.example deploy/.env
nano deploy/.env        # fill in MONGODB_URI, JWT_SECRET, CORS_ORIGINS, GOOGLE_MAPS_API_KEY
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
curl -s https://32-236-180-226.sslip.io/v1/health
```

In MongoDB Atlas → Network Access, allow `32.236.180.226/32`.

In Vercel, set `VITE_API_BASE_URL=https://32-236-180-226.sslip.io/v1` and redeploy the frontend.

## Updating

```bash
cd /opt/walking-meditation/app && git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
```

## Switching to the real AI service

The stack runs the AI stub (canned route, script and silent audio). Scripts come from Gemini and audio from Google Cloud Text-to-Speech, both hosted APIs, so the real service fits on the t3.small. To switch:

1. In `deploy/.env`, fill in `GEMINI_API_KEY` and, if Cloud Text-to-Speech is on a different project from the Maps key, `GOOGLE_TTS_API_KEY`. Set `AI_INTERNAL_KEY` and `INTERNAL_KEY` to the same random value.
2. In `deploy/docker-compose.prod.yml`, replace the `ai-stub` service with:

   ```yaml
   ai:
     build: ../server
     restart: unless-stopped
     env_file: .env
   ```

   and point the API at it: `AI_SERVICE_URL: http://ai:8001`, `depends_on: [ai]`.
3. Rebuild: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build`

## Saving credits

Stopping the instance pauses compute charges (the disk and Elastic IP still bill a little):

```bash
aws ec2 stop-instances --instance-ids i-085e917feb2ee6886 --region ap-southeast-2
aws ec2 start-instances --instance-ids i-085e917feb2ee6886 --region ap-southeast-2
```

## Automatic deploys

`.github/workflows/deploy-backend.yml` runs the update above whenever CI passes on `main`, so merging a pull request deploys it. It can also be started by hand from Actions → Deploy backend → Run workflow. It skips (with a warning) if the instance is stopped, and skips the rebuild if nothing under `backend/`, `shared/`, `deploy/` or `tools/ai-stub/` changed.

GitHub signs in to AWS with OIDC, so there are no AWS keys in GitHub. The role it assumes can only send commands to this one instance and can only be used by workflows on `main` of this repo (`deploy/github-actions/*.json`). One-time setup, from the repo root:

```bash
aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com
aws iam create-role --role-name walking-meditation-github-deploy --assume-role-policy-document file://deploy/github-actions/trust-policy.json --tags Key=Project,Value=walking-meditation
aws iam put-role-policy --role-name walking-meditation-github-deploy --policy-name deploy --policy-document file://deploy/github-actions/deploy-policy.json
```

Then add `arn:aws:iam::165328640519:role/walking-meditation-github-deploy` to the repo as the Actions secret `AWS_DEPLOY_ROLE_ARN` (Settings → Secrets and variables → Actions). Until it's set, the workflow skips without failing.
