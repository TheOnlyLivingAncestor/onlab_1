# Node hivatalos image
FROM node:18-alpine

# Working dir beállítása
WORKDIR /app

# package.json és package-lock.json másolása
COPY package*.json ./

# Függőségek telepítése
RUN npm install express
RUN npm install minio
RUN npm install multer
RUN npm install uuid

# Forráskód másolása
COPY server.js ./

# Konténer indulásakor ez fut
CMD ["node", "server.js"]

# A konténerben a 3000-es portot hallgatjuk
EXPOSE 3000