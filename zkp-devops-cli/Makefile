PROFILE = nipulm-personal
REGION = us-east-1
BUCKET = zk-sudo-circuit-artifacts-prod

upload-bb:
	aws s3 cp ./bb s3://$(BUCKET)/bb \
		--profile $(PROFILE) \
		--region $(REGION)

upload-vk:
	aws s3 cp ./target/vk s3://$(BUCKET)/vk \
		--profile $(PROFILE) \
		--region $(REGION)

upload-artifacts: upload-bb upload-vk