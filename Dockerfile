# Build stage for frontend
FROM node:20.7 AS frontend-builder
WORKDIR /app/frontend

# Copy package.json and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Build frontend
RUN npm run build

# Final image stage
FROM python:3
WORKDIR /app

# Copy backend requirements and install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./

# Copy compiled frontend files from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Expose ports
EXPOSE 8000
EXPOSE 3000

# Install 'concurrently' globally
RUN npm install -g concurrently

# Define the command to run both backend and frontend
CMD concurrently "uvicorn main:app --reload --host 0.0.0.0 --port 8000" "npm start --prefix /app/frontend -- --port 3000"

