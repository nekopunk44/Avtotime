import autocannon from "autocannon";

const BASE_URL = process.env.LOAD_BASE_URL || "http://localhost:8000";
const USERNAME = process.env.LOAD_USERNAME || "neko_punk";
const PASSWORD = process.env.LOAD_PASSWORD || "123456";
const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS || 100);
const DURATION = Number(process.env.LOAD_DURATION_SECONDS || 20);

const signInAndGetCookie = async () => {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: USERNAME, password: PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Signin failed: ${res.status} ${res.statusText} ${text}`.trim());
  }

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Signin succeeded but no Set-Cookie header returned (token cookie missing).");
  }

  const tokenCookie = setCookie
    .split(",")
    .map((part) => part.trim())
    .find((part) => /^token(?:_[^=;]+)?=/.test(part));

  if (!tokenCookie) {
    throw new Error(`Could not find token cookie in Set-Cookie: ${setCookie}`);
  }

  return tokenCookie.split(";")[0]; // "token=..."
};

const run = async () => {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User: ${USERNAME}`);
  console.log(`Connections: ${CONNECTIONS}, Duration: ${DURATION}s`);

  const cookie = await signInAndGetCookie();
  console.log("Auth cookie acquired.");

  const url = `${BASE_URL}/api/market/cars?mine=0`;

  const instance = autocannon(
    {
      url,
      connections: CONNECTIONS,
      duration: DURATION,
      headers: {
        cookie,
      },
    },
    (err, result) => {
      if (err) {
        console.error("Load test failed:", err);
        process.exitCode = 1;
        return;
      }
      console.log(autocannon.printResult(result));
    },
  );

  autocannon.track(instance, { renderProgressBar: true });
};

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
