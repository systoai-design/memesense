
const fs = require('fs');
const path = require('path');

const content = `[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  HELIUS_RPC_URL = "https://mainnet.helius-rpc.com/?api-key=4bd4311b-8cf4-4f9e-9aac-e46f2375008d"
  NEXT_PUBLIC_RPC_URL = "https://api.mainnet-beta.solana.com"

[functions]
  timeout = 26
  node_bundler = "esbuild"
  external_node_modules = ["@libsql/client"]
`;

// Replace any potential \r\n with \n just to be safe (though template literal usually takes script line endings, we want to force it)
const lfContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

fs.writeFileSync(path.join(__dirname, 'netlify.toml'), lfContent, { encoding: 'utf8' });
console.log('Written netlify.toml with LF line endings.');
