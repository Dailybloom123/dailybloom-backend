const http = require('http');

// Test health endpoint
function testHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Health Check:', parsed.status);
          resolve(true);
        } catch (e) {
          console.log('❌ Health Check failed:', data);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Health Check error:', error.message);
      resolve(false);
    });

    req.end();
  });
}

// Test address routes (without auth)
function testAddressRoutes() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/addresses',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log('✅ Address routes accessible (401 expected without auth):', res.statusCode);
      resolve(res.statusCode === 401);
    });

    req.on('error', (error) => {
      console.log('❌ Address routes error:', error.message);
      resolve(false);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 Testing Backend Configuration...\n');
  
  const healthOk = await testHealth();
  const routesOk = await testAddressRoutes();
  
  console.log('\n📋 Test Results:');
  console.log('  Health Check:', healthOk ? '✅ PASS' : '❌ FAIL');
  console.log('  Address Routes:', routesOk ? '✅ PASS' : '❌ FAIL');
  
  if (healthOk && routesOk) {
    console.log('\n✅ All backend tests passed. Ready for user testing.');
  } else {
    console.log('\n❌ Some tests failed. Please check backend configuration.');
  }
}

runTests();