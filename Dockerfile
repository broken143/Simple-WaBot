# Use an official Node.js image as the base
FROM node:16

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port (if needed, otherwise this is optional)
EXPOSE 3000

# Start the bot when the container starts
CMD ["node", "index.js"]
