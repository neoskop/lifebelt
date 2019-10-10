FROM node:12.11.1-slim as production-deps
USER node
WORKDIR /home/node
COPY package.json yarn.lock ./
RUN yarn --prod

FROM node:12.11.1-slim as development
USER node
WORKDIR /home/node
ENV NODE_ENV=development
COPY package.json yarn.lock ./
COPY --chown=node --from=production-deps /home/node/node_modules node_modules
RUN yarn
COPY --chown=node . ./
RUN yarn build
CMD ["yarn", "dev"]

FROM node:12.11.1-slim as production
USER node
WORKDIR /home/node
ENV NODE_ENV=production \
    FORCE_COLOR=1
COPY package.json yarn.lock ./
COPY --chown=node --from=production-deps /home/node/node_modules node_modules
COPY --from=development /home/node/dist /home/node/dist
COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]