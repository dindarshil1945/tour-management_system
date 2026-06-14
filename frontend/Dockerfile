FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=5173
EXPOSE 5173

CMD ["npm", "run", "serve"]
