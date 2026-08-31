AWS_PROFILE_NAME := nipulm-personal

backup-prod :
	TIMESTAMP=$$(date +'%Y%m%d-%H%M%S') && \
	aws s3 mv s3://zk-sudo-lambda-packages-prod/controller-service/deployment.zip \
		s3://zk-sudo-lambda-packages-prod/controller-service/deployment-$${TIMESTAMP}.zip \
		--profile $(AWS_PROFILE_NAME) || echo "No existing deployment.zip found"

upload-prod :
	aws s3 cp deployment.zip s3://zk-sudo-lambda-packages-prod/controller-service/deployment.zip \
		--profile $(AWS_PROFILE_NAME)

update-prod :
	aws lambda update-function-code \
		--function-name zk-sudo-controller-service-prod \
		--s3-bucket zk-sudo-lambda-packages-prod \
		--s3-key controller-service/deployment.zip \
		--profile $(AWS_PROFILE_NAME)

do-all :
	npm run format
	npm run build
	cd dist && zip -r ../deployment.zip .
	$(MAKE) backup-prod
	$(MAKE) upload-prod
	$(MAKE) update-prod