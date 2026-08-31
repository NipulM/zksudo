FROM public.ecr.aws/lambda/nodejs:20-x86_64

RUN dnf install -y tar gzip bash which && \
    curl -fL https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash && \
    /root/.bb/bbup -v 5.0.0-nightly.20260522 && \
    cp /root/.bb/bb /usr/local/bin/bb && \
    chmod 755 /usr/local/bin/bb

COPY package*.json ${LAMBDA_TASK_ROOT}/
COPY node_modules/ ${LAMBDA_TASK_ROOT}/node_modules/

COPY dist/ ${LAMBDA_TASK_ROOT}/
COPY target/vk ${LAMBDA_TASK_ROOT}/vk

CMD ["index.handler"]