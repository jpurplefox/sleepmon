FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# Vite dev server accesible desde fuera del contenedor.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
