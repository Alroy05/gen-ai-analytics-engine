const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Datastore = require('nedb');
require('dotenv').config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Initialize databases
const mockDataDB = new Datastore();
const queryLogDB = new Datastore();

// Sample data
mockDataDB.insert(require('./sample-data.json'));

// Initialize Express
const app = express();
app.use(bodyParser.json());

// API Key Middleware
const API_KEYS = new Set(['demo-key-123', 'team-key-456']);
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || !API_KEYS.has(apiKey)) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  
  req.apiKey = apiKey;
  next();
};

// Query Processing with Gemini
class QueryProcessor {
  static async processNaturalLanguage(query) {
    try {
      const prompt = `
      You are a data query translator. Convert this natural language query into a structured JSON format:
      
      QUERY: "${query}"
      
      Our database has these fields in each record:
      - id (number)
      - product (string)
      - category (string: "Software" or "Add-on")
      - price (number)
      - units_sold (number)
      - region (string: "North America", "Europe", "Asia")
      - date (string: YYYY-MM-DD)
      
      Return JSON with:
      {
        "originalQuery": string,
        "filters": array of conditions (e.g., ["price > 500", "region == 'Europe'"]),
        "fields": array of fields to return (empty means all),
        "sort": {field: string, order: "asc"|"desc"} | null,
        "limit": number | null
      }
      
      Only respond with valid JSON. Example:
      {
        "originalQuery": "Show me software products in Europe",
        "filters": ["category == 'Software'", "region == 'Europe'"],
        "fields": ["product", "price"],
        "sort": null,
        "limit": null
      }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean Gemini response (sometimes includes markdown)
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Gemini processing error:', error);
      throw new Error('Failed to process query with AI');
    }
  }

  static validateQuery(queryAnalysis) {
    const issues = [];
    
    // Check for unsupported fields
    if (queryAnalysis.fields && queryAnalysis.fields.length > 0) {
      const validFields = ['id', 'product', 'category', 'price', 'units_sold', 'region', 'date'];
      const invalidFields = queryAnalysis.fields.filter(f => !validFields.includes(f));
      
      if (invalidFields.length > 0) {
        issues.push(`Invalid fields requested: ${invalidFields.join(', ')}`);
      }
    }
    
    // Check filter syntax
    if (queryAnalysis.filters) {
      const invalidFilters = queryAnalysis.filters.filter(f => 
        !f.includes('==') && !f.includes('>') && !f.includes('<') && !f.includes('!='));
      
      if (invalidFilters.length > 0) {
        issues.push(`Some filters have invalid syntax: ${invalidFilters.join(', ')}`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      complexity: this.calculateComplexity(queryAnalysis)
    };
  }
  
  static calculateComplexity(queryAnalysis) {
    let score = 0;
    score += (queryAnalysis.filters?.length || 0) * 2;
    score += (queryAnalysis.fields?.length || 7) * 0.5; // 7 is total fields
    if (queryAnalysis.sort) score += 1;
    if (queryAnalysis.limit) score += 0.5;
    return Math.min(10, score);
  }
  
  static executeQuery(queryAnalysis) {
    let results = mockDataDB.getAllData();
    let whereClauses = [];
    const uniqueConditions = new Set(); // Track unique conditions

    // Apply filters and build WHERE clauses
    if (queryAnalysis.filters && queryAnalysis.filters.length > 0) {
        results = results.filter(item => {
            return queryAnalysis.filters.every(filter => {
                let condition = '';
                if (filter.includes('==')) {
                    const [field, value] = filter.split('==').map(s => s.trim().replace(/'/g, ''));
                    condition = `${field} = '${value}'`;
                    if (!uniqueConditions.has(condition)) {
                        whereClauses.push(condition);
                        uniqueConditions.add(condition);
                    }
                    return item[field] == value;
                } else if (filter.includes('!=')) {
                    const [field, value] = filter.split('!=').map(s => s.trim().replace(/'/g, ''));
                    condition = `${field} != '${value}'`;
                    if (!uniqueConditions.has(condition)) {
                        whereClauses.push(condition);
                        uniqueConditions.add(condition);
                    }
                    return item[field] != value;
                } else if (filter.includes('>')) {
                    const [field, value] = filter.split('>').map(s => s.trim());
                    condition = `${field} > ${value}`;
                    if (!uniqueConditions.has(condition)) {
                        whereClauses.push(condition);
                        uniqueConditions.add(condition);
                    }
                    return item[field] > Number(value);
                } else if (filter.includes('<')) {
                    const [field, value] = filter.split('<').map(s => s.trim());
                    condition = `${field} < ${value}`;
                    if (!uniqueConditions.has(condition)) {
                        whereClauses.push(condition);
                        uniqueConditions.add(condition);
                    }
                    return item[field] < Number(value);
                }
                return true;
            });
        });
    }

    // Build SELECT clause
    const selectFields = queryAnalysis.fields && queryAnalysis.fields.length > 0 
        ? queryAnalysis.fields.join(', ') 
        : '*';
    
    // Build ORDER BY clause
    let orderByClause = '';
    if (queryAnalysis.sort) {
        const { field, order } = queryAnalysis.sort;
        orderByClause = ` ORDER BY ${field} ${order.toUpperCase()}`;
    }
    
    // Build LIMIT clause
    let limitClause = '';
    if (queryAnalysis.limit) {
        limitClause = ` LIMIT ${queryAnalysis.limit}`;
    }
    
    // Construct full SQL query
    const sqlQuery = `SELECT ${selectFields} FROM products` +
        (whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '') +
        orderByClause +
        limitClause;

    // Select only requested fields
    if (queryAnalysis.fields && queryAnalysis.fields.length > 0) {
        results = results.map(item => {
            const filteredItem = {};
            queryAnalysis.fields.forEach(field => {
                if (item.hasOwnProperty(field)) {
                    filteredItem[field] = item[field];
                }
            });
            return filteredItem;
        });
    }
    
    return {
        data: results,
        stats: {
            recordsReturned: results.length,
            executionTimeMs: Math.random() * 100 + 50,
            complexity: this.calculateComplexity(queryAnalysis)
        },
        sqlQuery: sqlQuery
    };
}
}

// API Endpoints

app.post('/query', authenticate, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const queryAnalysis = await QueryProcessor.processNaturalLanguage(query);
    const validation = QueryProcessor.validateQuery(queryAnalysis);
    
    if (!validation.isValid) {
      return res.status(422).json({
        error: 'Query validation failed',
        issues: validation.issues,
        queryAnalysis
      });
    }
    
    const results = QueryProcessor.executeQuery(queryAnalysis);
    
    // Log the query
    queryLogDB.insert({
      id: uuidv4(),
      timestamp: new Date(),
      apiKey: req.apiKey,
      query,
      analysis: queryAnalysis,
      results: results.stats,
      sqlQuery: results.sqlQuery
    });
    
    res.json({
      data: results.data,
      sqlQuery: results.sqlQuery,
      stats: results.stats,
      queryAnalysis,
      validation: {
        notes: validation.issues.length ? validation.issues : ['Query validated successfully'],
        complexity: validation.complexity
      }
    });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ 
      error: 'Internal server error processing query',
      details: error.message 
    });
  }
});

app.post('/explain', authenticate, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const queryAnalysis = await QueryProcessor.processNaturalLanguage(query);
    const validation = QueryProcessor.validateQuery(queryAnalysis);
    
    res.json({
      originalQuery: query,
      queryAnalysis,
      validation,
      explanation: {
        filters: queryAnalysis.filters || [],
        fields: queryAnalysis.fields || ['All fields'],
        sort: queryAnalysis.sort || 'No sorting',
        limit: queryAnalysis.limit || 'No limit'
      }
    });
  } catch (error) {
    console.error('Explain error:', error);
    res.status(500).json({ error: 'Internal server error explaining query' });
  }
});

app.post('/validate', authenticate, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const queryAnalysis = await QueryProcessor.processNaturalLanguage(query);
    const validation = QueryProcessor.validateQuery(queryAnalysis);
    
    res.json({
      originalQuery: query,
      queryAnalysis,
      validation
    });
  } catch (error) {
    console.error('Validate error:', error);
    res.status(500).json({ error: 'Internal server error validating query' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gen AI Analytics Engine running on port ${PORT}`);
  console.log(`Gemini Model: ${model.model}`);
});