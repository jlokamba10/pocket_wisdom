FROM python:3.11-slim

WORKDIR /app

COPY services/admin/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY shared/python /app/shared/python
COPY services/admin/app /app/app
COPY services/admin/alembic /app/alembic
COPY services/admin/alembic.ini /app/alembic.ini

ENV PYTHONPATH=/app/shared/python

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
