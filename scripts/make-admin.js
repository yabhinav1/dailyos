// One-off script: promotes a user to ADMIN by email.
// Run from the project root, ON THE SERVER where DATABASE_URL is set:
//
//   node --env-file=.env.local scripts/make-admin.js you@example.com
//
// (If your Node version is older than 20.6, install dotenv instead and
// swap the --env-file flag for `require("dotenv").config()` at the top.)

const { Client } = require("pg");

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node --env-file=.env.local scripts/make-admin.js <email>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — make sure you're passing --env-file=.env.local (or run this on the server where the env var is already exported).");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(
      `UPDATE "User" SET role = 'ADMIN' WHERE email = $1 RETURNING id, email, role`,
      [email]
    );

    if (res.rowCount === 0) {
      console.error(`No user found with email "${email}". Double-check it matches exactly what you signed up with.`);
      process.exit(1);
    }

    console.log(`Done — ${res.rows[0].email} is now ${res.rows[0].role}.`);
    console.log(`Log out and back in (or just refresh) so the session picks up the new role — you should see "Admin · Music" in the sidebar.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
