import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

const connectButton = document.getElementById("connectButton");
const sendButton = document.getElementById("sendButton");
const walletStatus = document.getElementById("walletStatus");
const recipientInput = document.getElementById("recipient");
const amountInput = document.getElementById("amount");
const message = document.getElementById("message");

const ARC_CHAIN_ID = "0x4cef52";

let walletProvider = null;
let walletAddress = null;
let adapter = null;

const kit = new AppKit();

connectButton.addEventListener("click", async () => {
  try {
    message.textContent = "Connecting wallet...";

    if (!window.ethereum) {
      throw new Error("No compatible wallet found.");
    }

    walletProvider = window.ethereum;

    await walletProvider.request({
      method: "eth_requestAccounts"
    });

    try {
      await walletProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID }]
      });
    } catch (error) {
      if (error.code === 4902) {
        await walletProvider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ARC_CHAIN_ID,
            chainName: "Arc Testnet",
            nativeCurrency: {
              name: "USDC",
              symbol: "USDC",
              decimals: 18
            },
            rpcUrls: ["https://rpc.testnet.arc.io"],
            blockExplorerUrls: ["https://testnet.arcscan.app"]
          }]
        });
      } else {
        throw error;
      }
    }

    const accounts = await walletProvider.request({
      method: "eth_accounts"
    });

    walletAddress = accounts[0];

    adapter = await createViemAdapterFromProvider({
      provider: walletProvider
    });

    walletStatus.textContent =
      "Connected: " +
      walletAddress.slice(0, 6) +
      "..." +
      walletAddress.slice(-4);

    connectButton.textContent = "Wallet Connected";
    sendButton.disabled = false;
    message.textContent = "Ready to send USDC on Arc Testnet.";
  } catch (error) {
    console.error(error);
    message.textContent =
      error?.message || "Wallet connection failed.";
  }
});

sendButton.addEventListener("click", async () => {
  if (!adapter || !walletAddress) {
    message.textContent = "Connect your wallet first.";
    return;
  }

  const recipient = recipientInput.value.trim();
  const amount = amountInput.value.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    message.textContent = "Enter a valid recipient address.";
    return;
  }

  if (!amount || Number(amount) <= 0) {
    message.textContent = "Enter a valid USDC amount.";
    return;
  }

  sendButton.disabled = true;
  message.textContent = "Preparing transaction...";

  try {
    const params = {
      from: {
        adapter,
        chain: "Arc_Testnet",
        address: walletAddress
      },
      to: recipient,
      amount,
      token: "USDC"
    };

    await kit.estimateSend(params);

    message.textContent =
      "Confirm the payment in your wallet...";

    const result = await kit.send(params);

    console.log("Payment result:", result);

    if (result?.txHash) {
      message.innerHTML =
        'Payment submitted. <a href="https://testnet.arcscan.app/tx/' +
        result.txHash +
        '" target="_blank" rel="noopener noreferrer">View transaction</a>';
    } else {
      message.textContent =
        "Payment submitted successfully.";
    }
  } catch (error) {
    console.error(error);
    message.textContent =
      error?.message || "Payment failed or was rejected.";
  } finally {
    sendButton.disabled = false;
  }
});
