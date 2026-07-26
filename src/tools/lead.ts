// Public lead form — the only write tool. Hits CareBridge's /api/leads endpoint
// with the same validation the form uses. This is the *initial contact* form
// on the public site, NOT an admin form.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { carebridgeClient } from "../api-client.js";

const LeadInput = z.object({
  name: z.string().min(2).max(80).describe("Patient display name."),
  country: z.string().min(2).max(80).describe("Country of residence."),
  phone: z
    .string()
    .min(7)
    .max(24)
    .regex(/^[+0-9 ()\-]+$/, "Phone must be digits, spaces, +, (, ), or - only.")
    .describe("Phone number with country code, e.g. '+90 5XX XXX XX XX'."),
  treatment: z
    .enum(["implants", "smile", "crowns", "general"])
    .describe("Treatment interest. One of: implants, smile, crowns, general."),
  locale: z
    .string()
    .min(2)
    .max(8)
    .optional()
    .describe("Locale the visitor is browsing in. Stored with the lead for follow-up context."),
  // Honeypot — if a bot fills this, the server silently rejects. We never send it.
  website: z.string().max(0).optional().describe("Honeypot. MUST be empty."),
});

export function registerLeadTool(server: McpServer): void {
  server.registerTool(
    "carebridge_submit_lead",
    {
      title: "Submit a public lead to CareBridge",
      description:
        "Submit an initial-contact lead on behalf of a website visitor. " +
        "This is the public site form (sandbox): the lead is stored in CareBridge and assigned to an advisor. " +
        "Use only when the visitor has explicitly asked to be contacted. " +
        "All fields are required. `treatment` is one of: implants, smile, crowns, general.",
      inputSchema: LeadInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true, // submitting the same payload twice is a duplicate, not a destructive op
        openWorldHint: true, // hits the public CareBridge API
      },
    },
    async (args) => {
      if (args.website && args.website.length > 0) {
        return toolError("Rejected", "Honeypot triggered; refusing to forward.");
      }
      try {
        const response = await fetch(`${carebridgeClient.baseUrl}/api/leads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "carebridge-mcp-server/0.1",
            Accept: "application/json",
            ...(args.locale ? { "Accept-Language": args.locale } : {}),
          },
          body: JSON.stringify({
            name: args.name,
            country: args.country,
            phone: args.phone,
            treatment: args.treatment,
            ...(args.locale ? { locale: args.locale } : {}),
          }),
        });
        const text = await response.text();
        if (!response.ok) {
          return toolError(
            `CareBridge rejected the lead (HTTP ${response.status})`,
            text.slice(0, 500),
          );
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "submitted",
                  source: "carebridge-mcp-server/0.1",
                  responseStatus: response.status,
                  response: tryJson(text),
                },
                null,
                2,
              ),
            },
          ],
          structuredContent: {
            status: "submitted",
            responseStatus: response.status,
            response: tryJson(text),
          },
        };
      } catch (error) {
        return toolError("Network error", errMessage(error));
      }
    },
  );
}

function toolError(title: string, detail: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${title}: ${detail}` }],
  };
}

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 500);
  }
}
