FROM python:3.11-slim

WORKDIR /app

COPY jobs/rollups/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY shared/python /app/shared/python
COPY jobs/rollups /app/jobs

ENV PYTHONPATH=/app/shared/python

CMD ["python", "/app/jobs/rollups.py"]
