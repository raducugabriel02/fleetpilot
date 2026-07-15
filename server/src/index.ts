import { createApp } from './app';
import { env } from './lib/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API pornit pe http://localhost:${env.PORT}`);
});
