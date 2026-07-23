FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Install build dependencies for better-sqlite3, install npm packages, then clean up to keep image lite
RUN apk add --no-cache python3 make g++ sqlite-dev && \
    npm install --omit=dev && \
    apk del python3 make g++

COPY . .

EXPOSE 5175

CMD ["npm", "start"]
