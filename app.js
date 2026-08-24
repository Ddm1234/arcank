import { encodeFunctionData, parseUnits, isAddress } from "viem";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

const connectButton = document.getElementById("connectButton");
const sendButton = document.getElementById("sendButton");
const walletStatus = document.getElementById("walletStatus");
const recipientInput = document.getElementById("recipient");
const amountInput = document.getElementById("amount");
const message = document.getElementById("message");
const batchSendButton = document.getElementById("batchSendButton");
const batchPayments = document.getElementById("batchPayments");
const batchMessage = document.getElementById("batchMessage");

const BATCH_CONTRACT = "0xB15C4f77234f8e03AbB564834e3FbFc15aAe60d0";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";

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
    batchSendButton.disabled = false;
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
    batchSendButton.disabled = false;
  }
});

batchSendButton.addEventListener("click", async () => {
  try {
    if (!walletProvider || !walletAddress) {
      throw new Error("Connect your wallet first.");
    }

    const lines = batchPayments.value
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error("Enter at least one recipient.");
    }

    const recipients = [];
    const amounts = [];
    let total = 0n;

    for (const line of lines) {
      const parts = line.split(",");

      if (parts.length !== 2) {
        throw new Error(
          "Invalid line. Use: wallet-address,amount"
        );
      }

      const recipient = parts[0].trim();
      const amountText = parts[1].trim();

      if (!isAddress(recipient)) {
        throw new Error(`Invalid address: ${recipient}`);
      }

      const amount = parseUnits(amountText, 6);

      if (amount <= 0n) {
        throw new Error("Amounts must be greater than zero.");
      }

      recipients.push(recipient);
      amounts.push(amount);
      total += amount;
    }

    batchMessage.textContent =
      `Preparing batch of ${recipients.length} payment(s)...`;

    const batchData = encodeFunctionData({
      abi: [{
        type: "function",
        name: "batchTransfer",
        stateMutability: "nonpayable",
        inputs: [
          {
            name: "recipients",
            type: "address[]"
          },
          {
            name: "amounts",
            type: "uint256[]"
          }
        ],
        outputs: []
      }],
      functionName: "batchTransfer",
      args: [recipients, amounts]
    });

    batchMessage.textContent =
      "Confirm the batch transaction in your wallet...";

    const txHash = await walletProvider.request({
      method: "eth_sendTransaction",
      params: [{
        from: walletAddress,
        to: BATCH_CONTRACT,
        data: batchData
      }]
    });

    batchMessage.innerHTML =
      'Batch payment submitted. <a href="https://testnet.arcscan.app/tx/' +
      txHash +
      '" target="_blank" rel="noopener noreferrer">View transaction</a>';

    console.log("Batch transaction:", txHash);

  } catch (error) {
    console.error(error);

    batchMessage.textContent =
      error?.shortMessage ||
      error?.message ||
      "Batch payment failed or was rejected.";
  }
});
