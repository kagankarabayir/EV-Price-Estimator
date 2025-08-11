## Aampere EV Quick Valuator (No-AWS Prototype)

This repository contains a simple EV valuation prototype with a separate frontend and backend, designed to run locally without AWS. The frontend is ready to switch to a real AWS REST API later with minimal changes.

### Structure

- `frontend/`: Vite + React + TypeScript UI with a simple form and local placeholder pricing logic.
- `backend/`: FastAPI server that estimates prices from a CSV/XLSX dataset.

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+

### Run Frontend

```bash
cd frontend
npm install
npm run dev
# open the URL printed, e.g. http://localhost:5173
```

### Run Backend (local CSV/XLSX)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python app.py  # runs at http://127.0.0.1:8000
```

API endpoints:
- `GET /health` – health and record count
- `POST /valuation` – body: `{ make, model, mileageKm, firstRegistration }`

Example request body:
```json
{
  "make": "Tesla",
  "model": "Model 3",
  "mileageKm": 45000,
  "firstRegistration": "2020-06-01"
}
```

### Switch UI to call backend

In `frontend/src/App.tsx`, set `mode` to `"aws"` and change `AWS_API_ENDPOINT` to `http://127.0.0.1:8000/valuation` while running locally.

### Data

Put your spreadsheet into `backend/data/ev_data.xlsx` or `backend/data/ev_data.csv` with columns:
- `make`, `model`, `base_price`, `year0`

Alternatively, you can provide transactional rows with `make`, `model`, `price`, and optional `registration_year`. The backend will aggregate a reference table.

### Case Study Notes

- Collects: Make, Model, Mileage, First Registration.
- Shows instant estimate and a disclaimer.
- Backend is easily swappable to AWS (same request/response).

### Deploying Later

- Frontend can be deployed statically (Vercel/Netlify/S3+CF).
- Backend can be containerized or replaced by your AWS API (API Gateway + Lambda).

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
