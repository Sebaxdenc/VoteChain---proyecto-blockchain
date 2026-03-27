# Generar la imagen para la API
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .

RUN python -m pip install --no-cache-dir -r requirements.txt

# Necesitamos tener el daemon de docker accesible si vamos a usar subprocesos
RUN apt-get update && apt-get install -y docker.io

COPY app /app/app

# Variables de entorno
ENV HOST=0.0.0.0
ENV PORT=8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]