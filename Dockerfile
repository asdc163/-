# =========================================================
# HL × Aster Arbitrage Bot — Docker image
# Base: Python 3.11 slim
# =========================================================
FROM python:3.11-slim

WORKDIR /app

# Install OS dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (Docker layer cache)
COPY arbitrage_bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the bot
COPY arbitrage_bot/ .

# Create log directory
RUN mkdir -p logs

# The bot reads ARB_KEY_PASSWORD from environment
# Pass with: docker run -e ARB_KEY_PASSWORD="..." ...
ENV ARB_KEY_PASSWORD=""

# Run the bot
CMD ["python", "main.py"]
