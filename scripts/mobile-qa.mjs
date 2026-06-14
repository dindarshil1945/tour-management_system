const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const widths = [320, 375, 390, 414, 768];
const baseUrl = process.env.MOBILE_QA_BASE_URL || "http://127.0.0.1:5173";
const pages = [
  "/",
  "/families",
  "/members",
  "/treasury",
  "/payment-transactions",
  "/expenses",
  "/transfers",
  "/committee-wallets",
  "/bank-accounts",
  "/treasury-ledger",
  "/announcements",
  "/tours",
  "/reports",
  "/settings",
  "/users",
  "/audit",
];

async function connect() {
  const target = await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" }).then((response) => response.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const messageId = ++id;
      const timeout = setTimeout(() => {
        pending.delete(messageId);
        resolve({ error: { message: `Timed out: ${method}` } });
      }, 10000);
      pending.set(messageId, (message) => {
        clearTimeout(timeout);
        resolve(message);
      });
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

  return { ws, send };
}

async function run() {
  const { ws, send } = await connect();
  const failures = [];

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: baseUrl });
  await sleep(500);
  await send("Runtime.evaluate", {
    expression: "localStorage.setItem('role','SUPER_ADMIN');localStorage.setItem('name','Mobile QA');localStorage.setItem('access_token','qa-token');",
    returnByValue: true,
  });

  for (const width of widths) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });

    for (const path of pages) {
      await send("Page.navigate", { url: `${baseUrl}${path}` });
      await sleep(900);
      await send("Runtime.evaluate", {
        expression:
          "localStorage.setItem('role','SUPER_ADMIN');localStorage.setItem('name','Mobile QA');localStorage.setItem('access_token','qa-token');",
        returnByValue: true,
      });
      await sleep(250);

      const evaluation = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const doc = document.documentElement;
          const body = document.body;
          const fixedNav = [...document.querySelectorAll('nav')].some((nav) => {
            const rect = nav.getBoundingClientRect();
            return getComputedStyle(nav).position === 'fixed' && rect.bottom >= innerHeight - 2 && rect.height > 40;
          });
          const fab = [...document.querySelectorAll('button')].some((button) => {
            const rect = button.getBoundingClientRect();
            return button.getAttribute('aria-label') === 'Quick actions' && rect.width > 40 && rect.bottom <= innerHeight + 1;
          });
          const tableVisible = [...document.querySelectorAll('table')].some((table) => {
            return getComputedStyle(table).display !== 'none' && table.getBoundingClientRect().width > 0;
          });
          const bad = [...document.querySelectorAll('main *')]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && (rect.left < -1 || rect.right > innerWidth + 1);
            })
            .slice(0, 3)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                text: (element.textContent || '').trim().slice(0, 35),
                left: rect.left,
                right: rect.right,
              };
            });
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            bodyScroll: body.scrollWidth,
            fixedNav,
            fab,
            tableVisible,
            bad,
          };
        })()`,
      });

      if (evaluation.error) {
        failures.push({ width, path, issue: evaluation.error.message });
        continue;
      }
      const result = evaluation.result.result.value;
      if (result.scrollWidth > result.clientWidth + 1 || result.bodyScroll > result.clientWidth + 1 || result.bad.length) {
        failures.push({ width, path, result });
      }
      if (!result.fixedNav) failures.push({ width, path, issue: "bottom nav missing" });
      if (!result.fab) failures.push({ width, path, issue: "quick action missing" });
      if (width < 768 && result.tableVisible) failures.push({ width, path, issue: "table visible on phone" });

      if (path === "/" && width < 1024) {
        const moreResult = await send("Runtime.evaluate", {
          returnByValue: true,
          awaitPromise: true,
          expression: `(async () => {
            const more = [...document.querySelectorAll('button')].find((button) => {
              const rect = button.getBoundingClientRect();
              return button.textContent.trim() === 'More' && rect.width > 0 && rect.height > 0;
            });
            if (!more) return { ok: false, reason: 'More button missing' };
            more.click();
            await new Promise((resolve) => setTimeout(resolve, 120));
            const text = document.body.textContent || '';
            return {
              ok: ['Announcements', 'Tours', 'Reports', 'Settings', 'Users', 'Audit Logs'].every((item) => text.includes(item)),
              reason: text.slice(0, 200),
            };
          })()`,
        });
        if (!moreResult.result?.result?.value?.ok) failures.push({ width, path, issue: "More sheet incomplete", detail: moreResult.result?.result?.value });
      }
    }
  }

  ws.close();
  console.log(JSON.stringify({ failures }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
