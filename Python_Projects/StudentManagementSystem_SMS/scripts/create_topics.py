"""Create the event topics and their dead-letter topics (idempotent).

Usage: python scripts/create_topics.py
"""

from __future__ import annotations

import asyncio
import os

from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from aiokafka.errors import TopicAlreadyExistsError

from sms_common.config import _find_env_file
from sms_common.events import Topics

PARTITIONS = 3


async def main() -> None:
    env = _find_env_file()
    bootstrap = os.environ.get("KAFKA_BOOTSTRAP_SERVERS")
    if not bootstrap and env:
        for line in open(env, encoding="utf-8"):
            if line.startswith("KAFKA_BOOTSTRAP_SERVERS="):
                bootstrap = line.split("=", 1)[1].strip()
    bootstrap = bootstrap or "localhost:9092"
    admin = AIOKafkaAdminClient(bootstrap_servers=bootstrap)
    await admin.start()
    try:
        wanted = []
        for topic in Topics.ALL:
            wanted.append(NewTopic(topic, num_partitions=PARTITIONS, replication_factor=1))
            wanted.append(NewTopic(Topics.dlq(topic), num_partitions=1, replication_factor=1))
        for nt in wanted:
            try:
                await admin.create_topics([nt])
                print(f"created {nt.name}")
            except TopicAlreadyExistsError:
                print(f"exists  {nt.name}")
    finally:
        await admin.close()


if __name__ == "__main__":
    asyncio.run(main())
