import { createApp } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

createApp().listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`zk-sudo admin service listening on http://localhost:${PORT}`);
});
