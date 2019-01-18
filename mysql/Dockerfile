FROM node:10.7.0-slim
ENV SOURCE_TYPE=mysql \
    NODE_ENV=production \
    FORCE_COLOR=1 \
    DEBIAN_CODENAME=jessie
USER root
RUN . /etc/os-release && \
    wget https://repo.percona.com/apt/percona-release_0.1-4.${DEBIAN_CODENAME}_all.deb && \
    dpkg -i percona-release_0.1-4.${DEBIAN_CODENAME}_all.deb && \
    apt-get -qq update && apt-get -qq install -y percona-xtrabackup-24 qpress mysql-client && \
    rm percona-release_0.1-4.${DEBIAN_CODENAME}_all.deb
RUN groupadd -g 999 mysql && \
    useradd -u 999 -g 999 mysql && \
    usermod -a -G mysql node
USER node
WORKDIR /home/node
COPY --from=neoskop/lifebelt-base:latest /home/node/ /home/node/
COPY --from=neoskop/lifebelt-base:latest /docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]