"""Kaloriberäkning med Claude för träningsmodulen.

Start (från repots rot):
    export ANTHROPIC_API_KEY=...
    export TRAINING_API_TOKEN=...   # valfritt lokalt, obligatoriskt om tjänsten nås utifrån
    uvicorn backend.main:app --port 8000
Appen nås då på http://localhost:8000/ och API:t på POST /api/calories.
"""
import hmac
import json
import logging
import os
from pathlib import Path
from typing import Literal

import anthropic
from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

log = logging.getLogger("training")

# Sätts TRAINING_API_TOKEN krävs headern X-API-Token. Lämna osatt bara vid lokal körning.
API_TOKEN = os.environ.get("TRAINING_API_TOKEN", "")
if not API_TOKEN:
    log.warning("TRAINING_API_TOKEN saknas: API:t är öppet. Använd bara lokalt.")

MODEL = os.environ.get("CALORIE_MODEL", "claude-opus-5-5")
# Rimlighetsgräns för energiförbrukning uttryckt som MET (kcal / kg / timme).
MET_MIN, MET_MAX = 1.5, 20.0

SYSTEM = (
    "Du uppskattar energiförbrukning för ett träningspass. Utgå från träningstyp, "
    "varaktighet, kroppsvikt och puls vid passets slut. Pulsen är en enda mätpunkt "
    "vid slutet och säger bara något om intensiteten; använd den som ledtråd, inte "
    "som exakt mått. Ålder, kön och distans är okända, så anta en genomsnittlig vuxen "
    "och en typisk intensitet för träningstypen. Svara med ditt bästa enskilda "
    "heltalsvärde i kcal (total förbrukning under passet, inklusive vilometabolism "
    "under passet) och en kort motivering på svenska (högst två meningar) som anger "
    "vilken MET-nivå du utgått från."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "kcal": {"type": "integer"},
        "met": {"type": "number"},
        "rationale": {"type": "string"},
    },
    "required": ["kcal", "met", "rationale"],
    "additionalProperties": False,
}


class CaloriesRequest(BaseModel):
    type: Literal["promenad", "löpning", "gym", "cykling", "simning"]
    minutes: float = Field(gt=0, le=1440)
    weight_kg: float = Field(gt=20, le=400)
    end_hr: int | None = Field(default=None, ge=30, le=250)


class CaloriesResponse(BaseModel):
    kcal: int
    met: float
    rationale: str
    model: str


def estimate(req: CaloriesRequest) -> dict:
    client = anthropic.Anthropic()
    hr = f"{req.end_hr} slag/min" if req.end_hr else "ej angiven"
    prompt = (
        f"Träningstyp: {req.type}\nTid: {req.minutes:g} minuter\n"
        f"Kroppsvikt: {req.weight_kg:g} kg\nPuls vid passets slut: {hr}"
    )
    resp = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    if resp.stop_reason == "refusal":
        raise ValueError("Modellen avböjde begäran")
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text)


app = FastAPI(title="Träning – kaloriberäkning")


@app.post("/api/calories", response_model=CaloriesResponse)
def calories(req: CaloriesRequest, x_api_token: str = Header(default="")) -> CaloriesResponse:
    if API_TOKEN and not hmac.compare_digest(x_api_token.encode(), API_TOKEN.encode()):
        raise HTTPException(status_code=401, detail="Ogiltig eller saknad token")
    try:
        data = estimate(req)
    except Exception as exc:  # nätverk, auth, refusal, ogiltig JSON
        log.warning("AI-beräkning misslyckades: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="AI-beräkningen misslyckades")

    kcal = int(data["kcal"])
    implied_met = kcal / (req.weight_kg * req.minutes / 60)
    if not (MET_MIN <= implied_met <= MET_MAX):
        log.warning("Orimligt AI-svar: %s kcal (MET %.1f)", kcal, implied_met)
        raise HTTPException(status_code=502, detail="AI-svaret var orimligt")
    return CaloriesResponse(kcal=kcal, met=round(float(data["met"]), 1),
                            rationale=str(data["rationale"])[:300], model=MODEL)


# Måste ligga sist så att /api/* inte skuggas.
app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent.parent / "traning", html=True), name="app")
