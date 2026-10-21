# Connecting GPT securely to the GitHub Pages Shopping Agent

The frontend **continues to run on GitHub Pages** at:

https://stephencho820.github.io/scom-data-platform/agent.html

GitHub Pages cannot securely store a GPT API key or execute server-side model tools. This integration uses **Supabase Edge Functions as an optional private-key backend** and the existing published source-linked KR SKU snapshot as the read-only data source.

## Status in this repository

- `web/agent.js` automatically chooses the GPT backend **only when** `web/agent-config.js` has a valid public Edge Function URL.
- Until a backend URL is supplied, all existing public SKU browsing and rule-based question answering still work.
- `supabase/functions/shopping-agent/index.ts` implements OpenAI Responses Tool Calling and four SKU data tools. Prices are withheld after 36 hours or if other checks fail. Observed page prices are **not** represented as official MSRP.
- The Edge Function is **not deployed** by committing source code.
- **Neither OPENAI_API_KEY nor the POC access code belongs in this repository, GitHub Pages, chat messages, or a client-side environment variable.**

## Steps to activate the GPT backend

1. Choose a Supabase project for this experimental service. Prefer an isolated project instead of deploying into an unrelated live Casa / Meca project. Do not share project service-role or database passwords with a public site.
2. Clone the repository and follow the current Supabase CLI or Dashboard **Edge Function** instructions. From the repository root, after linking the selected project, deploy function `shopping-agent`. The `supabase/config.toml` entry has `verify_jwt = false` to enable the GitHub Pages browser to reach it. **A separate access code is mandatory.**
3. In **Supabase Dashboard → Edge Functions → Secrets** (or project secrets interface), set:
   - `OPENAI_API_KEY`: the private OpenAI Platform API key (provided only in the dashboard).
   - `SHOPPING_AGENT_ACCESS_CODE`: a random code of **at least 12 characters**, known only to allowed POC testers. Do **not** use your OpenAI key as the access code.
   - `OPENAI_MODEL` (optional): a model enabled for your OpenAI API account. Default in code: `gpt-5.5`.
4. After deployment, copy the **public Edge Function URL** (not a credential) into `web/agent-config.js` as `SHOPPING_AGENT_BACKEND_URL = "https://<project-ref>.supabase.co/functions/v1/shopping-agent";`.
5. Commit the URL change to the GitHub Pages repository and confirm the `Deploy public site` workflow passes.
6. Open the Pages Shopping Agent and send a question. The browser asks once per tab for **POC access code**, not the OpenAI key. The OpenAI key remains server-side.
7. Verify the Developer Monitor shows real tool calls and source citations. Test questions with missing SKU/price and confirm the assistant refuses to invent data.

## API architecture

```text
Customer browser
  └─ GitHub Pages (static frontend, source-linked KR SKU cards)
       └─ POST to Supabase Edge Function (HTTPS; CORS limited to Pages origin)
            ├─ Verify POC access code (server secret)
            ├─ Read published KR SKU snapshot (public, source-linked)
            ├─ OpenAI Responses API (server-side secret)
            ├─ Tool calls: search_products / get_product_specs /
            │             get_product_price / compare_products
            └─ Return answer, verified-source product cards, execution trace
```

The snapshot includes only data already collected and published by the original crawler. It is incomplete. Live stock, delivery, customer orders, private information, and analysis of historical prices are out of scope.

## Security / cost limitations

This is a **restricted technical POC**, not a public production shopping chatbot. Passing a shared access code is only a basic gate. The function has a **best-effort in-memory 25 requests/15 minutes per isolate** counter; it is NOT a distributed rate limiter. CORS is not authentication. Before removing the tester gate or inviting untrusted public traffic, add proper identity verification, per-user or per-IP distributed rate limits, abuse monitoring, and strict model-spend controls. Configure OpenAI usage alerts/budgets and protect the Supabase project. Never persist the GPT API key in the browser.

There is no need to configure Vercel for the GitHub Pages frontend.
