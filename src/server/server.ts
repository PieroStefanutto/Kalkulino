import { createApp, resetStores } from './app';

const port = Number(process.env.PORT ?? 3000);

resetStores();

const app = createApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`Kalkulino API listening on http://localhost:${port}`);
});
