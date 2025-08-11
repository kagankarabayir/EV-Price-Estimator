from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ----------------------------
# Config
# ----------------------------
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DEFAULT_CSV = os.path.join(DATA_DIR, "sample_ev_data.csv")
USER_DATA_CSV = os.path.join(DATA_DIR, "ev_data.csv")
USER_DATA_XLSX = os.path.join(DATA_DIR, "ev_data.xlsx")

ANNUAL_DEPRECIATION = 0.07
PER_10K_DEPRECIATION = 0.015
MILEAGE_BUCKET = 10000
MIN_RETENTION = 0.35


class ValuationRequest(BaseModel):
    make: str = Field(..., examples=["Tesla"])  # case-insensitive match
    model: str = Field(..., examples=["Model 3"])  # case-insensitive match
    mileageKm: int = Field(..., ge=0, examples=[45000])
    firstRegistration: str = Field(..., examples=["2020-06-01"])  # ISO date string


class ValuationResponse(BaseModel):
    estimate: float
    currency: str = "EUR"
    confidence: Optional[float] = None


def _load_dataset() -> pd.DataFrame:
    """
    Load vehicle reference data. Supports either:
    - data/ev_data.xlsx
    - data/ev_data.csv
    Falls back to the included sample CSV if none found.

    Expected columns (preferred): make, model, base_price, year0
    Alternatively, if there are transactional rows with columns: make, model, price, registration_year,
    we will aggregate median by (make, model) and infer year0 as the median registration_year.
    """
    path: Optional[str] = None
    if os.path.exists(USER_DATA_XLSX):
        path = USER_DATA_XLSX
    elif os.path.exists(USER_DATA_CSV):
        path = USER_DATA_CSV
    else:
        path = DEFAULT_CSV

    if path.endswith(".xlsx"):
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)

    # Normalize column names
    df.columns = [c.strip().lower() for c in df.columns]

    # If dataset already has reference columns, use them
    if {"make", "model", "base_price", "year0"}.issubset(df.columns):
        ref = df[["make", "model", "base_price", "year0"]].copy()
        ref["make"] = ref["make"].str.strip().str.lower()
        ref["model"] = ref["model"].str.strip().str.lower()
        return ref

    # Otherwise, try to aggregate from transactional-like data
    if {"make", "model", "price"}.issubset(df.columns):
        group_cols = ["make", "model"]
        agg = (
            df.assign(
                make=lambda d: d["make"].astype(str).str.strip().str.lower(),
                model=lambda d: d["model"].astype(str).str.strip().str.lower(),
            )
            .groupby(group_cols, as_index=False)
            .agg(
                base_price=("price", "median"),
                year0=("registration_year", "median") if "registration_year" in df.columns else ("price", "size"),
            )
        )
        if "registration_year" not in df.columns:
            # Fallback: assume year0 is 2020 if unknown
            agg["year0"] = 2020
        return agg

    # As a last resort, synthesize some defaults to avoid crashing
    return pd.DataFrame(
        [
            {"make": "tesla", "model": "model 3", "base_price": 28000, "year0": 2019},
            {"make": "tesla", "model": "model y", "base_price": 35000, "year0": 2021},
            {"make": "nissan", "model": "leaf", "base_price": 12000, "year0": 2018},
            {"make": "volkswagen", "model": "id.3", "base_price": 20000, "year0": 2020},
            {"make": "volkswagen", "model": "id.4", "base_price": 26000, "year0": 2021},
        ]
    )


def _years_since(first_registration_iso: str) -> float:
    try:
        d = datetime.fromisoformat(first_registration_iso[:10])
    except Exception:
        return 0.0
    now = datetime.utcnow()
    months = (now.year - d.year) * 12 + (now.month - d.month)
    return max(0.0, months / 12.0)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


# Load dataset once at startup
REF_DATA = _load_dataset()

app = FastAPI(title="Aampere EV Quick Valuation (Local)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "records": int(len(REF_DATA))}


@app.get("/makes")
def get_makes() -> dict:
    """Get all available makes from the dataset"""
    makes = sorted(REF_DATA["make"].unique().tolist())
    return {"makes": makes}


@app.get("/models/{make}")
def get_models(make: str) -> dict:
    """Get all available models for a specific make"""
    make_lower = make.strip().lower()
    models = sorted(REF_DATA[REF_DATA["make"] == make_lower]["model"].unique().tolist())
    return {"models": models}


@app.post("/valuation", response_model=ValuationResponse)
def valuation(req: ValuationRequest) -> ValuationResponse:
    make = req.make.strip().lower()
    model = req.model.strip().lower()
    mileage = int(req.mileageKm)
    years = _years_since(req.firstRegistration)

    match = REF_DATA[(REF_DATA["make"] == make) & (REF_DATA["model"] == model)]
    if match.empty:
        # Not found, return safe default
        estimated = 10000.0
        confidence = 0.5
        return ValuationResponse(estimate=estimated, confidence=confidence)

    base_price = float(match.iloc[0]["base_price"]) if "base_price" in match.columns else 10000.0
    year0 = int(match.iloc[0]["year0"]) if "year0" in match.columns else 2020

    # Depreciation model
    year_factor = (1 - ANNUAL_DEPRECIATION) ** years
    mileage_blocks = mileage / float(MILEAGE_BUCKET)
    mileage_factor = 1 - PER_10K_DEPRECIATION * mileage_blocks

    raw = base_price * year_factor * mileage_factor
    min_value = base_price * MIN_RETENTION
    estimate = _clamp(raw, min_value * 0.8, base_price * 1.05)

    year_gap = abs(datetime.fromisoformat(req.firstRegistration[:10]).year - year0)
    confidence = _clamp(0.9 - year_gap * 0.06 - min(0.5, mileage / 200000.0), 0.5, 0.9)

    return ValuationResponse(estimate=round(float(estimate), 2), confidence=round(float(confidence), 2))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)


