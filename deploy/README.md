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
