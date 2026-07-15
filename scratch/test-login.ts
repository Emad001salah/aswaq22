async function runTest() {
  const BASE_URL = 'http://localhost:3000';
  const email = `test-user-${Date.now()}@test.com`;
  const password = 'TestPassword123!';
  const phone = `+96659${Math.floor(1000000 + Math.random() * 9000000)}`;

  console.log('--- STARTING LIVE AUTHENTICATION SYSTEM TEST ---');

  // Step 1: Register
  console.log('1. Testing Register...');
  const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Live User',
      email,
      password,
      phone
    })
  });
  console.log('Register Status:', regRes.status);
  const regData: any = await regRes.json();
  console.log('Register Body:', regData);

  if (regRes.status !== 201) {
    console.error('Register failed!');
    return;
  }

  // Step 2: Login
  console.log('\n2. Testing Login...');
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  console.log('Login Status:', loginRes.status);
  const loginData: any = await loginRes.json();
  console.log('Login Body:', loginData);

  if (loginRes.status !== 200) {
    console.error('Login failed!');
    return;
  }

  const { accessToken } = loginData;

  // Step 3: Hit Protected Route
  console.log('\n3. Testing Protected Route (/api/v1/users/me)...');
  const meRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log('Protected Route Status:', meRes.status);
  const meData = await meRes.json();
  console.log('Protected Route Body:', meData);

  // Step 4: Phone Send OTP
  console.log('\n4. Testing Phone OTP Send...');
  const sendOtpRes = await fetch(`${BASE_URL}/api/v1/auth/phone/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  console.log('Send OTP Status:', sendOtpRes.status);
  const sendOtpData: any = await sendOtpRes.json();
  console.log('Send OTP Body:', sendOtpData);

  if (sendOtpRes.status === 200 && sendOtpData.devOtp) {
    const devOtp = sendOtpData.devOtp;
    // Step 5: Phone Verify OTP
    console.log(`\n5. Testing Phone OTP Verify with mock code: ${devOtp}...`);
    const verifyOtpRes = await fetch(`${BASE_URL}/api/v1/auth/phone/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: devOtp })
    });
    console.log('Verify OTP Status:', verifyOtpRes.status);
    const verifyOtpData = await verifyOtpRes.json();
    console.log('Verify OTP Body:', verifyOtpData);
  }

  console.log('\n--- LIVE AUTHENTICATION SYSTEM TEST COMPLETED ---');
}

runTest().catch((e) => console.error('Error during test execution:', e));
