# Docker Deployment

## Build image

docker build \
 --build-arg NEXT_PUBLIC_SUPABASE_URL="<supabase-url>" \
 --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<supabase-anon-key>" \
 -t personal-task-web-app .

## Run container

docker run -d \
 --name personal-task-web-app \
 --env-file .env.local \
 -p 3000:3000 \
 personal-task-web-app

## Check logs

docker logs -f personal-task-web-app

## Stop container

docker stop personal-task-web-app

## Remove container

docker rm personal-task-web-app

## Rebuild

docker rm -f personal-task-web-app

docker build \
 --build-arg NEXT_PUBLIC_SUPABASE_URL="<supabase-url>" \
 --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<supabase-anon-key>" \
 -t personal-task-web-app .

docker run -d \
 --name personal-task-web-app \
 --restart unless-stopped \
 --env-file .env.local \
 -p 3000:3000 \
 personal-task-web-app
