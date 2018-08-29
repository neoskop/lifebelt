FROM node:10.7.0-slim
USER node
WORKDIR /home/node
ENV NODE_ENV=development
COPY package*.json ./
RUN npm i
COPY --chown=node . ./
RUN npm run build
CMD ["npm", "run", "dev"]

FROM node:10.7.0-slim as production
USER node
WORKDIR /home/node
ENV NODE_ENV=production \
    FORCE_COLOR=1
COPY package*.json ./
RUN npm i --only=production
COPY --from=0 /home/node/dist /home/node/dist
COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]