import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default spreadsheet (Google Map leads)
const DEFAULT_SPREADSHEET_ID = "1-MyZCUPAMPCUlEdrclkIJAbL1Oc9lZK0GfKuXMqV4gc";
const RANGE = "Sheet1!A:I";

function extractSpreadsheetId(urlOrId: string): string {
  // If it's a full Google Sheets URL, extract the ID
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Otherwise treat as a raw spreadsheet ID
  return urlOrId;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
    }

    let spreadsheetId = DEFAULT_SPREADSHEET_ID;

    // Accept optional spreadsheet URL/ID from request body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.spreadsheetUrl) {
          spreadsheetId = extractSpreadsheetId(body.spreadsheetUrl);
        }
      } catch {}
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(RANGE)}?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Sheets API error [${response.status}]: ${errorBody}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    const leads = rows.slice(1).map((row: string[], index: number) => ({
      id: `lead-${index + 1}`,
      name: row[0] || "",
      email: row[1] || "",
      phone: row[2] || "",
      industry: row[3] || "",
      business: row[4] || "",
      website: row[5] || "",
      location: row[6] || "",
      status: row[7] || "",
      emailing: row[8] || "",
    }));

    return new Response(JSON.stringify({ leads, total: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
