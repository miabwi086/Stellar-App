## 📝 README.md

```markdown
# Stellar dApp - Level 1 White Belt

A simple Stellar decentralized application (dApp) built for the Stellar Developer Challenge Level 1. This application allows users to connect their Freighter wallet, view their XLM balance, and send XLM transactions on the Stellar Testnet.

## 🚀 Features

- **Wallet Connection**: Connect and disconnect Freighter wallet
- **Balance Display**: View XLM balance of connected wallet
- **Transaction Sending**: Send XLM to any Stellar address
- **Transaction Feedback**: Real-time status with transaction hash and explorer link
- **Error Handling**: Comprehensive error messages for user guidance
- **Testnet Ready**: Fully configured for Stellar Testnet

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React, TypeScript
- **Styling**: Inline styles
- **Blockchain**: Stellar SDK (`@stellar/stellar-sdk`)
- **Wallet**: Freighter API (`@stellar/freighter-api`)
- **Network**: Stellar Testnet

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Freighter wallet extension installed in your browser ([Download](https://www.freighter.app))
- Git (for cloning repository)

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/miabwi086/Stellar-App.git
cd Stellar-App
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Freighter Wallet

1. Install Freighter extension from [freighter.app](https://www.freighter.app)
2. Create a new wallet or import existing one
3. **Important**: Switch network to **Testnet** in Freighter settings
4. Fund your wallet using the "Fund with Friendbot" option

### 4. Configure SSL Certificates (Required for Freighter)

**For Linux (Ubuntu/Debian):**
```bash
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
mkcert -install
mkdir -p certificates
mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1 ::1
```

**For Arch Linux:**
```bash
sudo pacman -Syu mkcert
mkcert -install
mkdir -p certificates
mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1 ::1
```

**For macOS:**
```bash
brew install mkcert
mkcert -install
mkdir -p certificates
mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1 ::1
```

### 5. Create `next.config.js`

Create this file in the root directory:

```javascript
// next.config.js
const fs = require('fs');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.8.130'],
  server: {
    https: {
      key: fs.readFileSync(path.join(__dirname, 'certificates/localhost-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'certificates/localhost.pem')),
    },
  },
};

module.exports = nextConfig;
```

### 6. Run the Application

```bash
npx next dev --experimental-https
```

Access the application at: **`https://localhost:3000`**

> **Note**: Browser will show a security warning - click "Advanced" → "Proceed to localhost (unsafe)" to continue.

## 💻 Usage Guide

### Connect Wallet

1. Click the **"Connect Wallet"** button
2. Freighter popup will appear - approve the connection
3. Your public address will be displayed (shortened)
4. XLM balance will automatically load

### Send XLM Transaction

1. Enter the **destination Stellar address** (starts with G...)
2. Enter the **amount** in XLM (e.g., 1.5)
3. Click **"Send"** button
4. Approve the transaction in Freighter wallet
5. Status will update:
   - ✅ **Success**: Transaction hash with link to Stellar Explorer
   - ❌ **Error**: Error message with details

### Disconnect Wallet

Click the **"Disconnect"** button next to your public address.

## 📁 Project Structure

```
Stellar-App/
├── app/
│   ├── components/
│   │   ├── walletConnect.tsx
│   │   ├── balanceDisplay.tsx
│   │   ├── sendTransaction.tsx
│   │   └── transactionStatus.tsx
│   ├── lib/
│   │   └── stellar.ts
│   └── page.tsx
├── certificates/
│   ├── localhost.pem
│   └── localhost-key.pem
├── next.config.js
└── package.json
```

## 🔗 Resources

- [Stellar Developer Documentation](https://developers.stellar.org)
- [Freighter Wallet](https://www.freighter.app)
- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Stellar Testnet Faucet](https://laboratory.stellar.org/#account-creator?network=testnet)
- [Stellar Explorer (Testnet)](https://stellar.expert/explorer/testnet)

## ✅ Submission Checklist

- [x] GitHub repository (public)
- [x] README.md (this file)
- [x] Setup instructions included
- [x] Screenshots attached
- [x] Wallet connect/disconnect
- [x] Balance display
- [x] Transaction sending
- [x] Success/error feedback
- [x] Error handling
- [x] Code runs on localhost with HTTPS

---
