import React, { useEffect, useState } from "react";

// Backend API endpoints
const BACKEND_BASE = "http://127.0.0.1:8000";
const MAKES_ENDPOINT = `${BACKEND_BASE}/makes`;
const MODELS_ENDPOINT = (make: string) => `${BACKEND_BASE}/models/${encodeURIComponent(make)}`;
const VALUATION_ENDPOINT = `${BACKEND_BASE}/valuation`;

const fmtEUR = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// Default to local backend for prototype; replace with AWS API Gateway URL later
const AWS_API_ENDPOINT = "http://127.0.0.1:8000/valuation";

async function fetchAwsEstimate(payload: {
  make: string;
  model: string;
  mileageKm: number;
  firstRegistration: string;
}) {
  const res = await fetch(AWS_API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`AWS error ${res.status}`);
  return (await res.json()) as { estimate: number; currency: string; confidence?: number };
}



export default function App() {
  const [mode, setMode] = useState<"local" | "aws">("local");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [mileageKm, setMileageKm] = useState<number | "">("");
  const [firstReg, setFirstReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ estimate: number; currency: string; confidence?: number } | null>(null);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);

  const canEstimate = make && model && typeof mileageKm === "number" && mileageKm >= 0 && firstReg;

  // Fetch makes on component mount
  useEffect(() => {
    const fetchMakes = async () => {
      try {
        const response = await fetch(MAKES_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          setMakes(data.makes || []);
        } else {
          console.error("Failed to fetch makes");
          setMakes([]);
        }
      } catch (error) {
        console.error("Error fetching makes:", error);
        setMakes([]);
      } finally {
        setMakesLoading(false);
      }
    };

    fetchMakes();
  }, []);

  // Fetch models when make changes
  useEffect(() => {
    if (!make) {
      setModels([]);
      return;
    }

    const fetchModels = async () => {
      setModelsLoading(true);
      try {
        const response = await fetch(MODELS_ENDPOINT(make));
        if (response.ok) {
          const data = await response.json();
          setModels(data.models || []);
        } else {
          console.error("Failed to fetch models");
          setModels([]);
        }
      } catch (error) {
        console.error("Error fetching models:", error);
        setModels([]);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, [make]);

  const handleEstimate = async () => {
    setError(null);
    setResult(null);
    if (!canEstimate) {
      setError("Please complete all fields correctly.");
      return;
    }
    const payload = {
      make,
      model,
      mileageKm: Number(mileageKm),
      firstRegistration: `${firstReg}-01`,
    };
    try {
      setLoading(true);
      let r;
      if (mode === "aws") {
        r = await fetchAwsEstimate(payload);
      } else {
        // Use local backend instead of localEstimate function
        const response = await fetch(VALUATION_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Backend error ${response.status}`);
        }
        r = await response.json();
      }
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMake("");
    setModel("");
    setMileageKm("");
    setFirstReg("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6">
      <div className="w-full max-w-2xl bg-white shadow-sm rounded-2xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Aampere – EV Quick Valuation</h1>
            <p className="text-sm text-gray-500">Lightweight estimate based on minimal inputs.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Mode</span>
            <button
              className={`text-xs px-3 py-1 rounded-full border ${
                mode === "local" ? "bg-gray-900 text-white" : "bg-white"
              }`}
              onClick={() => setMode("local")}
            >
              Local Backend
            </button>
            <button
              className={`text-xs px-3 py-1 rounded-full border ${
                mode === "aws" ? "bg-gray-900 text-white" : "bg-white"
              }`}
              title="Requires AWS endpoint"
              onClick={() => setMode("aws")}
            >
              AWS (API)
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Make</label>
              <select
                value={make}
                onChange={(e) => {
                  setMake(e.target.value);
                  setModel("");
                }}
                disabled={makesLoading}
                className="mt-1 w-full border rounded-xl p-2 focus:outline-none disabled:bg-gray-100"
              >
                <option value="">{makesLoading ? "Loading makes..." : "Select make"}</option>
                {makes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={!make || modelsLoading}
                className="mt-1 w-full border rounded-xl p-2 focus:outline-none disabled:bg-gray-100"
              >
                <option value="">{!make ? "Select make first" : modelsLoading ? "Loading models..." : "Select model"}</option>
                {models.map((mo) => (
                  <option key={mo} value={mo}>{mo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mileage (km)</label>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g., 45000"
                value={mileageKm}
                onChange={(e) => setMileageKm(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full border rounded-xl p-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">First Registration</label>
              <input
                type="month"
                value={firstReg}
                onChange={(e) => setFirstReg(e.target.value)}
                className="mt-1 w-full border rounded-xl p-2 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleEstimate}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
            >
              {loading ? "Calculating…" : "Get Estimate"}
            </button>
            <button onClick={reset} className="px-4 py-2 rounded-xl border">Reset</button>
            <div className="text-xs text-gray-500">No personal data stored.</div>
          </div>
        </div>

        <div className="border rounded-2xl p-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-2">Estimated Price</h2>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          {!result && !error && (
            <div className="text-sm text-gray-500">Fill the form and click “Get Estimate”.</div>
          )}
          {result && (
            <div className="space-y-2">
              <div className="text-2xl font-bold">{fmtEUR(result.estimate)}</div>
              <div className="text-sm text-gray-600">
                Confidence: {Math.round((result.confidence ?? 0.7) * 100)}%
              </div>
              <div className="text-xs text-gray-500">
                This is an instant, non-binding indication. Final offer may vary after full inspection.
              </div>
            </div>
          )}
        </div>

        {/* Local Backend Calculation Explanation */}
        <details className="bg-white border rounded-2xl p-4">
          <summary className="cursor-pointer font-medium">How this estimate is calculated (Local Backend)</summary>
          <div className="mt-3 text-sm text-gray-700 space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">📊 Data Source</h4>
              <p>Estimates are calculated from the backend CSV dataset containing base prices and reference years for each make/model combination.</p>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">🧮 Calculation Formula</h4>
              <div className="space-y-2">
                <p><strong>Annual Depreciation:</strong> 7% per year from first registration</p>
                <p><strong>Mileage Depreciation:</strong> 1.5% per 10,000 km driven</p>
                <p><strong>Base Formula:</strong></p>
                <div className="bg-white p-2 rounded border font-mono text-xs">
                  estimate = base_price × (1 - 0.07)^years × (1 - 0.015 × mileage_blocks)
                </div>
                <p>Where: mileage_blocks = total_km ÷ 10,000</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">🛡️ Guardrails</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Minimum Value:</strong> Never below 35% of base price</li>
                <li><strong>Maximum Value:</strong> Never above 105% of base price</li>
                <li><strong>Safety Buffer:</strong> Additional 20% below calculated minimum</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">🎯 Confidence Calculation</h4>
              <p><strong>Base Confidence:</strong> 90%</p>
              <p><strong>Reductions:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>-6% per year difference from reference year</li>
                <li>-0.5% per 100,000 km (capped at 50%)</li>
              </ul>
              <p><strong>Range:</strong> 50% to 90%</p>
            </div>
          </div>
        </details>

        {/* AWS Calculation Explanation */}
        <details className="bg-white border rounded-2xl p-4">
          <summary className="cursor-pointer font-medium">How this estimate is calculated (AWS)</summary>
          <div className="mt-3 text-sm text-gray-700 space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">☁️ AWS Integration</h4>
              <p>When AWS mode is selected, the frontend sends a POST request to your configured AWS API Gateway endpoint.</p>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">📤 Request Format</h4>
              <div className="bg-white p-2 rounded border font-mono text-xs">
                POST /valuation<br/>
                {`{`}<br/>
                &nbsp;&nbsp;"make": "Tesla",<br/>
                &nbsp;&nbsp;"model": "Model 3",<br/>
                &nbsp;&nbsp;"mileageKm": 45000,<br/>
                &nbsp;&nbsp;"firstRegistration": "2020-06-01"<br/>
                {`}`}
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">📥 Expected Response</h4>
              <div className="bg-white p-2 rounded border font-mono text-xs">
                {`{`}<br/>
                &nbsp;&nbsp;"estimate": 25637.21,<br/>
                &nbsp;&nbsp;"currency": "EUR",<br/>
                &nbsp;&nbsp;"confidence": 0.82<br/>
                {`}`}
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold mb-2">🔧 Implementation</h4>
              <p>Your AWS backend (API Gateway + Lambda) should:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Process the vehicle data using your proprietary algorithm</li>
                <li>Return the estimate in EUR with confidence score</li>
                <li>Handle CORS and authentication as needed</li>
                <li>Log requests and errors to CloudWatch</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}


