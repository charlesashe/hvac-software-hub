export async function onRequestPost(context) {
  const GHL_WEBHOOK_URL =
    'https://services.leadconnectorhq.com/hooks/O9znf7czhaWZwcx0wVyo/webhook-trigger/1c03c7f8-f860-460b-80ca-e768d772dc77';

  try {
    const data = await context.request.json();

    // Forward to GHL with correct Content-Type
    const ghlResponse = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const status = ghlResponse.ok ? 200 : 502;
    const body = ghlResponse.ok
      ? { success: true }
      : { success: false, error: 'GHL returned ' + ghlResponse.status };

    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://hvacsoftwarehub.com',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://hvacsoftwarehub.com',
      },
    });
  }
}
