# Nosrati Gym & Corrective Movement Center — deployment tasks.
#
# On a fresh VPS you normally need only:
#     ./scripts/bootstrap-vps.sh
# which runs setup -> deploy -> ssl for you.

.PHONY: help setup deploy up up-prebuilt down restart logs ps ssl images load-images backup shell dev

help:
	@echo "Nosrati Gym Management - available targets"
	@echo ""
	@echo "  First-time deploy on a VPS:"
	@echo "    ./scripts/bootstrap-vps.sh   installs Docker, writes .env, deploys, gets SSL"
	@echo ""
	@echo "  setup         create .env (generates a random initial admin password)"
	@echo "  deploy        build the image and start the stack"
	@echo "  up            start the stack (builds if the image is missing)"
	@echo "  up-prebuilt   start without building (image already loaded)"
	@echo "  down          stop the stack"
	@echo "  restart       restart the app container"
	@echo "  logs          follow the app logs"
	@echo "  ps            show container status"
	@echo "  ssl           configure host nginx + Let's Encrypt for DOMAIN"
	@echo "  images        build the image and pack it into dist/ (run on your machine)"
	@echo "  load-images   load that bundle on the server"
	@echo "  backup        snapshot the SQLite database into backups/"
	@echo "  shell         open a shell inside the app container"
	@echo "  dev           run the server locally without Docker (node --watch)"

setup:
	@bash scripts/setup-env.sh

deploy:
	docker compose up -d --build
	@echo ""
	@echo "Stack is up. Local port: $$(grep -E '^APP_HTTP_PORT=' .env | cut -d= -f2)"

up:
	docker compose up -d

up-prebuilt:
	docker compose up -d --no-build

down:
	docker compose down

restart:
	docker compose restart app

logs:
	docker compose logs -f app

ps:
	docker compose ps

ssl:
	@bash scripts/deploy-host-nginx.sh

images:
	@bash scripts/build-images.sh

load-images:
	@bash scripts/load-images.sh

backup:
	@bash scripts/backup.sh

shell:
	docker compose exec app sh

dev:
	npm run dev
