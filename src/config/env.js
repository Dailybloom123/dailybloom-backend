require('dotenv').config();

// Required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ADMIN_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

// Optional environment variables with defaults
const optionalEnvVars = {
  PORT: '4000',
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  FRONTEND_URL: 'http://localhost:5173',
  OTP_EXPIRY_MINUTES: '5',
  JWT_EXPIRES_IN: '30d'
};

// Validate required environment variables
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => {
    console.error(`   - ${envVar}`);
  });
  console.error('\nPlease set these environment variables in your .env file');
  process.exit(1);
}

// Set optional environment variables with defaults
Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
  if (!process.env[key]) {
    process.env[key] = defaultValue;
  }
});

// Validate environment variable formats
const validateEnv = () => {
  // Validate DATABASE_URL format
  if (!process.env.DATABASE_URL.startsWith('postgres://') && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL must start with postgres:// or postgresql://');
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters for security');
  }

  // Validate PORT is a number
  const port = parseInt(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('❌ PORT must be a valid port number (1-65535)');
    process.exit(1);
  }

  // Validate OTP_EXPIRY_MINUTES is a number
  const otpExpiry = parseInt(process.env.OTP_EXPIRY_MINUTES);
  if (isNaN(otpExpiry) || otpExpiry < 1) {
    console.error('❌ OTP_EXPIRY_MINUTES must be a positive number');
    process.exit(1);
  }

  console.log('✅ Environment variables validated successfully');
};

validateEnv();

module.exports = {
  requiredEnvVars,
  optionalEnvVars
};
