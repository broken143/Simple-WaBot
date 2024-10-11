# Use an official Node.js image as the base
FROM node:16

RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    webp && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/broken143/Simple-WaBot
WORKDIR /Simple-WaBot
RUN npm install
CMD ["node", "index.js"]
