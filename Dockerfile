# Imagen de la API de Spotter, en dos pasos: primero se compila, y la imagen final solo lleva lo necesario para ejecutar.

# 1. Compilar de TypeScript a JavaScript (necesita las dependencias de desarrollo, como typescript)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# 2. Imagen final: solo las dependencias de producción y el código ya compilado
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/build ./build
EXPOSE 1337
CMD ["node", "build/server.js"]
