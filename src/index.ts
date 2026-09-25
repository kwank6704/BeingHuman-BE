import { app } from './app.js';
import { config } from './config.js';

// Vercel invokes the exported app as a function; everywhere else, listen.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`BeingHuman API on http://localhost:${config.port}`);
  });
}

export default app;
