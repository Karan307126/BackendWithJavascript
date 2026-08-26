# Base Node js image 
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install dependencies using Yarn (production only)
RUN yarn install --production --frozen-lockfile

# Copy the rest of the application code 
COPY . .

# Build the application 
EXPOSE 8000

# Start the application
CMD ["node", "src/index.js"]