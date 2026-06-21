import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple IMAP client using Deno TLS
class SimpleIMAP {
  private conn!: Deno.TlsConn;
  private reader!: ReadableStreamDefaultReader<Uint8Array>;
  private buffer = "";
  private tag = 0;

  async connect(host: string, port: number) {
    this.conn = await Deno.connectTls({ hostname: host, port });
    this.reader = this.conn.readable.getReader();
    await this.readResponse(); // server greeting
  }

  private async readResponse(): Promise<string> {
    const decoder = new TextDecoder();
    let result = "";
    while (true) {
      // Check buffer first
      if (this.buffer.includes("\r\n")) {
        const lines = this.buffer.split("\r\n");
        // Check if we have a complete tagged or untagged response
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith(`A${this.tag} `) || line.startsWith("* OK") || line.startsWith("* BYE")) {
            result = lines.slice(0, i + 1).join("\r\n");
            this.buffer = lines.slice(i + 1).join("\r\n");
            return result;
          }
        }
      }
      const { value, done } = await this.reader.read();
      if (done) break;
      this.buffer += decoder.decode(value);
      
      // Check for tagged response completion
      const tagPattern = `A${this.tag} `;
      if (this.buffer.includes(tagPattern)) {
        const idx = this.buffer.indexOf(tagPattern);
        const endIdx = this.buffer.indexOf("\r\n", idx);
        if (endIdx !== -1) {
          result = this.buffer.substring(0, endIdx);
          this.buffer = this.buffer.substring(endIdx + 2);
          return result;
        }
      }
    }
    return result || this.buffer;
  }

  private async command(cmd: string): Promise<string> {
    this.tag++;
    const encoder = new TextEncoder();
    const writer = this.conn.writable.getWriter();
    await writer.write(encoder.encode(`A${this.tag} ${cmd}\r\n`));
    writer.releaseLock();
    return await this.readResponse();
  }

  async login(user: string, pass: string) {
    return await this.command(`LOGIN ${user} ${pass}`);
  }

  async select(mailbox: string) {
    return await this.command(`SELECT ${mailbox}`);
  }

  async searchUnseen(): Promise<string[]> {
    const res = await this.command("SEARCH UNSEEN");
    const match = res.match(/\* SEARCH (.+)/);
    if (!match) return [];
    return match[1].trim().split(/\s+/).filter(Boolean);
  }

  async fetchEmail(uid: string): Promise<{ from: string; to: string; subject: string; body: string }> {
    const res = await this.command(`FETCH ${uid} (BODY[HEADER.FIELDS (FROM TO SUBJECT)] BODY[TEXT])`);
    
    const fromMatch = res.match(/From:\s*(.+)/i);
    const toMatch = res.match(/To:\s*(.+)/i);
    const subjectMatch = res.match(/Subject:\s*(.+)/i);
    
    const extractEmail = (raw: string) => {
      const emailMatch = raw.match(/<([^>]+)>/);
      return emailMatch ? emailMatch[1].trim() : raw.trim();
    };

    const from = fromMatch ? extractEmail(fromMatch[1]) : "unknown@unknown.com";
    const to = toMatch ? extractEmail(toMatch[1]) : "unknown@unknown.com";
    const subject = subjectMatch ? subjectMatch[1].trim() : "(No subject)";
    
    // Extract body text - find the BODY[TEXT] content
    let body = "";
    const bodyParts = res.split(/\r?\n\r?\n/);
    if (bodyParts.length > 1) {
      body = bodyParts.slice(1).join("\n\n").replace(/\)\r?\n?A\d+.*$/s, "").trim();
    }

    // Clean MIME artifacts from body
    body = this.cleanMimeBody(body);

    return { from, to, subject, body: body || "(No content)" };
  }

  private cleanMimeBody(raw: string): string {
    let text = raw;

    // Decode quoted-printable: =XX hex sequences
    text = text.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    // Remove soft line breaks (= at end of line)
    text = text.replace(/=\r?\n/g, "");

    // Remove MIME boundaries (lines starting with --)
    text = text.replace(/^--[a-zA-Z0-9_.=-]+\s*$/gm, "");

    // Remove MIME part headers (Content-Type, Content-Transfer-Encoding, etc.)
    text = text.replace(/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|MIME-Version):.*(\r?\n\s.*)*$/gim, "");

    // Remove BODY[TEXT] {size} lines
    text = text.replace(/^BODY\[TEXT\]\s*\{\d+\}\s*$/gim, "");

    // Remove HTML tags if present (extract text from HTML parts)
    if (text.includes("<html") || text.includes("<body") || text.includes("<div")) {
      // Strip HTML tags but keep text content
      text = text
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    // Clean up excessive whitespace
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return text;
  }

  async storeFlag(uid: string, flag: string) {
    return await this.command(`STORE ${uid} +FLAGS (${flag})`);
  }

  async logout() {
    try {
      await this.command("LOGOUT");
      this.conn.close();
    } catch { /* ignore */ }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const IMAP_HOST = Deno.env.get("IMAP_HOST");
    const IMAP_PORT = parseInt(Deno.env.get("IMAP_PORT") || "993");
    const IMAP_USER = Deno.env.get("IMAP_USER");
    const IMAP_PASS = Deno.env.get("IMAP_PASS");

    if (!IMAP_HOST || !IMAP_USER || !IMAP_PASS) {
      throw new Error("IMAP credentials not configured. Add IMAP_HOST, IMAP_USER, IMAP_PASS in secrets.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const imap = new SimpleIMAP();
    await imap.connect(IMAP_HOST, IMAP_PORT);
    await imap.login(IMAP_USER, IMAP_PASS);
    await imap.select("INBOX");

    const unseenIds = await imap.searchUnseen();
    console.log(`Found ${unseenIds.length} unseen emails`);

    let imported = 0;
    for (const uid of unseenIds.slice(0, 20)) { // max 20 per poll
      try {
        const email = await imap.fetchEmail(uid);

        // Check if already exists (by subject + from + direction)
        const { data: existing } = await supabase
          .from("emails")
          .select("id")
          .eq("from_email", email.from)
          .eq("subject", email.subject)
          .eq("direction", "incoming")
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("emails").insert({
            from_email: email.from,
            to_email: email.to,
            subject: email.subject,
            body: email.body,
            direction: "incoming",
            is_read: false,
          });
          imported++;
        }

        // Mark as seen on server
        await imap.storeFlag(uid, "\\Seen");
      } catch (e) {
        console.error(`Failed to fetch email ${uid}:`, e);
      }
    }

    await imap.logout();

    return new Response(JSON.stringify({ success: true, imported, total_unseen: unseenIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("IMAP poll error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
