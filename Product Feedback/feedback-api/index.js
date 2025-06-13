// Harold A. Selfides
//Product Feedback Using Node.js and JSON

//importing the tools needed
const http = require('http'); 
const { parse } = require('querystring');   
const url = require('url');
const fs = require('fs');
const querystring = require('querystring');
const path = require('path');

const PORT = 3000;
// creates path to feedback.json next to index.js
const FEEDBACK_FILE = path.join(__dirname, 'feedback.json');

// initialize feedback storage
let feedbackData = [];
let nextId = 1;

// load existing feedback from file
function loadFeedback() {
    try {
        if (fs.existsSync(FEEDBACK_FILE)) {
            const data = fs.readFileSync(FEEDBACK_FILE, 'utf8');
            feedbackData = JSON.parse(data);
            
            if (feedbackData.length > 0) {
                nextId = Math.max(...feedbackData.map(f => f.id)) + 1;
            }
        }
    } catch (error) {
        console.error('Error loading feedback data:', error);
        feedbackData = [];
    }
}

// Save feedback to file
function saveFeedback() {
    try {
        fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbackData, null, 2));
    } catch (error) {
        console.error('Error saving feedback data:', error);
    }
}

// Function to send JSON response
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data, null, 2));
}

// Function to parse request body
function parseBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            callback(null, data);
        } catch (error) {
            callback(error, null);
        }
    });
}

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;

    console.log(`${method} ${req.url}`);

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
        sendResponse(res, 200, { message: 'CORS preflight successful' });
        return;
    }

    // Route handling
    if (pathname === '/feedback') {
        
        // POST /feedback - Create new feedback
        if (method === 'POST') {
            parseBody(req, (error, data) => {
                if (error) {
                    sendResponse(res, 400, { 
                        error: 'Invalid JSON in request body',
                        details: error.message 
                    });
                    return;
                }

                // Validate required fields
                if (!data.rating || !data.comment) {
                    sendResponse(res, 400, { 
                        error: 'Missing required fields: rating and comment are required' 
                    });
                    return;
                }

                // Validate rating range
                if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) {
                    sendResponse(res, 400, { 
                        error: 'Rating must be a number between 1 and 5' 
                    });
                    return;
                }

                // Create new feedback entry
                const feedback = {
                    id: nextId++,
                    rating: data.rating,
                    comment: data.comment,
                    timestamp: new Date().toISOString(),
                    userAgent: req.headers['user-agent'] || 'Unknown'
                };

                feedbackData.push(feedback);
                saveFeedback();

                sendResponse(res, 201, {
                    message: 'Feedback created successfully',
                    feedback: feedback
                });
            });
        }
        
        // GET /feedback or GET /feedback?id=123
        else if (method === 'GET') {
            if (query.id) {
                const id = parseInt(query.id);
                const feedback = feedbackData.find(f => f.id === id);
                
                if (feedback) {
                    sendResponse(res, 200, {
                        message: 'Feedback retrieved successfully',
                        feedback: feedback
                    });
                } else {
                    sendResponse(res, 404, { 
                        error: `Feedback with ID ${id} not found` 
                    });
                }
            } else {
                // Return all feedback
                sendResponse(res, 200, {
                    message: 'All feedback retrieved successfully',
                    count: feedbackData.length,
                    feedback: feedbackData
                });
            }
        }
        
        // DELETE /feedback?id=123
        else if (method === 'DELETE') {
            if (!query.id) {
                sendResponse(res, 400, { 
                    error: 'ID parameter is required for DELETE operation' 
                });
                return;
            }

            const id = parseInt(query.id);
            const index = feedbackData.findIndex(f => f.id === id);
            
            if (index !== -1) {
                const deletedFeedback = feedbackData.splice(index, 1)[0];
                saveFeedback();
                
                sendResponse(res, 200, {
                    message: 'Feedback deleted successfully',
                    deletedFeedback: deletedFeedback
                });
            } else {
                sendResponse(res, 404, { 
                    error: `Feedback with ID ${id} not found` 
                });
            }
        }
        
        else {
            sendResponse(res, 405, { 
                error: `Method ${method} not allowed on /feedback` 
            });
        }
    }
    // 404 for unknown routes
    else {
        sendResponse(res, 404, { 
            error: 'Route not found',
            availableRoutes: [
                'POST /feedback',
                'GET /feedback',
                'GET /feedback?id=123',
                'DELETE /feedback?id=123',
            ]
        });
    }
});

// load existing feedback on startup
loadFeedback();

// Start server
server.listen(PORT, () => {
    console.log(` Product Feedback API Server running on http://localhost:${PORT}`);
    console.log(` Feedback data will be stored in: ${FEEDBACK_FILE}`);
    console.log('\n Available endpoints:');
    console.log('  POST /feedback - Create new feedback');
    console.log('  GET /feedback - Get all feedback');
    console.log('  GET /feedback?id=123 - Get specific feedback');
    console.log('  DELETE /feedback?id=123 - Delete specific feedback');
    console.log('\n Test with curl or Postman!');
});

// graceful shutdown
process.on('SIGINT', () => {
    console.log('\n Shutting down server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});