const URL = 'https://script.google.com/macros/s/AKfycbw4qhoxcWJ1j47KdunKc5LQpHJW9PbMuwR1eZ1LDPkyM7C-ehcXTy1BOnZKtjfC5KEw/exec';

async function auth() {
  const req = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'signin', payload: { username: 'aaa', password: 'bbb' } }) 
  });
  const res = await req.json();
  console.log("SignIn:", JSON.stringify(res, null, 2));
  return res.user?.id;
}

async function test() {
  const userId = await auth() || '000001';
  console.log("Using User ID:", userId);

  const req = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getUserReports', payload: { userId } }) 
  });
  const res = await req.json();
  console.log("getUserReports:", JSON.stringify(res, null, 2));

  if (res.status === 'success' && res.data.length > 0) {
     const toDelete = res.data[0];
     console.log("Attempting to delete report:", toDelete.reportId);
     const delReq = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteReport', payload: { userId, reportId: toDelete.reportId } }) 
     });
     const delRes = await delReq.json();
     console.log("Delete Response:", JSON.stringify(delRes, null, 2));
  }
}
test();
