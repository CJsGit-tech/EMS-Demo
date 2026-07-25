from fastapi import FastAPI

app = FastAPI(title="V2G SCADA Simulator")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
