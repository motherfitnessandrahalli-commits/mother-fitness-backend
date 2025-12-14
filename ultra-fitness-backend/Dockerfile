# Use lightweight Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage cache
COPY package*.json ./

# Install production dependencies
<<<<<<< HEAD
RUN npm install --omit=dev
=======
RUN npm ci --only=production
>>>>>>> 20e54a7030d51bc1c7109d6553e2ae240c2bd475

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose API port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
