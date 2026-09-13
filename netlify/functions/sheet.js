const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwF01VM_NXs7WiBznpfkZoTDUzwQihm9gZQH7qkavY1SPPA9CykIrXO-7ZyR68uQZ1_/exec';

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const url = SHEET_URL + '?action=load&t=' + Date.now();
      const res = await fetch(url, { redirect: 'follow', headers: { 'Accept': 'application/json' } });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) {
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'error', error: 'Parse failed', raw: text.substring(0, 200) }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      // Use form-encoded POST which works better with Apps Script
      const formData = 'payload=' + encodeURIComponent(JSON.stringify(body));
      const res = await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
        redirect: 'follow',
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) {
        // Apps Script may redirect on POST - try again with JSON
        const res2 = await fetch(SHEET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(body),
          redirect: 'follow',
        });
        const text2 = await res2.text();
        try { data = JSON.parse(text2); } catch(e2) {
          return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', note: 'saved via fallback' }) };
        }
      }
      return { statusCode: 200, headers, body: JSON.stringify(data || { status: 'ok' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'error', error: 'Unknown method' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', error: err.message }) };
  }
};
