AWS_PROFILE=nipulm-personal
AWS_REGION=us-east-1

LAMBDA_BUCKET=zk-sudo-lambda-packages-prod
LAMBDA_KEY=admin-service/deployment.zip
FUNCTION_NAME=zk-sudo-admin-service-prod

.PHONY: install dev typecheck lint test build package backup-prod upload-prod update-prod do-all clean

install:
	npm install

dev:
	npm run dev

typecheck:
	npm run typecheck

lint:
	npm run lint

build:
	npm run build

package: build
	rm -f deployment.zip
	zip -r deployment.zip dist/* package.json

backup-prod:
	TIMESTAMP=$$(date +'%Y%m%d-%H%M%S') && \
	AWS_PROFILE=$(AWS_PROFILE) aws s3 mv \
		s3://$(LAMBDA_BUCKET)/$(LAMBDA_KEY) \
		s3://$(LAMBDA_BUCKET)/admin-service/deployment-$${TIMESTAMP}.zip \
	|| echo "No existing deployment.zip found"

upload-prod:
	AWS_PROFILE=$(AWS_PROFILE) aws s3 cp \
		deployment.zip \
		s3://$(LAMBDA_BUCKET)/$(LAMBDA_KEY)

update-prod:
	AWS_PROFILE=$(AWS_PROFILE) aws lambda update-function-code \
		--region $(AWS_REGION) \
		--function-name $(FUNCTION_NAME) \
		--s3-bucket $(LAMBDA_BUCKET) \
		--s3-key $(LAMBDA_KEY)

do-all:
	npm run format
	npm run typecheck
	$(MAKE) package
	$(MAKE) backup-prod
	$(MAKE) upload-prod
	$(MAKE) update-prod

clean:
	rm -rf dist node_modules deployment.zip
