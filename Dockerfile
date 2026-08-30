# Base Node js image 
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Enable Yarn
RUN corepack enable

# Install production dependencies first
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production \
    && yarn cache clean

# Copy application
COPY --chown=node:node . .

# Don't run application as root
USER node

EXPOSE 8000

# Start the application
CMD ["node", "src/index.js"]