async function main() {
  const email = 'eee3327@gmail.com'; // Admin user
  const fd = new FormData();
  
  // Create a small mock text file representing a logo image
  const blob = new Blob(['mock logo file content'], { type: 'image/png' });
  fd.append('logo', blob, 'test_logo.png');

  console.log('[Test] Sending logo upload request to http://localhost:3000/api/admin/settings/logo with Origin header...');
  try {
    const res = await fetch('http://localhost:3000/api/admin/settings/logo', {
      method: 'POST',
      body: fd,
      headers: {
        'x-user-email': email,
        'Origin': 'http://localhost:3000'
      }
    });

    console.log('[Test] Response status:', res.status);
    const body = await res.json();
    console.log('[Test] Response body:', JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error('[Test] Error occurred:', err.message);
  }
}

main();
