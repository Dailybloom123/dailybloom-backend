require('dotenv').config();
require('./src/config/env'); // Validate environment variables
const app = require('./src/app');

const PORT = process.env.PORT || 4000;

// Disable cluster mode for development to avoid port conflicts
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Server accessible on network at http://192.168.0.22:${PORT}`);
});
