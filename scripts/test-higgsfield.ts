// scripts/test-higgsfield.ts
const id = process.env.HF_API_KEY_ID;
const secret = process.env.HF_API_KEY_SECRET;

if (!id || !secret) {
  console.error("Missing HF_API_KEY_ID or HF_API_KEY_SECRET in .env");
  process.exit(1);
}

const res = await fetch(
  "https://api.higgsfield.ai/requests/00000000-0000-0000-0000-000000000000/status",
  { headers: { Authorization: `Key ${id}:${secret}` } },
);

console.log("Status:", res.status);
console.log("Body:", (await res.text()).slice(0, 300));
console.log("Key ID length:", id.length, "| Secret length:", secret.length);

export {};
