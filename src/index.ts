import { app } from './app.js';
import { config } from './config.js';
import { purgeDeleted } from './routes/memories.js';

// Vercel invokes the exported app as a function; everywhere else, listen.
// (On Vercel, old deleted photos are purged whenever someone deletes a photo instead.)
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`BeingHuman API on http://localhost:${config.port}`);
  });

  // Deleted photos can be taken back for a week; after that their files are removed.
  const purge = () => purgeDeleted().catch(e => console.error('purge failed:', e.message));
  purge();
  setInterval(purge, 60 * 60 * 1000).unref();
}

export default app;
