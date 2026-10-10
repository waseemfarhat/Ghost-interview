"""Optional AI-service scaffold. The current application uses backend
provider adapters for question generation, transcription, and voice, plus
browser-side facial expression analysis. This service is not in the active
request path and currently exposes only its health endpoint.
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Ghost Interview AI Service", version="0.1.0")


class HealthResponse(BaseModel):
    status: str
    service: str


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="ghost-interview-ai-service")

