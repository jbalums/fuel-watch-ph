// Supabase Edge Function: ai-extract-fuel-prices
//
// Server-side LLM extraction of fuel prices from a posted IMAGE (price board
// photo) and/or pasted TEXT, via OpenRouter. The OpenRouter API key is a SECRET
// and must never reach the browser bundle — it lives only here as the
// `OPENROUTER_API_KEY` function secret. Super-admin gated.
//
// Deploy:  supabase functions deploy ai-extract-fuel-prices
// Secret:  supabase secrets set OPENROUTER_API_KEY=sk-or-...
//          supabase secrets set OPENROUTER_MODEL=google/gemini-2.5-flash   (optional)
//
// NOTE: image input requires a vision-capable model. The default below accepts
// images; the `-lite` variant used by ai-fuel-prices may not.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const FUEL_TYPES = [
	"Unleaded",
	"Premium",
	"Diesel",
	"Premium Diesel",
	"Kerosene",
] as const;

interface RequestPayload {
	imageBase64?: string;
	mimeType?: string;
	text?: string;
}

interface PriceResult {
	fuelType: string;
	price: number | null;
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
	const unfenced = trimmed
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "");
	try {
		return JSON.parse(unfenced);
	} catch {
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

	const imageBase64 = payload.imageBase64?.trim();
	const text = payload.text?.trim();
	if (!imageBase64 && !text) {
		return json({ error: "Provide an image or text to analyze" }, 400);
	}

	const model = Deno.env.get("OPENROUTER_MODEL") ?? DEFAULT_MODEL;

	const systemPrompt = [
		"You are a fuel price extraction assistant for the Philippines.",
		"Read the provided price board image and/or text and extract pump prices.",
		"Return ONLY valid JSON matching this shape:",
		'{ "brandGuess": string|null, "results": [ { "fuelType": string, "price": number|null, "confidence": "high"|"medium"|"low" } ] }',
		`fuelType MUST be one of: ${FUEL_TYPES.join(", ")}.`,
		"price is per liter in PHP (number only, no currency symbol).",
		"If a fuel type is not visible or unreadable, set its price to null.",
		"brandGuess is the station brand if recognizable (e.g. Shell, Petron, Caltex), else null.",
		"Do not invent prices. Only report what is shown.",
	].join("\n");

	const userContent: Array<Record<string, unknown>> = [];
	if (imageBase64) {
		const mime = payload.mimeType || "image/jpeg";
		userContent.push({
			type: "image_url",
			image_url: { url: `data:${mime};base64,${imageBase64}` },
		});
	}
	if (text) {
		userContent.push({ type: "text", text: `Pasted text:\n${text}` });
	}
	userContent.push({
		type: "text",
		text: "Extract the fuel prices as JSON per the system instructions.",
	});

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
					{ role: "user", content: userContent },
				],
				max_tokens: 4000,
			}),
		});
	} catch (error) {
		return json({ error: `Failed to reach OpenRouter: ${String(error)}` }, 502);
	}

	if (!openRouterResponse.ok) {
		const detail = await openRouterResponse.text();
		return json(
			{ error: `OpenRouter error (${openRouterResponse.status})`, detail },
			502,
		);
	}

	const completion = await openRouterResponse.json();
	const content: string = completion?.choices?.[0]?.message?.content ?? "";

	let parsed: unknown;
	try {
		parsed = parseModelJson(content);
	} catch (error) {
		return json({ error: String(error), raw: content }, 502);
	}

	const root = (parsed ?? {}) as {
		brandGuess?: unknown;
		results?: unknown;
	};
	const rawResults = Array.isArray(parsed)
		? parsed
		: Array.isArray(root.results)
			? root.results
			: [];

	const results: PriceResult[] = (rawResults as PriceResult[])
		.filter(
			(item) =>
				item &&
				typeof item.fuelType === "string" &&
				(FUEL_TYPES as readonly string[]).includes(item.fuelType),
		)
		.map((item) => ({
			fuelType: String(item.fuelType),
			price:
				typeof item.price === "number" && Number.isFinite(item.price)
					? item.price
					: null,
			confidence: item.confidence ?? "medium",
		}));

	const brandGuess =
		typeof root.brandGuess === "string" && root.brandGuess.trim()
			? root.brandGuess.trim()
			: null;

	return json({ brandGuess, results, model });
});
