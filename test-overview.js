async function run() {
  try {
    const loginRes = await fetch('https://ksamail-backend.onrender.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ksamail.com', password: 'testpassword123!' })
    });
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    
    if (!token) throw new Error('No token: ' + JSON.stringify(loginData));

    const overviewRes = await fetch('https://ksamail-backend.onrender.com/admin/stats/overview', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const overviewData = await overviewRes.json();
    console.log(JSON.stringify(overviewData, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
