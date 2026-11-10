# The ShiftChess Railway service (accounts + online games). Build context: repository root.
FROM node:22-slim
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server/ ./
COPY src/game/ ../src/game/
COPY src/online/OnlineAuthority.ts src/online/protocol.ts ../src/online/
COPY src/services/purchases/products.ts ../src/services/purchases/products.ts
# Standalone compiler settings for tsx (the app tsconfig extends Expo, which is not installed here).
RUN printf '{"compilerOptions":{"strict":true,"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","esModuleInterop":true,"skipLibCheck":true}}' > tsconfig.json \
 && rm -rf __tests__ ../src/game/__tests__
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "main.ts"]
