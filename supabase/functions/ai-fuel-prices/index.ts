// Supabase Edge Function: ai-fuel-prices
//
// Server-side LLM lookup of latest fuel prices via OpenRouter. The OpenRouter
// API key is a SECRET and must never reach the browser bundle — it lives only
// here as the `OPENROUTER_API_KEY` function secret. Super-admin gated.
//
// Deploy:  supabase functions deploy ai-fuel-prices
// Secret:  supabase secrets set OPENROUTER_API_KEY=sk-or-...
//          supabase secrets set OPENROUTER_MODEL=perplexity/sonar   (optional)

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

interface RequestPayload {
	prompt?: string;
	brands?: string[];
	fuelTypes?: string[];
	region?: { provinceName?: string; cityName?: string };
}

interface PriceResult {
	brand: string;
	fuelType: string;
	price: number | null;
	currency: string;
	source: string;
	asOf: string;
	confidence: "high" | "medium" | "low";
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

function parseModelJson(content: string): unknown {
	const trimmed = content.trim();
	// Strip ```json fences if the model wrapped the payload.
	const unfenced = trimmed
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "");
	try {
		return JSON.parse(unfenced);
	} catch {
		// Last resort: extract the first {...} or [...] block.
		const match = unfenced.match(/[[{][\s\S]*[\]}]/);
		if (match) {
			return JSON.parse(match[0]);
		}
		throw new Error("Model did not return valid JSON");
	}
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	if (req.method !== "POST") {
		return json({ error: "Method not allowed" }, 405);
	}

	const apiKey = Deno.env.get("OPENROUTER_API_KEY");
	if (!apiKey) {
		return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
	const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
	const authHeader = req.headers.get("Authorization") ?? "";

	if (!authHeader) {
		return json({ error: "Authentication required" }, 401);
	}

	// Verify the caller is a super admin, using their own JWT (RLS applies).
	const supabase = createClient(supabaseUrl, anonKey, {
		global: { headers: { Authorization: authHeader } },
	});

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return json({ error: "Authentication required" }, 401);
	}

	const { data: roleRows, error: roleError } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id);

	if (roleError) {
		return json({ error: "Unable to verify permissions" }, 500);
	}

	const isSuperAdmin = (roleRows ?? []).some(
		(row) => row.role === "super_admin",
	);
	if (!isSuperAdmin) {
		return json({ error: "Super admin access required" }, 403);
	}

	let payload: RequestPayload;
	try {
		payload = await req.json();
	} catch {
		return json({ error: "Invalid request body" }, 400);
	}

	const model = Deno.env.get("OPENROUTER_MODEL") ?? DEFAULT_MODEL;
	const brands = payload.brands ?? [];
	const fuelTypes = payload.fuelTypes ?? [];
	const regionLabel = [payload.region?.cityName, payload.region?.provinceName]
		.filter(Boolean)
		.join(", ");

	const systemPrompt = [
		"You are a fuel price research assistant for the Philippines.",
		"Use live web search to find the most recent published pump prices.",
		"Return ONLY valid JSON matching this shape:",
		'{ "results": [ { "brand": string, "fuelType": string, "price": number|null, "currency": "PHP", "source": string, "asOf": string, "confidence": "high"|"medium"|"low" } ] }',
		"price is per liter in PHP. source is the URL or publication you used.",
		"asOf is the date the price was published (YYYY-MM-DD). If unknown, set price to null.",
		"Only include the requested brands and fuel types. Do not invent prices.",
	].join("\n");

	const userPrompt =
		payload.prompt?.trim() ||
		[
			`Find the latest fuel prices for ${regionLabel || "the Philippines"}.`,
			brands.length ? `Brands: ${brands.join(", ")}.` : "",
			fuelTypes.length ? `Fuel types: ${fuelTypes.join(", ")}.` : "",
		]
			.filter(Boolean)
			.join(" ");

	let openRouterResponse: Response;
	try {
		openRouterResponse = await fetch(OPENROUTER_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				max_tokens: 8000,
			}),
		});
	} catch (error) {
		return json(
			{ error: `Failed to reach OpenRouter: ${String(error)}` },
			502,
		);
	}

	if (!openRouterResponse.ok) {
		const detail = await openRouterResponse.text();
		return json(
			{
				error: `OpenRouter error (${openRouterResponse.status})`,
				detail,
			},
			502,
		);
	}

	const completion = await openRouterResponse.json();
	const content: string = completion?.choices?.[0]?.message?.content ?? "";
	const citations: string[] =
		completion?.citations ??
		completion?.choices?.[0]?.message?.annotations?.map(
			(a: { url?: string }) => a?.url,
		) ??
		[];

	let parsed: unknown;
	try {
		parsed = parseModelJson(content);
	} catch (error) {
		return json({ error: String(error), raw: content }, 502);
	}

	const rawResults = Array.isArray(parsed)
		? parsed
		: ((parsed as { results?: unknown }).results ?? []);

	const results: PriceResult[] = (rawResults as PriceResult[])
		.filter((item) => item && typeof item.brand === "string")
		.map((item) => ({
			brand: String(item.brand),
			fuelType: String(item.fuelType),
			price:
				typeof item.price === "number" && Number.isFinite(item.price)
					? item.price
					: null,
			currency: item.currency ?? "PHP",
			source: item.source ?? citations[0] ?? "",
			asOf: item.asOf ?? "",
			confidence: item.confidence ?? "medium",
		}));

	return json({ results, citations, model });
});
