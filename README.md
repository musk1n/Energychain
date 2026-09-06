# EnergyChain

EnergyChain is a blockchain-enabled renewable-energy exchange. It connects smart-meter readings, peer-to-peer energy trading, carbon credits, wallet transactions, and emergency grid alerts in one demonstrable workflow.

Live deployment: [energychain-omega.vercel.app](https://energychain-omega.vercel.app/)

## Why It Matters

Energy data is usually trapped between a physical meter, a utility dashboard, and a centralized billing system. EnergyChain makes the important parts visible and programmable:

- Producers can list surplus renewable energy.
- Buyers can purchase energy directly through a smart contract.
- Purchases generate carbon credits.
- Meter readings can be recorded on-chain as an auditable history.
- Smart Grid Match recommends the next action from generation and consumption.
- Emergency Grid Alerts can push a recommended trade to a phone.

The result is a prototype for a more transparent microgrid marketplace where energy has provenance, a price, and an actionable response.

## Product Flow

```text
Physical meter or simulator
        |
        v
Camera OCR and user confirmation
        |
        v
MetaMask signs updateMeterData on Sepolia
        |
        v
Energy Passport stores meter history
        |
        v
Smart Grid Match recommends buy or sell
        |
        v
Energy listing and purchase through EnergyTrading
        |
        v
Carbon credits and transaction history
        |
        v
Emergency alerts through Browser Push or Telegram
```

## ✨ Features

### 🎬 Demo Mode

The application opens in demo mode so the complete product can be presented without a wallet, deployed contract state, or Sepolia ETH. Demo data includes energy listings, carbon credits, meter history, transactions, and simulated interactions.

Demo actions update React state only. They do not create blockchain transactions.

Use **Use MetaMask** to leave demo mode and use the real Sepolia flow.
<img width="1338" height="676" alt="image" src="https://github.com/user-attachments/assets/c49c7798-0560-4b77-a69d-072a590a30a4" />


### 🦊 MetaMask and Sepolia
<img width="1350" height="676" alt="image" src="https://github.com/user-attachments/assets/b8571e42-3d2d-4c7b-b4f9-f3dc463ff934" />
<img width="1359" height="675" alt="image" src="https://github.com/user-attachments/assets/76b07830-9818-4291-8e2d-eaf68318ab63" />
<img width="1356" height="680" alt="image" src="https://github.com/user-attachments/assets/6645ea89-2da9-42bb-933e-aa72c61d5f2e" />

The live dashboard connects to MetaMask through `ethers.js`. It validates the Sepolia network before submitting transactions.

Live transactions include:

- Listing energy.
- Buying energy.
- Listing carbon credits.
- Buying carbon credits.
- Recording smart-meter data.

Every confirmed action appears in Recent Activity with its transaction hash.
<img width="1356" height="670" alt="image" src="https://github.com/user-attachments/assets/d59b07f9-0353-42a6-b5b0-4e0b966fca1e" />


### ⚡ Multi-Listing Energy Marketplace

Energy listings use numeric IDs rather than wallet addresses. This matters because one wallet can publish multiple independent listings.
<img width="1220" height="628" alt="image" src="https://github.com/user-attachments/assets/f16e6f9a-1b25-41c5-9688-398653712c4b" />

The contract stores listings using:

```solidity
mapping(uint256 => EnergyData) public energyListings;
uint256 public nextEnergyListingId;
```

Buying one listing marks only that listing unavailable. Other sellers and other listings remain available.

### 🌱 Carbon Credits
<img width="1330" height="673" alt="image" src="https://github.com/user-attachments/assets/eabb8c1e-4400-479e-a037-6db259b35e4c" />

When energy is purchased, the buyer receives carbon credits calculated by the contract. Credits can then be listed and purchased in a separate marketplace.

The prototype calculation is:

```solidity
energyAmount / 100
```

This demonstrates the trading flow. It is not an environmental certification standard.

### ✨ Smart Grid Match
<img width="1327" height="263" alt="image" src="https://github.com/user-attachments/assets/ee8937dc-1cb6-4f70-95b8-23d823a2f80b" />

Smart Grid Match compares generation and consumption:

- Generation above consumption produces a surplus recommendation.
- Consumption above generation produces a shortfall recommendation.
- The marketplace is searched for the best available energy rate.
- Surplus listings can be prepared automatically in the form.
- A shortfall can trigger the existing purchase flow.

This is the foundation for an energy-management agent that could later use real IoT telemetry, market prices, and user preferences.

### 📷 Camera Meter Scanner
<img width="1324" height="662" alt="image" src="https://github.com/user-attachments/assets/57edc287-a3ae-4197-9c57-3be541323e2c" />
<img width="1335" height="291" alt="image" src="https://github.com/user-attachments/assets/5795fe4a-9fad-4b45-a433-4cc0370d2309" />

The dashboard can open a phone camera or accept a meter photo. `tesseract.js` performs OCR locally in the browser.

The scanner:

1. Captures a camera frame or uploaded image.
2. Crops the meter region.
3. Enlarges and preprocesses the image.
4. Extracts a candidate kWh value.
5. Shows the raw OCR text.
6. Requires the user to confirm or correct the value.
7. Updates the dashboard only after confirmation.

The image is not uploaded by the scanner. The confirmed value can then be recorded on-chain through MetaMask.

Camera OCR is an input assistant, not a trusted oracle. A blurry display, glare, or a fabricated screen can produce a wrong value. Production hardware should sign readings or expose a signed QR payload.

### 📡 IoT Meter Records
<img width="1333" height="587" alt="image" src="https://github.com/user-attachments/assets/fcee6edd-a20e-4607-9f29-2d72c843d7e5" />

The live contract stores meter history per wallet:

```solidity
mapping(address => SmartMeterData[]) public meterReadings;
```

The dashboard calls `updateMeterData(consumption, generation)`, waits for the MetaMask receipt, and displays the resulting transaction hash. The Energy Passport then loads the history through `getMeterReadings(account)`.

### 🪪 Energy Passport
<img width="1317" height="397" alt="image" src="https://github.com/user-attachments/assets/d0dc048d-88c2-4f69-b77b-21b4ba4bb349" />

Energy Passport turns the meter history into a visible provenance timeline. Each record shows:

- Timestamp.
- Generation.
- Consumption.
- Surplus available to trade or energy drawn from the grid.
- Whether the record came from the contract or local demo state.

This makes the relationship between a physical reading and a later energy trade easy to explain during a demo.

### 🚨 Emergency Grid Alerts
<img width="1313" height="245" alt="image" src="https://github.com/user-attachments/assets/db9743c0-d88c-40ef-9b98-614b2dd5b715" />
<img width="1336" height="666" alt="image" src="https://github.com/user-attachments/assets/4c5a8600-4e2a-43ed-b05b-dbef08f7696b" />
<img width="70" height="200" alt="WhatsApp Image 2026-09-06 at 5 45 13 PM" src="https://github.com/user-attachments/assets/759f7499-a2b7-4b78-a2d3-322b28fe1e01" />

The dashboard includes a critical-peak simulator. It prepares a valid whole-kWh recommendation of `3 kWh` at `0.05 Sepolia ETH` and records the emergency event in dashboard activity.

Free delivery options:

- Browser Push: no external account required.
- Telegram Bot API: free, with a bot token and chat ID.

The alert contains a deep link. Opening it activates the dashboard emergency state and pre-fills the trade form. A phone cannot open a computer's `localhost`, so local testing uses the deployed Vercel URL for the deep link.

## Technology

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide icons
- `ethers.js` for wallet and contract calls
- `tesseract.js` for browser OCR

### Blockchain

- Solidity `0.8.x`
- Sepolia testnet
- MetaMask
- EnergyTrading contract
- Event and transaction receipt tracking

### IoT and Data

- Mock smart-meter generator for demo mode.
- Browser camera and photo upload.
- Client-side OCR preprocessing.
- On-chain meter history.
- Existing IPFS/Pinata integration scripts in `IoT_Integration/`.

### Privacy Research

The repository contains Circom/Groth16 material under `zk_snarks/`. The existing circuit is a positive-balance demonstration. It does not yet prove that an OCR result came from a real meter.

A future useful circuit could prove that a private reading exceeds a threshold without revealing the exact value. A trusted signed meter input is still required to establish that the original reading is genuine.

## Local Setup

### Requirements

- Node.js 18 or newer.
- npm.
- MetaMask for live transactions.
- Sepolia ETH only for live gas and transaction value.

### Install and Run

```bash
git clone https://github.com/musk1n/Energychain.git
cd Energychain
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

### Environment and Secret Protection

Copy the template:

```powershell
Copy-Item .env.example .env
```

For free Telegram alerts, fill in:

```text
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Create a bot with `@BotFather`, send it `/start`, then use Telegram's `getUpdates` endpoint to find the chat ID. Restart Vite after changing `.env` because environment variables are loaded when the server starts.

The repository ignores `.env`. A versioned `.githooks/pre-push` hook blocks environment files, private keys, and common credential files from being pushed. Never place real secrets in `.env.example`, source files, or README screenshots.

### Free Sepolia ETH

For live transactions, switch MetaMask to Sepolia and request test ETH from a public Sepolia faucet. No real funds are needed. Never enter a private key into a faucet or the application.

## Contract Deployment

The frontend address and ABI are configured in `src/config/contract.ts`.

If you change `src/contracts/EnergyTrading.sol`, deploy the updated contract before testing live behavior:

1. Open the Solidity file in Remix.
2. Compile with Solidity `0.8.x`.
3. Select **Injected Provider - MetaMask**.
4. Switch MetaMask to Sepolia.
5. Deploy `EnergyTrading`.
6. Copy the new address into `CONTRACT_ADDRESS`.
7. Update `CONTRACT_ABI` to match the deployed contract.
8. Restart Vite.

Deployed Solidity code is immutable. Frontend changes alone cannot change the contract storage model or add functions to an existing address.

## Telegram Alert Setup

1. Open Telegram and message `@BotFather`.
2. Run `/newbot` and copy the token.
3. Message your new bot with `/start`.
4. Open `https://api.telegram.org/botYOUR_TOKEN/getUpdates`.
5. Copy the numeric `chat.id` into `TELEGRAM_CHAT_ID`.
6. Restart `npm run dev`.
7. Select **Telegram - free** in the dashboard.
8. Click **Simulate critical peak**.

The local Vite plugin handles `/api/send-alert` during development. The Vercel function at `api/send-alert.ts` handles the same route in deployment. If delivery is unavailable, the dashboard reports the exact error and keeps the critical event visible locally.

## Scripts

```bash
npm run dev      # Start Vite development server
npm run build    # Create a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build
```

## Limitations and Next Steps

This is a working prototype and a demonstration of the architecture. Important limitations:

- Demo-mode actions are local and are not blockchain transactions.
- Camera OCR does not prove that a physical meter is authentic.
- The smart-meter generator is simulated unless a live reading is recorded.
- Carbon-credit calculation is simplified.
- Telegram is free but is not SMS or WhatsApp.
- ZK artifacts are research material and are not yet connected to meter verification.
- The current contract does not enforce that an energy listing is backed by a signed meter record.

The strongest production upgrades are signed meter QR payloads, hardware-backed device identities, a trusted oracle, a real ZK circuit for private meter thresholds, and a contract function that links an energy listing to a verified meter record.

## Project Structure

```text
src/
  components/
    Dashboard.tsx          Main marketplace and energy operations UI
    MeterScanner.tsx       Camera/photo OCR input
    MetaMaskConnect.tsx    Wallet connection screen
  config/contract.ts       Deployed address and contract ABI
  contracts/EnergyTrading.sol
                           Energy listings, purchases, credits, and meter history
  utils/mockIoT.ts         Demo smart-meter generator
api/send-alert.ts          Vercel Telegram alert function
.githooks/pre-push         Secret-file push protection
IoT_Integration/           IPFS/hash integration scripts and sample data
zk_snarks/                 Circom/Groth16 research artifacts
```

## License

No license has been specified for this repository yet.
