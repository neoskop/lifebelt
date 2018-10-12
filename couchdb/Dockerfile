FROM node:10.7.0-slim
ENV SOURCE_TYPE=couchdb \
    NODE_ENV=production \
    FORCE_COLOR=1
RUN groupadd -g 5984 couchdb  && \
    usermod -a -G couchdb node
WORKDIR /home/node
COPY --from=neoskop/lifebelt-base:latest /home/node/ /home/node/
COPY --from=neoskop/lifebelt-base:latest /docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]