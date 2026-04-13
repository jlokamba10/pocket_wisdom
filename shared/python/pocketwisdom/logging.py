import logging
import os
import sys
from pythonjsonlogger import jsonlogger


class PocketWisdomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record.setdefault("level", record.levelname)
        log_record.setdefault("logger", record.name)
        log_record.setdefault("timestamp", self.formatTime(record, self.datefmt))


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    formatter = PocketWisdomJsonFormatter("%(timestamp)s %(level)s %(name)s %(message)s")
    handler.setFormatter(formatter)

    handlers = [handler]
    log_file = os.getenv("PW_LOG_FILE")
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)

    root = logging.getLogger()
    root.handlers = handlers
    root.setLevel(level.upper())
