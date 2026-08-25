"""Initialize the active SmartSchedule database.

Existing data is preserved. Pass ``--reset`` to deliberately replace the
local database with the complete demo dataset.
"""
import asyncio

from init_simple import init


if __name__ == "__main__":
    asyncio.run(init())
