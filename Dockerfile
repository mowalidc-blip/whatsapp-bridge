FROM node:18-slim
# إضافة Git بسرعة عشان التحميل يكمل
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 7860
CMD ["node", "index.js"]
