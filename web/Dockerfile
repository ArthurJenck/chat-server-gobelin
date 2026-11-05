FROM node:24-alpine AS base
RUN npm install -g pnpm@10.31.0
WORKDIR /app

FROM base AS development-dependencies-env
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS production-dependencies-env
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM development-dependencies-env AS build-env
COPY . .
RUN pnpm build

FROM base
WORKDIR /srv/app
COPY package.json pnpm-lock.yaml ./
COPY --from=production-dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/build ./build
ENV PORT=8080
ENV HOST=0.0.0.0
EXPOSE 8080
CMD ["pnpm", "start"]
