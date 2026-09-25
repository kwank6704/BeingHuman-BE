import { app } from './app.js';
import { config } from './config.js';
import { purgeDeleted } from './routes/memories.js';

app.listen(config.port, () => {
  console.log(`BeingHuman API on http://localhost:${config.port}`);
});

// Deleted photos can be taken back for a week; after that their files are removed.
const purge = () => purgeDeleted().catch(e => console.error('purge failed:', e.message));
purge();
setInterval(purge, 60 * 60 * 1000).unref();
