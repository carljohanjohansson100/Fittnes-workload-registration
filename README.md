# Fitness-workload-registration

Träningslogg där Claude beräknar förbrukade kalorier per pass. Frontend i ren HTML/CSS/JavaScript, backend i FastAPI.

## Funktioner
- Registrera pass per dag: träningstyp (promenad, löpning, gym, cykling, simning), tid, distans, puls vid slut och kommentar (max 300 tecken). Veckodag visas bredvid datumet.
- Kalorier beräknas av AI utifrån träningstyp, tid, aktuell vikt och puls vid slut. Distans sparas men används inte i beräkningen.
- Tabell till vänster, tvåaxlig linjegraf till höger (kalorier och minuter per dag).
- Flik för profil (namn, vikt, längd), export/import av data som JSON och inmatning av API-token.

## Starta
Kräver Python 3.10 eller senare.

```
pip install -r backend/requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
export TRAINING_API_TOKEN=<lång slumpsträng>   # valfritt lokalt, obligatoriskt om tjänsten nås utifrån
uvicorn backend.main:app --port 8000
```

Öppna http://localhost:8000/. Anges `TRAINING_API_TOKEN` måste samma token sparas under Profil → AI-tjänst. Modellen kan bytas med `CALORIE_MODEL` (standard `claude-opus-5-5`).

Tester: `pip install pytest httpx && python -m pytest backend`.

## Så beräknas kalorierna
`POST /api/calories` skickar träningstyp, minuter, vikt och puls till Claude, som svarar med kcal, MET-nivå och en kort motivering (visas när man hovrar över kcal i tabellen). Svaret avvisas om det ligger utanför 1,5–20 kcal per kg och timme. Vid avvisning, fel eller saknad token räknas passet i stället med en lokal MET-formel (`traning/js/calories.js`) och markeras med `*`.

Alla värden är skattningar. Pulsen är en enda mätpunkt vid passets slut och ålder och kön är okända.

## Data och integritet
- Pass och profil sparas bara i webbläsarens `localStorage`. Gör export med jämna mellanrum.
- Vikt, träningstyp, tid och puls skickas till Anthropic för beräkningen. Namn, längd och kommentarer skickas inte.
- Utan `TRAINING_API_TOKEN` är API:t öppet. Kör då bara på localhost, annars kan vem som helst använda din API-nyckel.

## Struktur
- `backend/` – FastAPI-tjänst och tester
- `traning/` – frontend (serveras av backend på `/`)
