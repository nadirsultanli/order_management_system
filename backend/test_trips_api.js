const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjlJTHpNNXcyc1VTdFVvbTMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RyY3JqaW5yZGpnaXpxaGpkZ3ZjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MzUzMjQ2Yi1iMGI4LTQ1MDgtOGIwNi1iZDlkM2RjMTgzODEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzUyNTg5ODQyLCJpYXQiOjE3NTI1ODYyNDIsImVtYWlsIjoibmFkaXJAY2lyY2wudGVhbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzUyNTg2MjQyfV0sInNlc3Npb25faWQiOiI5ODdjZTMzZS00ZjRlLTRjMjQtODUwZS0yYTdkMjE5NGZjYjciLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.YepnR1ikIe0vPPPBZwRLCndpJkd-tgHv7y-Q7EUIr28';

// Test different status combinations
const testCases = [
  {
    name: 'Single status: planned',
    url: 'http://localhost:3001/api/v1/trips/list?status=planned'
  },
  {
    name: 'Multiple statuses: planned,loaded',
    url: 'http://localhost:3001/api/v1/trips/list?status=planned&status=loaded'
  },
  {
    name: 'Multiple statuses: planned,loaded,in_transit',
    url: 'http://localhost:3001/api/v1/trips/list?status=planned&status=loaded&status=in_transit'
  },
  {
    name: 'Multiple statuses with spaces: planned, loaded, in_transit',
    url: 'http://localhost:3001/api/v1/trips/list?status=planned&status=loaded&status=in_transit'
  },
  {
    name: 'No status filter',
    url: 'http://localhost:3001/api/v1/trips/list'
  }
];

function makeRequest(url, testName) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n=== ${testName} ===`);
        console.log(`Status Code: ${res.statusCode}`);
        console.log('Response:');
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log(data);
        }
        console.log('='.repeat(50));
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error(`Error in ${testName}:`, error.message);
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing trips list API with multiple statuses...\n');
  
  for (const testCase of testCases) {
    try {
      await makeRequest(testCase.url, testCase.name);
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to run test: ${testCase.name}`, error);
    }
  }
  
  console.log('\nAll tests completed!');
}

// Run the tests
runTests().catch(console.error); 