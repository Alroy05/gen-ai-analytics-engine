# Gen AI Analytics Engine

This project is a **Gen AI-powered analytics engine** that processes natural language queries, converts them into structured database queries, and returns relevant results from a mock dataset. The system leverages **Google's Gemini AI** to parse and interpret queries.

## 🚀 Features

- Natural language query processing using **Google Gemini AI**
- Query validation and error handling
- API key authentication for secure access
- Query execution with filtering, sorting, and limiting options
- Query logging for analytics

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (>= 14.x)
- npm or yarn
- Google Gemini API key

### Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/your-repo/gen-ai-analytics-engine.git
   cd gen-ai-analytics-engine
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file and add your **Google Gemini API key**:

   ```sh
   GEMINI_API_KEY=your-gemini-api-key
   PORT=3000
   ```

4. Start the server:

   ```sh
   npm start
   ```

   The server will run on `http://localhost:3000`.

## 🔑 Authentication

All API endpoints require an API key in the request header:

```sh
x-api-key: demo-key-123
```

Available API keys (for testing):

- `demo-key-123`
- `team-key-456`

## 📖 API Documentation

### 1️⃣ Query API

**Endpoint:** `/query`

- **Method:** `POST`
- **Description:** Processes a natural language query and returns filtered data.
- **Headers:**
  ```json
  { "x-api-key": "demo-key-123" }
  ```
- **Request Body:**
  ```json
  {
    "query": "Show me software products in Europe"
  }
  ```
- **Response:**
  ```json
  {
    "data": [
      { "product": "XYZ Software", "price": 499 }
    ],
    "queryAnalysis": {
      "filters": ["category == 'Software'", "region == 'Europe'"]
    },
    "validation": {
      "notes": ["Query validated successfully"],
      "complexity": 3
    }
  }
  ```

### 2️⃣ Explain API

**Endpoint:** `/explain`

- **Method:** `POST`
- **Description:** Analyzes a natural language query and returns its structured representation.
- **Request Body:**
  ```json
  {
    "query": "Show me all products sold in Asia sorted by price"
  }
  ```
- **Response:**
  ```json
  {
    "queryAnalysis": {
      "filters": ["region == 'Asia'"],
      "sort": { "field": "price", "order": "asc" }
    },
    "explanation": {
      "filters": ["region == 'Asia'"],
      "sort": "price (ascending)"
    }
  }
  ```

### 3️⃣ Validate API

**Endpoint:** `/validate`

- **Method:** `POST`
- **Description:** Validates the natural language query without executing it.
- **Request Body:**
  ```json
  {
    "query": "Get me all add-ons sold after 2022"
  }
  ```
- **Response:**
  ```json
  {
    "queryAnalysis": {
      "filters": ["category == 'Add-on'", "date > '2022-01-01'"]
    },
    "validation": {
      "notes": ["Query validated successfully"],
      "complexity": 4
    }
  }
  ```

## 📌 Sample Queries

| Natural Language Query                           | API Call                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| "Show me all software products in North America" | `POST /query` with `{ "query": "Show me all software products in North America" }` |
| "List add-ons sorted by units sold"              | `POST /query` with `{ "query": "List add-ons sorted by units sold" }`              |
| "Explain how my query is processed"              | `POST /explain` with `{ "query": "Show me products cheaper than $500" }`           |

## 🛠️ Tech Stack

- **Node.js** & **Express.js** – Server framework
- **Google Gemini AI** – Natural language processing
- **NeDB** – Lightweight database for mock data
- **dotenv** – Environment variable management
- **uuid** – Unique query logging

## 🤝 Contributions

Feel free to fork this repo and submit pull requests! For major changes, open an issue first to discuss your ideas.

## 📝 License

This project is licensed under the MIT License.

