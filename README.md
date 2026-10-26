# Mockify Lite

A Chrome side-panel extension for frontend debugging: mock or modify API responses, rewrite requests before they reach the backend, inspect traffic, and edit storage.

## Features

- **Rules**: match requests by method and URL (contains, wildcard or regex), then:
  - **Mock**: return a status, headers and body without hitting the network.
  - **Modify**: call the real API, then override the status, headers or body. The body can be replaced or JSON merge-patched.
  - **Error**: fail the request like a network error.
  - **Edit request**: rewrite the URL (for example prod → staging), add headers, or replace or merge-patch the payload.
  - **Delay**: add latency to any of the above.
- **Scenarios**: group rules and switch a whole group on or off.
- **Log**: fetch and XHR traffic for the current tab. "Mock" turns a request into a prefilled rule, "Resend" opens it in Compose, and you can copy any request as cURL.
- **Compose**: send a request from inside the page, so cookies, origin and CORS behave like the app's own requests. Save requests into collections, and switch between environments (for example `BASE_URL` for local and staging). The URL, headers and body accept macros:

  | Macro                               | Value                                                                  |
  | ----------------------------------- | ---------------------------------------------------------------------- |
  | `{{env.KEY}}`                       | Variable from the active environment. Values can contain other macros. |
  | `{{local.key}}` / `{{session.key}}` | The page's localStorage / sessionStorage                               |
  | `{{cookie.name}}`                   | Cookie for the current page, including httpOnly                        |
  | `{{$uuid}}` / `{{$timestamp}}`      | Random UUID / Unix time in seconds                                     |

  A request with an unresolved macro is not sent.

- **Storage**: view and edit localStorage, sessionStorage and cookies (including httpOnly). JWT values are decoded, with their expiry.
- **Clear site data**: wipes cookies, storage and cache for the current site, then reloads.
- **Import / export** rules as JSON.

The interceptor only runs on hosts in the allowlist (Settings, or the switch in the header). The default list is `localhost` and `127.0.0.1`. After enabling a site, reload the page.

## How it works

`entrypoints/interceptor.ts` runs in the page's main world at `document_start` and patches `fetch` and `XMLHttpRequest`. `entrypoints/bridge.ts` runs in the isolated world: it relays rules from extension storage and buffers the request log. The background script registers both scripts for the allowlisted hosts only.

Limitations: synchronous XHR and requests from service workers or web workers bypass rules.

## Development

```sh
bun install
bun run dev          # Chrome with the extension loaded and HMR
bun run build        # .output/chrome-mv3, load it via chrome://extensions → Load unpacked
bun test             # unit tests for matching, merge patch, rewrite, import, cURL, JWT, macros
bun run type-check
bun run lint
bun run format
```

UI components come from shadcn-vue (`bunx shadcn-vue@latest add <component>`) and live in `components/ui`.
