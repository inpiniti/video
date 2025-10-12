// Test TeraBox credentials from .env file
import { readFileSync } from "fs";

console.log("\n=== TeraBox Credentials Test ===\n");

// Read .env file manually
const envContent = readFileSync(".env", "utf-8");
const envVars = {};

envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const credentials = {
  ndus: envVars.TERABOX_NDUS,
  appId: envVars.TERABOX_APP_ID,
  uploadId: envVars.TERABOX_UPLOAD_ID,
  jsToken: envVars.TERABOX_JS_TOKEN,
  browserId: envVars.TERABOX_BROWSER_ID,
};

console.log("Checking credentials...\n");

let allValid = true;

for (const [key, value] of Object.entries(credentials)) {
  if (!value || value.startsWith("your_")) {
    console.log(`❌ ${key}: NOT SET`);
    allValid = false;
  } else {
    const preview =
      value.length > 50
        ? `${value.substring(0, 20)}...${value.substring(value.length - 10)}`
        : value;
    console.log(`✅ ${key}: ${preview}`);
  }
}

console.log("\n" + "=".repeat(50));

if (allValid) {
  console.log("\n✅ All credentials are set!");
  console.log("\n📝 Next steps:");
  console.log("1. Run: npm run dev");
  console.log('2. Click the "Upload" button on a video');
  console.log("3. Check terminal logs for upload progress");
  console.log("\n⚠️  Note: jsToken and uploadId may expire after some time.");
  console.log("   If upload fails, repeat the network capture process.");
} else {
  console.log("\n❌ Some credentials are missing!");
  console.log("\nPlease check .env file and ensure all values are set.");
}

console.log("\n");
