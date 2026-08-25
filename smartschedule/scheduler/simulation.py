from typing import List
from scheduler.models import SchedulerInput, TimetableEntry
from scheduler.engine import TimetableEngine

class WhatIfSimulator:
    def __init__(self, engine: TimetableEngine):
        self.engine = engine
        
    def simulate(self, base_data: SchedulerInput, modifications: dict) -> List[TimetableEntry]:
        """Runs a simulation without modifying the published timetable."""
        # Apply modifications to base_data (e.g. absent faculty)
        # Create a deep copy or new instance of data
        # Run engine generate
        result = self.engine.generate(base_data)
        return result.timetable
