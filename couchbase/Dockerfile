FROM node:12.11.1-slim
ENV COUCHBASE_VERSION=4.5.1 \
    SOURCE_TYPE=couchbase \
    NODE_ENV=production \
    FORCE_COLOR=1
USER root
RUN apt-get -q update && \
    apt-get -y install python && \
    rm -rf /var/lib/apt/lists/*
RUN wget -qO- https://github.com/couchbase/couchbase-cli/archive/$COUCHBASE_VERSION.tar.gz | tar xz -C /opt && \
    ln -s /opt/couchbase-cli-$COUCHBASE_VERSION/cbbackup /usr/local/bin/cbbackup && \
    ln -s /opt/couchbase-cli-$COUCHBASE_VERSION/cbrestore /usr/local/bin/cbrestore
USER node
WORKDIR /home/node
COPY --from=neoskop/lifebelt-base:latest /home/node/ /home/node/
COPY --from=neoskop/lifebelt-base:latest /docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]